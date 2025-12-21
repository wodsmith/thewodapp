/**
 * Drizzle-compatible mock database for testing.
 * 
 * Wraps FakeDatabase with Drizzle's fluent query builder API.
 * Chainable methods: select(), from(), where(), leftJoin(), innerJoin(), limit(), orderBy(), groupBy()
 * Mutation chains: insert().values().returning(), update().set().where(), delete().where()
 * 
 * Key features:
 * - Thenable at any point in the chain (await works everywhere)
 * - Configurable mock return values per-test
 * - Supports db.query.tableName.findFirst() pattern
 * - All methods are vi.fn() spies for verification
 * 
 * @example
 * ```ts
 * import { FakeDrizzleDb } from '@repo/test-utils/fakes'
 * 
 * const db = new FakeDrizzleDb()
 * 
 * // Configure mock return
 * db.setMockReturnValue([{ id: '1', name: 'Test' }])
 * 
 * // Use like real Drizzle
 * const results = await db.select().from(users).where(eq(users.id, '1'))
 * // returns [{ id: '1', name: 'Test' }]
 * 
 * // Verify calls
 * expect(db.select).toHaveBeenCalled()
 * ```
 */

import { vi, type Mock } from "vitest"

/**
 * Chainable mock that implements Drizzle's fluent API.
 * Each method returns itself to enable chaining.
 * Thenable so await resolves to mockReturnValue.
 */
interface ChainableMock {
	// Make it thenable
	then: <T>(resolve: (value: T) => void) => Promise<T>
	
	// Query chain methods
	select: Mock<() => ChainableMock>
	from: Mock<(table: unknown) => ChainableMock>
	leftJoin: Mock<(table: unknown, on?: unknown) => ChainableMock>
	rightJoin: Mock<(table: unknown, on?: unknown) => ChainableMock>
	innerJoin: Mock<(table: unknown, on?: unknown) => ChainableMock>
	where: Mock<(condition: unknown) => ChainableMock>
	limit: Mock<(count: number) => ChainableMock>
	offset: Mock<(count: number) => ChainableMock>
	orderBy: Mock<(column: unknown) => ChainableMock>
	groupBy: Mock<(column: unknown) => ChainableMock>
	
	// Insert chain
	insert: Mock<(table: unknown) => ChainableMock>
	values: Mock<(data: unknown | unknown[]) => ChainableMock>
	returning: Mock<(columns?: unknown) => Promise<unknown[]>>
	onConflictDoUpdate: Mock<(config: unknown) => ChainableMock>
	onConflictDoNothing: Mock<(config?: unknown) => ChainableMock>
	
	// Update chain
	update: Mock<(table: unknown) => ChainableMock>
	set: Mock<(values: unknown) => ChainableMock>
	
	// Delete chain
	delete: Mock<(table?: unknown) => ChainableMock>
	
	// Other methods
	get: Mock<() => Promise<unknown | null>>
	all: Mock<() => Promise<unknown[]>>
	run: Mock<() => Promise<{ changes: number }>>
	
	// Allow indexing for dynamic properties
	[key: string]: unknown
}

/**
 * Query API for db.query.tableName.findFirst() pattern
 */
interface QueryApi {
	[tableName: string]: {
		findFirst: Mock<(config?: unknown) => Promise<unknown | null>>
		findMany: Mock<(config?: unknown) => Promise<unknown[]>>
	}
}

/**
 * Drizzle-compatible mock database.
 * 
 * Creates a chainable mock that behaves like Drizzle ORM's query builder.
 * All methods return the mock itself for chaining, except terminal methods
 * which return promises.
 */
export class FakeDrizzleDb {
	private mockReturnValue: unknown[] = []
	private mockSingleValue: unknown | null = null
	private mockChanges = 0
	private chainMock: ChainableMock
	public query: QueryApi = {}
	
	constructor() {
		this.chainMock = this.createChainableMock()
	}
	
	/**
	 * Set the return value for queries.
	 * Affects select, insert().returning(), findMany, etc.
	 */
	setMockReturnValue(value: unknown[]): void {
		this.mockReturnValue = value
	}
	
	/**
	 * Set the return value for single-record queries.
	 * Affects findFirst, get, etc.
	 */
	setMockSingleValue(value: unknown | null): void {
		this.mockSingleValue = value
	}
	
	/**
	 * Set the number of changes for delete/update operations.
	 */
	setMockChanges(changes: number): void {
		this.mockChanges = changes
	}
	
	/**
	 * Register a table in the query API.
	 * After calling this, db.query.tableName.findFirst() works.
	 */
	registerTable(tableName: string): void {
		if (!this.query[tableName]) {
			this.query[tableName] = {
				findFirst: this.createMockFn(() => Promise.resolve(this.mockSingleValue)),
				findMany: this.createMockFn(() => Promise.resolve(this.mockReturnValue)),
			}
		}
	}
	
	/**
	 * Reset all mocks. Call in beforeEach/afterEach.
	 */
	reset(): void {
		this.mockReturnValue = []
		this.mockSingleValue = null
		this.mockChanges = 0
		this.chainMock = this.createChainableMock()
		this.query = {}
	}
	
	/**
	 * Create a mock function using vitest.
	 */
	private createMockFn<T extends (...args: never[]) => unknown>(
		implementation?: T
	): Mock<T> {
		return implementation ? vi.fn(implementation) : vi.fn()
	}
	
	/**
	 * Create the chainable mock object.
	 */
	private createChainableMock(): ChainableMock {
		const self = this
		
		const mock = {
			// Make it thenable so await works at any point
			then: <T>(resolve: (value: T) => void) => {
				resolve(self.mockReturnValue as T)
				return Promise.resolve(self.mockReturnValue as T)
			},
			
			// Query chain methods - all return the mock for chaining
			select: this.createMockFn(() => mock),
			from: this.createMockFn(() => mock),
			leftJoin: this.createMockFn(() => mock),
			rightJoin: this.createMockFn(() => mock),
			innerJoin: this.createMockFn(() => mock),
			where: this.createMockFn(() => mock),
			limit: this.createMockFn(() => mock),
			offset: this.createMockFn(() => mock),
			orderBy: this.createMockFn(() => mock),
			groupBy: this.createMockFn(() => mock),
			
			// Insert chain
			insert: this.createMockFn(() => mock),
			values: this.createMockFn(() => mock),
			returning: this.createMockFn(() => Promise.resolve(self.mockReturnValue)),
			onConflictDoUpdate: this.createMockFn(() => mock),
			onConflictDoNothing: this.createMockFn(() => mock),
			
			// Update chain
			update: this.createMockFn(() => mock),
			set: this.createMockFn(() => mock),
			
			// Delete chain
			delete: this.createMockFn(() => mock),
			
			// Terminal methods
			get: this.createMockFn(() => Promise.resolve(self.mockSingleValue)),
			all: this.createMockFn(() => Promise.resolve(self.mockReturnValue)),
			run: this.createMockFn(() => Promise.resolve({ changes: self.mockChanges })),
		} as ChainableMock
		
		return mock
	}
	
	// Expose chainable methods at the top level for db.select() etc.
	get select() { return this.chainMock.select }
	get from() { return this.chainMock.from }
	get insert() { return this.chainMock.insert }
	get update() { return this.chainMock.update }
	get delete() { return this.chainMock.delete }
	
	// For accessing the full chain mock in tests
	getChainMock(): ChainableMock {
		return this.chainMock
	}
}
