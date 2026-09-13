import { beforeEach, describe, expect, it, vi } from "vitest"

const fixture = vi.hoisted(() => ({
  findUser: vi.fn(),
  kv: new Map<string, string>(),
}))
vi.mock("cloudflare:workers", () => ({ env: { KV_SESSION: {
  get: async (key: string) => fixture.kv.get(key) ?? null,
  put: async (key: string, value: string) => { fixture.kv.set(key, value) },
  delete: async (key: string) => { fixture.kv.delete(key) },
  list: async () => ({ keys: [], list_complete: true }),
} } }))
vi.mock("@/db", () => ({ getDb: () => ({ query: {
  userTable: { findFirst: fixture.findUser },
  teamMembershipTable: { findMany: async () => [] },
} }) }))
vi.mock("@/server/entitlements", () => ({ getUserEntitlements: async () => [] }))
vi.mock("@tanstack/react-start/server", () => ({ getCookie: vi.fn(), setCookie: vi.fn(), getRequestHeaders: () => new Headers() }))
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: (fn: unknown) => fn,
  createServerFn: () => ({ handler: (fn: unknown) => fn, inputValidator: (parse: (data: unknown) => unknown) => ({ handler: (fn: (ctx: {data: unknown}) => unknown) => (ctx: {data: unknown}) => fn({data: parse(ctx.data)}) }) }),
}))
import { signInFn } from "@/server-fns/auth-fns"
import { createSession } from "@/utils/auth"
import { getKVSession, updateKVSession } from "@/utils/kv-session"
import { hashPassword } from "@/utils/password-hasher"

let user: { id: string; email: string; emailVerified: Date; passwordHash: string; authGeneration: number }
describe("Crew shared account generation", () => {
  beforeEach(async () => {
    fixture.kv.clear()
    user = { id: "usr_owner", email: "owner@example.com", emailVerified: new Date(), passwordHash: await hashPassword({password: "Password123"}), authGeneration: 0 }
    fixture.findUser.mockImplementation(async () => ({ ...user }))
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Crew credential proof race]]
  it("rejects delayed old password proof and accepts a fresh login at the current generation", async () => {
    const snapshot = { ...user }
    let resume!: () => void, started!: () => void
    const blocked = new Promise<void>((resolve) => { resume = resolve })
    const reading = new Promise<void>((resolve) => { started = resolve })
    fixture.findUser.mockImplementationOnce(async () => { started(); await blocked; return snapshot })
    const login = signInFn({data: {email: user.email, password: "Password123"}})
    const rejected = expect(login).rejects.toThrow("Authentication changed")
    await reading
    user.authGeneration = 1
    resume()
    await rejected
    expect(fixture.kv.size).toBe(0)
    await signInFn({data: {email: user.email, password: "Password123"}})
    const record = JSON.parse([...fixture.kv.values()][0]!)
    expect(record.authenticationGeneration).toBe(1)
    expect(await getKVSession(record.id, user.id)).not.toBeNull()
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Crew profile refresh race]]
  it("preserves proof generation during refresh and rejects a concurrent identity claim", async () => {
    const session = await createSession({token: "crew-token", userId: user.id})
    expect(await updateKVSession(session.id, user.id, new Date(Date.now() + 60_000))).toMatchObject({ authenticationGeneration: 0 })
    fixture.findUser.mockImplementationOnce(async () => ({ authGeneration: 0 }))
    fixture.findUser.mockImplementationOnce(async () => { user.authGeneration = 1; return { ...user } })
    expect(await updateKVSession(session.id, user.id, new Date(Date.now() + 60_000))).toBeNull()
    expect(await getKVSession(session.id, user.id)).toBeNull()
  })
})
