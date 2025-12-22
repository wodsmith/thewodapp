/**
 * Playwright Global Setup
 *
 * This runs ONCE before all E2E tests to:
 * 1. Seed the test database with predictable data
 * 2. Ensure the database is in a known state
 *
 * The dev server will be started by Playwright's webServer config after this.
 */

import { execSync } from "node:child_process"

async function globalSetup(): Promise<void> {
	console.log("\n🧪 [E2E Global Setup] Preparing test database...")

	try {
		// Run the E2E database setup script
		// Playwright runs from apps/wodsmith, so cwd is already correct
		execSync("pnpm tsx scripts/setup-e2e-db.ts", {
			stdio: "inherit",
			env: {
				...process.env,
				// Ensure we're using the local database
				NODE_ENV: "test",
			},
		})

		console.log("✅ [E2E Global Setup] Database ready\n")
	} catch (error) {
		console.error("❌ [E2E Global Setup] Failed to setup database")
		throw error
	}
}

export default globalSetup
