import { describe, it, expect, beforeEach } from "vitest"
import { FakeDatabase, D1_PARAMETER_LIMIT } from "./fake-db"

interface TestSchema extends Record<string, Record<string, unknown>> {
  users: {
    id: string
    name: string
    email: string
    createdAt: Date
    updatedAt: Date
  }
  teams: {
    id: string
    name: string
    ownerId: string
    createdAt: Date
    updatedAt: Date
  }
}

describe("FakeDatabase", () => {
  let db: FakeDatabase<TestSchema>

  beforeEach(() => {
    db = new FakeDatabase<TestSchema>()
  })

  describe("insert", () => {
    it("should insert a record with auto-generated ID", () => {
      const user = db.insert("users", { name: "Test", email: "test@test.com" })
      
      expect(user.id).toBeDefined()
      expect(user.id.length).toBeGreaterThan(0)
      expect(user.name).toBe("Test")
      expect(user.email).toBe("test@test.com")
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it("should use provided ID if given", () => {
      const user = db.insert("users", { id: "custom-id", name: "Test", email: "test@test.com" })
      expect(user.id).toBe("custom-id")
    })
  })

  describe("findById", () => {
    it("should find existing record", () => {
      const user = db.insert("users", { name: "Test", email: "test@test.com" })
      const found = db.findById("users", user.id)
      
      expect(found).toEqual(user)
    })

    it("should return null for non-existent record", () => {
      const found = db.findById("users", "non-existent")
      expect(found).toBeNull()
    })
  })

  describe("findMany", () => {
    it("should return all records without predicate", () => {
      db.insert("users", { name: "User 1", email: "u1@test.com" })
      db.insert("users", { name: "User 2", email: "u2@test.com" })
      
      const users = db.findMany("users")
      expect(users).toHaveLength(2)
    })

    it("should filter records with predicate", () => {
      db.insert("users", { name: "Alice", email: "alice@test.com" })
      db.insert("users", { name: "Bob", email: "bob@test.com" })
      
      const users = db.findMany("users", u => u.name === "Alice")
      expect(users).toHaveLength(1)
      expect(users[0]?.name).toBe("Alice")
    })
  })

  describe("findByIds", () => {
    it("should find records by IDs", () => {
      const u1 = db.insert("users", { name: "User 1", email: "u1@test.com" })
      const u2 = db.insert("users", { name: "User 2", email: "u2@test.com" })
      db.insert("users", { name: "User 3", email: "u3@test.com" })
      
      const found = db.findByIds("users", [u1.id, u2.id])
      expect(found).toHaveLength(2)
    })

    it("should throw when IDs exceed D1 parameter limit", () => {
      const ids = Array(D1_PARAMETER_LIMIT + 1).fill(null).map(() => "id")
      
      expect(() => db.findByIds("users", ids)).toThrow(
        `D1 parameter limit exceeded: 101 > ${D1_PARAMETER_LIMIT}`
      )
    })

    it("should allow exactly 100 IDs", () => {
      const ids = Array(D1_PARAMETER_LIMIT).fill(null).map((_, i) => `id-${i}`)
      
      expect(() => db.findByIds("users", ids)).not.toThrow()
    })
  })

  describe("update", () => {
    it("should update existing record", () => {
      const user = db.insert("users", { name: "Original", email: "test@test.com" })
      const updated = db.update("users", user.id, { name: "Updated" })
      
      expect(updated?.name).toBe("Updated")
      expect(updated?.email).toBe("test@test.com")
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(user.updatedAt.getTime())
    })

    it("should return null for non-existent record", () => {
      const result = db.update("users", "non-existent", { name: "Test" })
      expect(result).toBeNull()
    })
  })

  describe("delete", () => {
    it("should delete existing record", () => {
      const user = db.insert("users", { name: "Test", email: "test@test.com" })
      const deleted = db.delete("users", user.id)
      
      expect(deleted).toBe(true)
      expect(db.findById("users", user.id)).toBeNull()
    })

    it("should return false for non-existent record", () => {
      const deleted = db.delete("users", "non-existent")
      expect(deleted).toBe(false)
    })
  })

  describe("reset", () => {
    it("should clear all tables", () => {
      db.insert("users", { name: "User", email: "test@test.com" })
      db.insert("teams", { name: "Team", ownerId: "owner" })
      
      db.reset()
      
      expect(db.findMany("users")).toHaveLength(0)
      expect(db.findMany("teams")).toHaveLength(0)
    })
  })

  describe("enforceParameterLimit", () => {
    it("should track parameter count", () => {
      const params = Array(50).fill("test")
      db.enforceParameterLimit(params)
      
      expect(db.getLastParameterCount()).toBe(50)
    })
  })
})
