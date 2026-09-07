import { beforeEach, expect, it, vi } from "vitest"

const kv = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("cloudflare:workers", () => ({ env: { KV_SESSION: kv } }))
vi.mock("@/db", () => ({ getDb: () => ({ query: { userTable: { findFirst: async () => ({ authGeneration: 0 }) } } }) }))
vi.mock("@/utils/auth", () => ({ getUserFromDB: vi.fn(), getUserTeamsWithPermissions: vi.fn() }))
vi.mock("@/server/entitlements", () => ({ getUserEntitlements: vi.fn() }))
import { getKVSession } from "@/utils/kv-session"

beforeEach(() => { kv.get.mockReset() })

// @lat: [[auth-boundary-tests#Account boundary regressions#Crew persisted session method validation]]
it.each(["google-oauth", "unknown-method", "passkey", "password", undefined])("validates persisted authentication method %s without inventing new proof", async (method) => {
  kv.get.mockImplementation(async (key: string) => key.startsWith("session:") ? JSON.stringify({
    id: "sid", userId: "uid", user: {}, createdAt: 123, expiresAt: Date.now() + 60_000,
    authenticationType: method,
  }) : null)
  const session = await getKVSession("sid", "uid")
  if (method !== undefined && method !== "passkey" && method !== "password") {
    expect(session).toBeNull()
    return
  }
  expect(session).toMatchObject({ id: "sid", userId: "uid", createdAt: 123 })
  expect(session?.authenticationType).toBe(method === "passkey" || method === "password" ? method : undefined)
  expect(session).not.toHaveProperty("authenticationGeneration")
})
