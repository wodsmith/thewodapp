import { beforeEach, describe, expect, it, vi } from "vitest"

const kv = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
}))
const db = vi.hoisted(() => ({
  query: {
    userTable: { findFirst: vi.fn() },
    teamMembershipTable: { findMany: vi.fn() },
  },
  update: vi.fn(),
}))
vi.mock("cloudflare:workers", () => ({ env: { KV_SESSION: kv } }))
vi.mock("@/db", () => ({ getDb: () => db }))
vi.mock("@/utils/email", () => ({
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}))
vi.mock("@/server/entitlements", () => ({
  getUserEntitlements: vi.fn(async () => []),
  getTeamPlan: vi.fn(),
}))
vi.mock("@tanstack/react-start/server", () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
  getRequestHeaders: vi.fn(() => new Headers()),
}))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
}))
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: <T>(fn: T) => fn,
  createServerFn: () => ({
    handler: (fn: unknown) => fn,
    inputValidator: (validator: (data: unknown) => unknown) => ({
      handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) =>
        (ctx: { data: unknown }) => fn({ data: validator(ctx.data) }),
    }),
  }),
  json: (data: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(data), init),
}))

import { getCookie, setCookie } from "@tanstack/react-start/server"
import { SESSION_COOKIE_NAME } from "@/constants"
import { Route as TokenRoute } from "@/routes/api/auth/token"
import { Route as RefreshRoute } from "@/routes/api/auth/token/refresh"
import { resetPasswordFn, signInFn } from "@/server-fns/auth-fns"
import {
  createSession,
  getSessionFromCookie,
  getSessionFromRequestCookie,
  withSessionCache,
} from "@/utils/auth"
import { getResetTokenKey } from "@/utils/auth-utils"
import { getSessionFromBearer } from "@/utils/bearer-auth"
import {
  getKVSession,
  getSessionKey,
  updateAllSessionsOfUser,
} from "@/utils/kv-session"
import { hashPassword, verifyPassword } from "@/utils/password-hasher"

type ApiRoute = {
  server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } }
}
const tokenRoute = TokenRoute as unknown as ApiRoute
const refreshRoute = RefreshRoute as unknown as ApiRoute
const userId = "recovery-user"
const resetToken = "recovery-test-token"
const oldPassword = "OldPassword1"
const newPassword = "NewPassword2"
const oldToken = "browser-token"
const bearerToken = "mobile-token"
const resetData = {
  token: resetToken,
  password: newPassword,
  confirmPassword: newPassword,
}
let now: number
let stored: Map<string, string>
let user: {
  id: string
  email: string
  firstName: string
  lastName: string
  emailVerified: Date
  passwordHash: string
}

function bearerRequest(token = bearerToken, id = userId) {
  return new Request("https://wodsmith.test/api/auth/token/refresh", {
    method: "POST",
    headers: { Authorization: `Bearer ${id}:${token}` },
  })
}

function credentialsRequest() {
  return new Request("https://wodsmith.test/api/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: oldPassword }),
  })
}

async function reset() {
  return resetPasswordFn({ data: resetData })
}

describe("password recovery session revocation", () => {
  beforeEach(async () => {
    now = 1_800_000_000_000
    vi.spyOn(Date, "now").mockImplementation(() => now)
    stored = new Map()
    user = {
      id: userId,
      email: "recovery@example.com",
      firstName: "Recovery",
      lastName: "Athlete",
      emailVerified: new Date(now - 1000),
      passwordHash: await hashPassword({ password: oldPassword }),
    }
    db.query.userTable.findFirst.mockImplementation(async () => ({ ...user }))
    db.query.teamMembershipTable.findMany.mockResolvedValue([])
    db.update.mockImplementation(() => ({
      set: (values: { passwordHash: string }) => ({
        where: async () => { user.passwordHash = values.passwordHash },
      }),
    }))
    kv.get.mockImplementation(async (key: string) => stored.get(key) ?? null)
    kv.put.mockImplementation(async (key: string, value: string) => {
      stored.set(key, value)
    })
    kv.delete.mockImplementation(async (key: string) => { stored.delete(key) })
    // Deliberately small pages: real KV allows up to 1,000 keys per page.
    kv.list.mockImplementation(async ({ prefix, cursor }: { prefix: string; cursor?: string }) => {
      const keys = [...stored.keys()].filter((key) => key.startsWith(prefix)).sort()
      const offset = Number(cursor ?? 0)
      const page = keys.slice(offset, offset + 1)
      const complete = offset + 1 >= keys.length
      return {
        keys: page.map((name) => ({ name, expiration: Math.floor((now + 60_000) / 1000) })),
        list_complete: complete,
        ...(complete ? {} : { cursor: String(offset + 1) }),
      }
    })
    vi.mocked(getCookie).mockReturnValue(`${userId}:${oldToken}`)
    await createSession({ token: oldToken, userId, authenticationType: "password" })
    await createSession({ token: bearerToken, userId, authenticationType: "password" })
    stored.set(getResetTokenKey(resetToken), JSON.stringify({
      userId,
      expiresAt: new Date(now + 60_000).toISOString(),
    }))
    now += 1000
  })

  // @lat: [[auth#Recovery tests#Existing sessions and new login]]
  it("revokes cached browser and mobile sessions across pages while allowing a new login", async () => {
    const other = await createSession({ token: "other-token", userId: "other-user" })
    expect(await getSessionFromBearer(bearerRequest())).toMatchObject({ userId })
    await withSessionCache(async () => {
      expect(await getSessionFromCookie()).toMatchObject({ userId })
      expect(await reset()).toEqual({ success: true })
      expect(await getSessionFromCookie()).toBeNull()
    })
    expect(await getSessionFromBearer(bearerRequest())).toBeNull()
    expect(await getSessionFromRequestCookie(new Request("https://wodsmith.test", {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${userId}:${oldToken}` },
    }))).toBeNull()
    expect([...stored.keys()].filter((key) => key.startsWith(`session:${userId}:`))).toEqual([])
    expect(await getKVSession(other.id, "other-user")).not.toBeNull()
    expect(kv.list).toHaveBeenCalledWith({ prefix: `session:${userId}:`, cursor: "1" })
    expect(stored.has(getResetTokenKey(resetToken))).toBe(false)
    expect(await verifyPassword({ storedHash: user.passwordHash, passwordAttempt: newPassword })).toBe(true)
    expect(await verifyPassword({ storedHash: user.passwordHash, passwordAttempt: oldPassword })).toBe(false)

    now += 1000
    await expect(signInFn({ data: { email: user.email, password: oldPassword } })).rejects.toThrow("Invalid email or password")
    await signInFn({ data: { email: user.email, password: newPassword } })
    const cookie = [...vi.mocked(setCookie).mock.calls].reverse().find(([name, value]) => name === SESSION_COOKIE_NAME && value)?.[1]
    expect(cookie).toBeTruthy()
    vi.mocked(getCookie).mockReturnValue(String(cookie))
    expect(await withSessionCache(getSessionFromCookie)).toMatchObject({ userId })
  })

  // @lat: [[auth#Recovery tests#Late refresh stays revoked]]
  it("rejects an old session rewritten by an in-flight entitlement refresh", async () => {
    const sessionKey = [...stored.keys()].find((key) => key.startsWith(`session:${userId}:`))!
    const stale = stored.get(sessionKey)!
    await reset()
    stored.set(sessionKey, stale)
    now += 1000
    await updateAllSessionsOfUser(userId)
    expect(kv.put).toHaveBeenCalledWith(sessionKey, expect.any(String), expect.any(Object))
    expect(await getKVSession(sessionKey.split(":")[2]!, userId)).toBeNull()
    stored.set(sessionKey, JSON.stringify({ ...JSON.parse(stale), createdAt: undefined }))
    expect(await getKVSession(sessionKey.split(":")[2]!, userId)).toBeNull()
  })

  // @lat: [[auth#Recovery tests#Recovery failures remain retryable]]
  it.each(["marker", "listing", "deletion"])("does not report success or consume the token on %s failure", async (failure) => {
    if (failure === "marker") kv.put.mockRejectedValueOnce(new Error("KV write failed"))
    if (failure === "listing") kv.list.mockRejectedValueOnce(new Error("KV list failed"))
    if (failure === "deletion") kv.delete.mockRejectedValueOnce(new Error("KV delete failed"))
    await expect(reset()).rejects.toThrow("KV")
    expect(stored.has(getResetTokenKey(resetToken))).toBe(true)
    now += 1000
    await expect(reset()).resolves.toEqual({ success: true })
    expect(await getSessionFromBearer(bearerRequest())).toBeNull()
  })

  it("does not revoke sessions or consume the token if the password write fails", async () => {
    db.update.mockImplementationOnce(() => ({
      set: () => ({ where: async () => { throw new Error("Database unavailable") } }),
    }))
    await expect(reset()).rejects.toThrow("Database unavailable")
    expect(stored.has(getResetTokenKey(resetToken))).toBe(true)
    expect(stored.has(`session-revoked-before:${userId}`)).toBe(false)
    expect(await getSessionFromBearer(bearerRequest())).not.toBeNull()
  })

  it("preserves a new login issued after the cutoff while cleanup is still running", async () => {
    const normalList = kv.list.getMockImplementation()!
    kv.list.mockImplementationOnce(async (options) => {
      now += 1000
      // The cutoff is already stored; a genuinely new login is safe to retain.
      await createSession({ token: "new-during-cleanup", userId })
      return normalList(options)
    })
    await reset()
    expect(await getSessionFromBearer(bearerRequest("new-during-cleanup"))).not.toBeNull()
  })

  it("fails closed when the revocation marker cannot be read", async () => {
    kv.get.mockImplementation(async (key: string) => {
      if (key.startsWith("session-revoked-before:")) throw new Error("KV read failed")
      return stored.get(key) ?? null
    })
    await expect(getSessionFromBearer(bearerRequest())).rejects.toThrow("KV read failed")
  })

  it("preserves another user's current request cache and cookie during recovery", async () => {
    await createSession({ token: "other-token", userId: "other-user" })
    vi.mocked(getCookie).mockReturnValue("other-user:other-token")
    await withSessionCache(async () => {
      const before = await getSessionFromCookie()
      await reset()
      expect(await getSessionFromCookie()).toBe(before)
    })
    expect(setCookie).not.toHaveBeenCalled()
  })

  // @lat: [[auth#Recovery tests#In-flight authentication and token rotation]]
  it.each(["web", "mobile"])("rejects a %s old-password login started before recovery", async (client) => {
    const oldUser = { ...user }
    let reached!: () => void
    const entered = new Promise<void>((resolve) => { reached = resolve })
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    db.query.userTable.findFirst.mockImplementationOnce(async () => {
      reached()
      await pending
      return oldUser
    })
    const login = client === "web"
      ? signInFn({ data: { email: user.email, password: oldPassword } })
      : tokenRoute.server.handlers.POST({ request: credentialsRequest() })
    await entered
    now += 1000
    await reset()
    now += 1000
    release()
    const result = await login
    if (client === "mobile") {
      const body = await (result as Response).json() as { token: string }
      const token = body.token.slice(userId.length + 1)
      expect(await getSessionFromBearer(bearerRequest(token))).toBeNull()
    } else {
      const cookie = [...vi.mocked(setCookie).mock.calls].reverse().find(([name, value]) => name === SESSION_COOKIE_NAME && value)?.[1]
      vi.mocked(getCookie).mockReturnValue(String(cookie))
      expect(await withSessionCache(getSessionFromCookie)).toBeNull()
    }
  })

  it("rotates a bearer token without moving its authentication timestamp past a reset", async () => {
    const original = await getSessionFromBearer(bearerRequest())
    await reset()
    // Simulate a stale regional KV read while a rotation is in flight.
    const marker = stored.get(`session-revoked-before:${userId}`)!
    stored.delete(`session-revoked-before:${userId}`)
    stored.set(getSessionKey(userId, original!.id), JSON.stringify(original))
    now += 1000
    const response = await refreshRoute.server.handlers.POST({ request: bearerRequest() })
    const body = await response.json() as { token: string }
    expect(response.status).toBe(200)
    stored.set(`session-revoked-before:${userId}`, marker)
    expect(await getSessionFromBearer(bearerRequest(body.token.slice(userId.length + 1)))).toBeNull()
  })
})
