import { FakeKV } from "./fake-kv"
import { FakeDatabase } from "./fake-db"

/**
 * Combined fake Cloudflare Workers environment.
 * Provides all bindings needed for testing server actions.
 * 
 * @example
 * ```ts
 * const env = createFakeCloudflareEnv()
 * 
 * // Use in tests
 * await env.KV_SESSIONS.put("session:123", JSON.stringify(session))
 * const dbUser = env.DB.insert("users", { name: "Test" })
 * 
 * // Reset between tests
 * env.reset()
 * ```
 */
export interface FakeCloudflareEnv {
  DB: FakeDatabase<Record<string, Record<string, unknown>>>
  KV_SESSIONS: FakeKV
  KV_CACHE: FakeKV
  reset(): void
}

/**
 * Create a fake Cloudflare Workers environment with all bindings.
 */
export function createFakeCloudflareEnv(): FakeCloudflareEnv {
  const DB = new FakeDatabase()
  const KV_SESSIONS = new FakeKV()
  const KV_CACHE = new FakeKV()

  return {
    DB,
    KV_SESSIONS,
    KV_CACHE,
    reset() {
      DB.reset()
      KV_SESSIONS.reset()
      KV_CACHE.reset()
    },
  }
}
