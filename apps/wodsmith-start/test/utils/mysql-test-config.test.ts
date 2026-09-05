import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv("WODSMITH_TEST_MYSQL_HOST", "127.0.0.1")
  vi.stubEnv("WODSMITH_TEST_MYSQL_SOCKET", undefined)
  vi.stubEnv("WODSMITH_TEST_MYSQL_PORT", undefined)
})

afterEach(() => vi.unstubAllEnvs())

describe("MySQL integration connection configuration", () => {
  // @lat: [[commerce#Purchase Transfers#Invalid integration port]]
  it.each(["", "0", "-1", "65536", "3306.5", "not-a-port"])(
    "rejects invalid explicit port %s before connecting",
    async (port) => {
      vi.stubEnv("WODSMITH_TEST_MYSQL_PORT", port)
      await expect(import("../integration/mysql-test-config")).rejects.toThrow(
        "WODSMITH_TEST_MYSQL_PORT must be an integer from 1 to 65535",
      )
    },
  )

  // @lat: [[commerce#Purchase Transfers#Valid integration port]]
  it.each([undefined, "1", "3306", "65535"])(
    "accepts an omitted or valid explicit port %s",
    async (port) => {
      vi.stubEnv("WODSMITH_TEST_MYSQL_PORT", port)
      const { mysqlTestConfig } = await import(
        "../integration/mysql-test-config"
      )
      expect(mysqlTestConfig).toMatchObject({
        host: "127.0.0.1",
        port: Number(port ?? 3306),
      })
    },
  )
})
