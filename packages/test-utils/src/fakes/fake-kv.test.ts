import { describe, it, expect, beforeEach } from "vitest"
import { FakeKV } from "./fake-kv"

describe("FakeKV", () => {
  let kv: FakeKV

  beforeEach(() => {
    kv = new FakeKV()
  })

  describe("get/put", () => {
    it("should store and retrieve values", async () => {
      await kv.put("key1", "value1")
      const result = await kv.get("key1")
      
      expect(result).toBe("value1")
    })

    it("should return null for non-existent keys", async () => {
      const result = await kv.get("non-existent")
      expect(result).toBeNull()
    })

    it("should store with metadata", async () => {
      await kv.put("key1", "value1", { metadata: { role: "admin" } })
      const result = await kv.getWithMetadata<{ role: string }>("key1")
      
      expect(result.value).toBe("value1")
      expect(result.metadata?.role).toBe("admin")
    })

    it("should support JSON type retrieval", async () => {
      const data = { userId: "123", role: "admin" }
      await kv.put("key1", JSON.stringify(data))
      const result = await kv.get("key1", { type: "json" })
      
      expect(result).toEqual(data)
    })
  })

  describe("getWithMetadata", () => {
    it("should return null metadata when not set", async () => {
      await kv.put("key1", "value1")
      const result = await kv.getWithMetadata("key1")
      
      expect(result.value).toBe("value1")
      expect(result.metadata).toBeNull()
    })

    it("should return null for non-existent key", async () => {
      const result = await kv.getWithMetadata("non-existent")
      
      expect(result.value).toBeNull()
      expect(result.metadata).toBeNull()
    })

    it("should support JSON type retrieval", async () => {
      const data = { userId: "123" }
      await kv.put("key1", JSON.stringify(data))
      const result = await kv.getWithMetadata("key1", { type: "json" })
      
      expect(result.value).toEqual(data)
    })
  })

  describe("delete", () => {
    it("should delete existing key", async () => {
      await kv.put("key1", "value1")
      await kv.delete("key1")
      
      const result = await kv.get("key1")
      expect(result).toBeNull()
    })

    it("should not throw for non-existent key", async () => {
      await expect(kv.delete("non-existent")).resolves.not.toThrow()
    })
  })

  describe("list", () => {
    it("should list all keys", async () => {
      await kv.put("key1", "value1")
      await kv.put("key2", "value2")
      
      const result = await kv.list()
      
      expect(result.keys).toHaveLength(2)
      expect(result.list_complete).toBe(true)
    })

    it("should filter by prefix", async () => {
      await kv.put("session:1", "s1")
      await kv.put("session:2", "s2")
      await kv.put("cache:1", "c1")
      
      const result = await kv.list({ prefix: "session:" })
      
      expect(result.keys).toHaveLength(2)
      expect(result.keys.every(k => k.name.startsWith("session:"))).toBe(true)
    })

    it("should respect limit", async () => {
      await kv.put("key1", "v1")
      await kv.put("key2", "v2")
      await kv.put("key3", "v3")
      
      const result = await kv.list({ limit: 2 })
      
      expect(result.keys).toHaveLength(2)
      expect(result.list_complete).toBe(false)
      expect(result.cursor).toBe("next")
    })

    it("should include metadata in list", async () => {
      await kv.put("key1", "v1", { metadata: { type: "session" } })
      
      const result = await kv.list()
      
      expect(result.keys).toHaveLength(1)
      expect(result.keys[0]?.metadata).toEqual({ type: "session" })
    })
  })

  describe("reset", () => {
    it("should clear all keys", async () => {
      await kv.put("key1", "v1")
      await kv.put("key2", "v2")
      
      kv.reset()
      
      expect(kv.size()).toBe(0)
      expect(await kv.get("key1")).toBeNull()
    })
  })

  describe("size", () => {
    it("should return number of stored keys", async () => {
      expect(kv.size()).toBe(0)
      
      await kv.put("key1", "v1")
      expect(kv.size()).toBe(1)
      
      await kv.put("key2", "v2")
      expect(kv.size()).toBe(2)
    })
  })
})
