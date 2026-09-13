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

// @lat: [[training-agent-services#Verification#Explicit loopback test addressing]]
it("preserves IPv6 loopback and credentials when constructing the canonical test URL", async () => {
  const { mysqlTestDatabaseUrl } = await import("../integration/mysql-test-config")
  const url=new URL(mysqlTestDatabaseUrl({host:"::1",port:33318,user:"test@user",password:"test:password"},"training_test"))
  expect(url.hostname).toBe("[::1]")
  expect(url.port).toBe("33318")
  expect(decodeURIComponent(url.username)).toBe("test@user")
  expect(decodeURIComponent(url.password)).toBe("test:password")
})
