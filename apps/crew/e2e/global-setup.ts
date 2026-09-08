/**
 * Playwright Global Setup
 *
 * Runs once before E2E tests: verifies CI preparation or sets up local data.
 */

import { execSync } from "node:child_process"
import { verifyPreparedCrewDatabase } from "./fixtures/prepared-database"

async function globalSetup(): Promise<void> {
  if (process.env.CREW_E2E_DB_PREPARED !== undefined) {
    if (process.env.CREW_E2E_DB_PREPARED !== "1") {
      throw new Error("CREW_E2E_DB_PREPARED must be 1 when enabled")
    }
    await verifyPreparedCrewDatabase(process.env.DATABASE_URL, process.env.CI)
    console.log(
      "[E2E Global Setup] Verified prepared CI database; setup skipped",
    )
    return
  }

  console.log("\n[E2E Global Setup] Preparing test database...")

  try {
    execSync("pnpm tsx scripts/setup-e2e-db.ts", {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "test",
      },
    })

    console.log("[E2E Global Setup] Database ready\n")
  } catch (error) {
    console.error("[E2E Global Setup] Failed to setup database")
    throw error
  }
}

export default globalSetup
