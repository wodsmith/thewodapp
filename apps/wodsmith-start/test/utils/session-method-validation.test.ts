import { beforeEach, expect, it, vi } from "vitest"

const kv = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() }))
vi.mock("cloudflare:workers", () => ({ env: { KV_SESSION: kv } }))
vi.mock("@/db", () => ({ getDb: () => ({ query: { userTable: { findFirst: async () => ({ authGeneration: 0 }) } } }) }))
vi.mock("@/utils/auth", () => ({ getUserFromDB: vi.fn(), getUserTeamsWithPermissions: vi.fn() }))
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeaders: () => new Headers() }))
vi.mock("@/server/entitlements", () => ({ getUserEntitlements: async () => [] }))
import { MAX_SESSIONS_PER_USER } from "@/constants"
import { createKVSession, getKVSession } from "@/utils/kv-session"

beforeEach(() => { kv.get.mockReset() })

// @lat: [[auth-boundary-tests#Account boundary regressions#Persisted session method validation]]
it.each(["google-oauth", "unknown-method", "passkey", "password", undefined])("validates persisted authentication method %s without inventing new proof", async (method) => {
  kv.get.mockImplementation(async (key: string) => key.startsWith("session:") ? JSON.stringify({
    id: "sid", userId: "uid", user: {}, createdAt: 123, expiresAt: Date.now() + 60_000,
    authenticationType: method,
  }) : null)
  const session = await getKVSession("sid", "uid")
  if (method !== undefined && method !== "passkey" && method !== "password") {
    expect(session).toBeNull()
    expect(kv.delete).toHaveBeenCalledWith("session:uid:sid")
    return
  }
  expect(session).toMatchObject({ id: "sid", userId: "uid", createdAt: 123 })
  expect(session?.authenticationType).toBe(method === "passkey" || method === "password" ? method : undefined)
  expect(session).not.toHaveProperty("authenticationGeneration")
})

// @lat: [[auth-boundary-tests#Account boundary regressions#Unsupported session quota cleanup]]
it.each([
  { position: "oldest", offset: -30_000, stale: false },
  { position: "newest", offset: 60_000, stale: false },
  { position: "oldest", offset: -30_000, stale: true },
  { position: "newest", offset: 60_000, stale: true },
])("excludes the $position unsupported session from quota when deletion is stale=$stale", async ({ offset, stale }) => {
  const stored = new Map<string, string>()
  const expiresAt = new Date(Date.now() + 60_000)
  for (let index = 0; index < MAX_SESSIONS_PER_USER - 1; index += 1) {
    stored.set(`session:uid:valid-${index}`, JSON.stringify({ authenticationType: "password", expiresAt: expiresAt.getTime(), createdAt: 123 }))
  }
  const validRecords = new Map(stored)
  stored.set("session:uid:unsupported", JSON.stringify({ authenticationType: "retired-method", expiresAt: expiresAt.getTime() + offset }))
  stored.set("session:other:unsupported", JSON.stringify({ authenticationType: "retired-method", expiresAt: expiresAt.getTime() }))
  kv.get.mockImplementation(async (key: string) => stored.get(key) ?? null)
  kv.put.mockImplementation(async (key: string, value: string) => { stored.set(key, value) })
  kv.delete.mockImplementation(async (key: string) => { if (!stale) stored.delete(key) })
  kv.list.mockImplementation(async ({ prefix }: { prefix: string }) => ({ keys: [...stored].filter(([name]) => name.startsWith(prefix)).map(([name, value]) => ({ name, expiration: JSON.parse(value).expiresAt / 1000 })), list_complete: true }))
  await createKVSession({ sessionId: "new", userId: "uid", user: {} as never, expiresAt, authenticationType: "password" })
  expect([...stored].filter(([key, value]) => key.startsWith("session:uid:") && JSON.parse(value).authenticationType === "password")).toHaveLength(MAX_SESSIONS_PER_USER)
  expect(stored.has("session:uid:unsupported")).toBe(stale)
  expect(stored.has("session:other:unsupported")).toBe(true)
  expect(stored.has("session:uid:new")).toBe(true)
  for (const [key, value] of validRecords) expect(stored.get(key)).toBe(value)
  expect(kv.delete).toHaveBeenCalledTimes(1)
  expect(kv.delete).toHaveBeenCalledWith("session:uid:unsupported")
})
