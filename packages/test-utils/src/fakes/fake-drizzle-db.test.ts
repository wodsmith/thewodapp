import { describe, it, expect, beforeEach, vi } from "vitest"
import { FakeDrizzleDb } from "./fake-drizzle-db"

describe("FakeDrizzleDb", () => {
	let db: FakeDrizzleDb
	
	beforeEach(() => {
		db = new FakeDrizzleDb()
	})
	
	describe("query chains", () => {
		it("supports select().from().where() chain", async () => {
			const testData = [{ id: "1", name: "Test User" }]
			db.setMockReturnValue(testData)
			
			const result = await db.select().from({}).where({})
			
			expect(result).toEqual(testData)
			expect(db.select).toHaveBeenCalled()
		})
		
		it("supports leftJoin in chain", async () => {
			db.setMockReturnValue([])
			
			const result = await db
				.select()
				.from({})
				.leftJoin({}, {})
				.where({})
			
			expect(result).toEqual([])
		})
		
		it("supports rightJoin in chain", async () => {
			db.setMockReturnValue([])
			
			const result = await db
				.select()
				.from({})
				.rightJoin({}, {})
				.where({})
			
			expect(result).toEqual([])
		})
		
		it("supports innerJoin in chain", async () => {
			db.setMockReturnValue([])
			
			const result = await db
				.select()
				.from({})
				.innerJoin({}, {})
				.where({})
			
			expect(result).toEqual([])
		})
		
		it("supports limit and offset", async () => {
			db.setMockReturnValue([])
			
			const result = await db
				.select()
				.from({})
				.limit(10)
				.offset(5)
			
			expect(result).toEqual([])
		})
		
		it("supports orderBy and groupBy", async () => {
			db.setMockReturnValue([])
			
			const result = await db
				.select()
				.from({})
				.orderBy({})
				.groupBy({})
			
			expect(result).toEqual([])
		})
		
		it("is thenable at any point in the chain", async () => {
			const testData = [{ id: "1" }]
			db.setMockReturnValue(testData)
			
			// Can await after select
			const afterSelect = await db.select()
			expect(afterSelect).toEqual(testData)
			
			// Can await after from
			const afterFrom = await db.select().from({})
			expect(afterFrom).toEqual(testData)
			
			// Can await after where
			const afterWhere = await db.select().from({}).where({})
			expect(afterWhere).toEqual(testData)
		})
	})
	
	describe("insert chains", () => {
		it("supports insert().values().returning() chain", async () => {
			const insertedData = [{ id: "new_id", name: "New User" }]
			db.setMockReturnValue(insertedData)
			
			const result = await db
				.insert({})
				.values({ name: "New User" })
				.returning()
			
			expect(result).toEqual(insertedData)
		})
		
		it("supports insert().values() with array", async () => {
			const insertedData = [
				{ id: "1", name: "User 1" },
				{ id: "2", name: "User 2" },
			]
			db.setMockReturnValue(insertedData)
			
			const result = await db
				.insert({})
				.values([
					{ name: "User 1" },
					{ name: "User 2" },
				])
				.returning()
			
			expect(result).toEqual(insertedData)
		})
		
		it("supports onConflictDoUpdate", async () => {
			db.setMockReturnValue([{ id: "1", name: "Updated" }])
			
			const result = await db
				.insert({})
				.values({ name: "Test" })
				.onConflictDoUpdate({ target: {}, set: {} })
				.returning()
			
			expect(result).toEqual([{ id: "1", name: "Updated" }])
		})
		
		it("supports onConflictDoNothing", async () => {
			db.setMockReturnValue([])
			
			const result = await db
				.insert({})
				.values({ name: "Test" })
				.onConflictDoNothing()
				.returning()
			
			expect(result).toEqual([])
		})
	})
	
	describe("update chains", () => {
		it("supports update().set().where() chain", async () => {
			db.setMockReturnValue([{ id: "1", name: "Updated User" }])
			
			const result = await db
				.update({})
				.set({ name: "Updated User" })
				.where({})
				.returning()
			
			expect(result).toEqual([{ id: "1", name: "Updated User" }])
		})
	})
	
	describe("delete chains", () => {
		it("supports delete().where() chain", async () => {
			db.setMockChanges(3)
			
			const result = await db
				.delete({})
				.where({})
				.run()
			
			expect(result).toEqual({ changes: 3 })
		})
		
		it("supports delete without where", async () => {
			db.setMockChanges(10)
			
			const result = await db
				.delete({})
				.run()
			
			expect(result).toEqual({ changes: 10 })
		})
	})
	
	describe("query API (db.query.tableName)", () => {
		it("supports findFirst() pattern", async () => {
			db.registerTable("users")
			const userData = { id: "1", name: "Test User" }
			db.setMockSingleValue(userData)
			
			const result = await db.query.users?.findFirst()
			
			expect(result).toEqual(userData)
		})
		
		it("supports findMany() pattern", async () => {
			db.registerTable("users")
			const usersData = [
				{ id: "1", name: "User 1" },
				{ id: "2", name: "User 2" },
			]
			db.setMockReturnValue(usersData)
			
			const result = await db.query.users?.findMany()
			
			expect(result).toEqual(usersData)
		})
		
		it("returns null for findFirst when not found", async () => {
			db.registerTable("users")
			db.setMockSingleValue(null)
			
			const result = await db.query.users?.findFirst()
			
			expect(result).toBeNull()
		})
		
		it("supports multiple registered tables", async () => {
			db.registerTable("users")
			db.registerTable("teams")
			
			expect(db.query.users).toBeDefined()
			expect(db.query.teams).toBeDefined()
			expect(db.query.users?.findFirst).toBeDefined()
			expect(db.query.teams?.findFirst).toBeDefined()
		})
	})
	
	describe("terminal methods", () => {
		it("supports .get() for single record", async () => {
			const userData = { id: "1", name: "Test User" }
			db.setMockSingleValue(userData)
			
			const result = await db.select().from({}).where({}).get()
			
			expect(result).toEqual(userData)
		})
		
		it("supports .all() for multiple records", async () => {
			const usersData = [
				{ id: "1", name: "User 1" },
				{ id: "2", name: "User 2" },
			]
			db.setMockReturnValue(usersData)
			
			const result = await db.select().from({}).all()
			
			expect(result).toEqual(usersData)
		})
	})
	
	describe("mock configuration", () => {
		it("allows setting mock return value per test", async () => {
			const test1Data = [{ id: "1" }]
			db.setMockReturnValue(test1Data)
			
			const result1 = await db.select().from({})
			expect(result1).toEqual(test1Data)
			
			const test2Data = [{ id: "2" }]
			db.setMockReturnValue(test2Data)
			
			const result2 = await db.select().from({})
			expect(result2).toEqual(test2Data)
		})
		
		it("allows setting single value separately", async () => {
			db.setMockSingleValue({ id: "single" })
			db.setMockReturnValue([{ id: "array" }])
			
			const singleResult = await db.select().from({}).get()
			expect(singleResult).toEqual({ id: "single" })
			
			const arrayResult = await db.select().from({})
			expect(arrayResult).toEqual([{ id: "array" }])
		})
	})
	
	describe("reset", () => {
		it("clears all mock values", () => {
			db.setMockReturnValue([{ id: "1" }])
			db.setMockSingleValue({ id: "single" })
			db.setMockChanges(5)
			db.registerTable("users")
			
			db.reset()
			
			expect(db.query).toEqual({})
		})
		
		it("allows setting new values after reset", async () => {
			db.setMockReturnValue([{ id: "1" }])
			db.reset()
			
			const newData = [{ id: "2" }]
			db.setMockReturnValue(newData)
			
			const result = await db.select().from({})
			expect(result).toEqual(newData)
		})
	})
	
	describe("spy verification", () => {
		it("methods are vi.fn() spies", () => {
			expect(vi.isMockFunction(db.select)).toBe(true)
		})
		
		it("can verify method calls", async () => {
			await db.select().from({}).where({})
			
			expect(db.select).toHaveBeenCalled()
			expect(db.select).toHaveBeenCalledTimes(1)
		})
		
		it("can verify arguments passed to methods", async () => {
			const whereClause = { id: "1" }
			await db.select().from({}).where(whereClause)
			
			const chainMock = db.getChainMock()
			expect(chainMock.where).toHaveBeenCalledWith(whereClause)
		})
	})
})
