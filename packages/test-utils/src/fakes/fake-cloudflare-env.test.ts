import { describe, it, expect, beforeEach } from "vitest"
import { createFakeCloudflareEnv, type FakeCloudflareEnv } from "./fake-cloudflare-env"

describe("FakeCloudflareEnv", () => {
  let env: FakeCloudflareEnv

  beforeEach(() => {
    env = createFakeCloudflareEnv()
  })

  it("should provide all bindings", () => {
    expect(env.DB).toBeDefined()
    expect(env.KV_SESSIONS).toBeDefined()
    expect(env.KV_CACHE).toBeDefined()
    expect(env.reset).toBeDefined()
  })

  it("should allow DB operations", () => {
    const user = env.DB.insert("users", { name: "Test User" })
    
    expect(user).toBeDefined()
    expect(user).toHaveProperty("id")
    expect(user).toMatchObject({ name: "Test User" })
  })

  it("should allow KV_SESSIONS operations", async () => {
    await env.KV_SESSIONS.put("session:123", JSON.stringify({ userId: "abc" }))
    const session = await env.KV_SESSIONS.get("session:123", { type: "json" })
    
    expect(session).toEqual({ userId: "abc" })
  })

  it("should allow KV_CACHE operations", async () => {
    await env.KV_CACHE.put("cache:key", "value")
    const cached = await env.KV_CACHE.get("cache:key")
    
    expect(cached).toBe("value")
  })

  it("should reset all bindings", async () => {
    // Add data to all bindings
    env.DB.insert("users", { name: "User" })
    await env.KV_SESSIONS.put("session:1", "s1")
    await env.KV_CACHE.put("cache:1", "c1")
    
    // Verify data exists
    expect(env.DB.findMany("users")).toHaveLength(1)
    expect(env.KV_SESSIONS.size()).toBe(1)
    expect(env.KV_CACHE.size()).toBe(1)
    
    // Reset
    env.reset()
    
    // Verify all data is gone
    expect(env.DB.findMany("users")).toHaveLength(0)
    expect(env.KV_SESSIONS.size()).toBe(0)
    expect(env.KV_CACHE.size()).toBe(0)
  })

  it("should isolate KV_SESSIONS and KV_CACHE", async () => {
    await env.KV_SESSIONS.put("key", "session-value")
    await env.KV_CACHE.put("key", "cache-value")
    
    const sessionValue = await env.KV_SESSIONS.get("key")
    const cacheValue = await env.KV_CACHE.get("key")
    
    expect(sessionValue).toBe("session-value")
    expect(cacheValue).toBe("cache-value")
  })
})
