import { createId } from "@paralleldrive/cuid2"

/**
 * D1's hard limit for SQL parameters in a single query.
 * Queries with more parameters will be rejected.
 */
export const D1_PARAMETER_LIMIT = 100

/**
 * In-memory fake database that mimics D1/Drizzle behavior.
 * Enforces the 100 SQL parameter limit to catch bugs early.
 * 
 * @example
 * ```ts
 * const db = new FakeDatabase<{ users: User; teams: Team }>()
 * 
 * // Insert
 * const user = db.insert("users", { name: "Test" })
 * 
 * // Query
 * const found = db.findById("users", user.id)
 * 
 * // This will throw - too many parameters
 * const ids = Array(150).fill(null).map(() => createId())
 * db.findByIds("users", ids) // Error: D1 parameter limit exceeded
 * ```
 */
export class FakeDatabase<TSchema extends Record<string, Record<string, unknown>>> {
  private tables = new Map<string, Map<string, unknown>>()
  private parameterCount = 0

  /**
   * Enforce D1's 100 SQL parameter limit.
   * Call this before any query with dynamic parameters.
   * @throws Error if params.length > 100
   */
  enforceParameterLimit(params: unknown[]): void {
    if (params.length > D1_PARAMETER_LIMIT) {
      throw new Error(
        `D1 parameter limit exceeded: ${params.length} > ${D1_PARAMETER_LIMIT}. ` +
        `Use autochunk() from @/utils/batch-query for large arrays.`
      )
    }
    this.parameterCount = params.length
  }

  /**
   * Get or create a table by name.
   */
  getTable<K extends keyof TSchema>(name: K): Map<string, TSchema[K]> {
    if (!this.tables.has(name as string)) {
      this.tables.set(name as string, new Map())
    }
    return this.tables.get(name as string) as Map<string, TSchema[K]>
  }

  /**
   * Insert a record. ID is auto-generated if not provided.
   */
  insert<K extends keyof TSchema>(
    table: K,
    data: Omit<TSchema[K], "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): TSchema[K] {
    const id = (data as { id?: string }).id ?? createId()
    const now = new Date()
    const record = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    } as unknown as TSchema[K]
    this.getTable(table).set(id, record)
    return record
  }

  /**
   * Find a record by ID.
   */
  findById<K extends keyof TSchema>(table: K, id: string): TSchema[K] | null {
    return this.getTable(table).get(id) ?? null
  }

  /**
   * Find all records, optionally filtered.
   */
  findMany<K extends keyof TSchema>(
    table: K,
    predicate?: (item: TSchema[K]) => boolean
  ): TSchema[K][] {
    const items = Array.from(this.getTable(table).values())
    return predicate ? items.filter(predicate) : items
  }

  /**
   * Find by IDs with D1 parameter limit enforcement.
   * @throws Error if ids.length > 100
   */
  findByIds<K extends keyof TSchema>(table: K, ids: string[]): TSchema[K][] {
    this.enforceParameterLimit(ids)
    return ids
      .map(id => this.findById(table, id))
      .filter((item): item is TSchema[K] => item !== null)
  }

  /**
   * Update a record by ID.
   */
  update<K extends keyof TSchema>(
    table: K,
    id: string,
    data: Partial<TSchema[K]>
  ): TSchema[K] | null {
    const existing = this.findById(table, id)
    if (!existing) return null
    const updated = { ...existing, ...data, updatedAt: new Date() } as unknown as TSchema[K]
    this.getTable(table).set(id, updated)
    return updated
  }

  /**
   * Delete a record by ID.
   */
  delete<K extends keyof TSchema>(table: K, id: string): boolean {
    return this.getTable(table).delete(id)
  }

  /**
   * Reset all tables. Call in beforeEach/afterEach.
   */
  reset(): void {
    this.tables.clear()
    this.parameterCount = 0
  }

  /**
   * Get the parameter count from the last enforced query.
   */
  getLastParameterCount(): number {
    return this.parameterCount
  }
}
