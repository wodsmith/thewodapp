import type { PoolOptions } from "mysql2"

const socketPath = process.env.WODSMITH_TEST_MYSQL_SOCKET
const host = process.env.WODSMITH_TEST_MYSQL_HOST

if (host && !["127.0.0.1", "localhost", "::1"].includes(host)) {
  throw new Error(
    "MySQL integration tests require a loopback host or an explicit local Unix socket",
  )
}
if (!socketPath && !host && process.env.WODSMITH_TEST_MYSQL_REQUIRED === "1") {
  throw new Error(
    "Configure WODSMITH_TEST_MYSQL_SOCKET or WODSMITH_TEST_MYSQL_HOST for database integration tests",
  )
}

// No fallback to DATABASE_URL, Hyperdrive, or application credentials.
export const mysqlTestConfig: PoolOptions | undefined =
  socketPath || host
    ? {
        ...(socketPath
          ? { socketPath }
          : {
              host,
              port: Number(process.env.WODSMITH_TEST_MYSQL_PORT ?? 3306),
            }),
        timezone: "Z",
        user: process.env.WODSMITH_TEST_MYSQL_USER ?? "root",
        password: process.env.WODSMITH_TEST_MYSQL_PASSWORD ?? "",
      }
    : undefined
