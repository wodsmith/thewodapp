import type { PoolOptions } from "mysql2"

const socketPath = process.env.WODSMITH_TEST_MYSQL_SOCKET
const host = process.env.WODSMITH_TEST_MYSQL_HOST
const port = Number(process.env.WODSMITH_TEST_MYSQL_PORT ?? 3306)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("WODSMITH_TEST_MYSQL_PORT must be an integer from 1 to 65535")
}

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
              port,
            }),
        timezone: "Z",
        user: process.env.WODSMITH_TEST_MYSQL_USER ?? "root",
        password: process.env.WODSMITH_TEST_MYSQL_PASSWORD ?? "",
      }
    : undefined

/** Preserve explicit loopback addressing, including bracketed IPv6 literals. */
export function mysqlTestDatabaseUrl(config: PoolOptions, database: string): string {
  const url = new URL(`mysql://localhost/${database}`)
  url.username = String(config.user ?? "root")
  url.password = String(config.password ?? "")
  if (config.socketPath) url.searchParams.set("socketPath", config.socketPath)
  else {
    const host = config.host ?? "localhost"
    url.hostname = host.includes(":") ? `[${host}]` : host
    url.port = String(config.port ?? 3306)
  }
  return url.toString()
}
