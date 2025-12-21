/**
 * In-memory fake implementation of Cloudflare KV.
 * Implements the KVNamespace interface for testing.
 * 
 * @example
 * ```ts
 * const kv = new FakeKV()
 * await kv.put("session:abc", JSON.stringify({ userId: "123" }))
 * const session = await kv.get("session:abc", { type: "json" })
 * ```
 */
export class FakeKV {
  private store = new Map<
    string,
    { value: string; metadata?: unknown; expirationTtl?: number }
  >()

  /**
   * Get a value from the store.
   * Supports text and json types.
   */
  async get(
    key: string,
    options?: { type?: "text" | "json" | "arrayBuffer" | "stream" }
  ): Promise<string | null>
  async get<ExpectedValue = unknown>(
    key: string,
    options?: { type: "json" }
  ): Promise<ExpectedValue | null>
  async get<ExpectedValue = unknown>(
    key: string,
    options?: { type?: "text" | "json" | "arrayBuffer" | "stream" }
  ): Promise<string | ExpectedValue | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    // Check expiration (simplified - we don't track actual time)
    if (entry.expirationTtl) {
      // For testing, we just return the value
      // Real implementation would check expiration
    }

    if (options?.type === "json") {
      return JSON.parse(entry.value) as ExpectedValue
    }

    return entry.value
  }

  /**
   * Get a value with its metadata.
   */
  async getWithMetadata<Metadata = unknown>(
    key: string,
    options?: { type?: "text" | "json" }
  ): Promise<{ value: string | null; metadata: Metadata | null }>
  async getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
    key: string,
    options: { type: "json" }
  ): Promise<{ value: ExpectedValue | null; metadata: Metadata | null }>
  async getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
    key: string,
    options?: { type?: "text" | "json" }
  ): Promise<{
    value: string | ExpectedValue | null
    metadata: Metadata | null
  }> {
    const entry = this.store.get(key)
    if (!entry) {
      return { value: null, metadata: null }
    }

    let value: string | ExpectedValue | null = entry.value
    if (options?.type === "json") {
      value = JSON.parse(entry.value) as ExpectedValue
    }

    return {
      value,
      metadata: (entry.metadata as Metadata) ?? null,
    }
  }

  /**
   * Put a value into the store.
   */
  async put(
    key: string,
    value: string,
    options?: { metadata?: unknown; expirationTtl?: number; expiration?: number }
  ): Promise<void> {
    this.store.set(key, {
      value,
      metadata: options?.metadata,
      expirationTtl: options?.expirationTtl,
    })
  }

  /**
   * Delete a value from the store.
   */
  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  /**
   * List keys in the store.
   */
  async list(options?: {
    prefix?: string
    limit?: number
    cursor?: string
  }): Promise<{
    keys: { name: string; metadata?: unknown }[]
    list_complete: boolean
    cursor?: string
  }> {
    let keys = Array.from(this.store.entries()).map(([name, entry]) => ({
      name,
      metadata: entry.metadata,
    }))

    if (options?.prefix) {
      keys = keys.filter((k) => k.name.startsWith(options.prefix!))
    }

    const limit = options?.limit ?? 1000
    const limited = keys.slice(0, limit)

    return {
      keys: limited,
      list_complete: limited.length === keys.length,
      cursor: limited.length < keys.length ? "next" : undefined,
    }
  }

  /**
   * Reset all stored values. Call in beforeEach/afterEach.
   */
  reset(): void {
    this.store.clear()
  }

  /**
   * Get the number of stored keys. Useful for assertions.
   */
  size(): number {
    return this.store.size
  }
}
