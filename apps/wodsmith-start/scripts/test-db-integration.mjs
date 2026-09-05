import { spawnSync } from "node:child_process"

if (
  !process.env.WODSMITH_TEST_MYSQL_SOCKET &&
  !process.env.WODSMITH_TEST_MYSQL_HOST
) {
  console.error(
    "Set WODSMITH_TEST_MYSQL_SOCKET or WODSMITH_TEST_MYSQL_HOST to run database integration tests.",
  )
  process.exit(1)
}

const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "test/integration", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, WODSMITH_TEST_MYSQL_REQUIRED: "1" },
  },
)
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
