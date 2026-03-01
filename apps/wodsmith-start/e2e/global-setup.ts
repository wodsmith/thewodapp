/**
 * Playwright Global Setup
 *
 * Runs ONCE before all E2E tests to seed the test database.
 */

import { execSync } from "node:child_process"

async function globalSetup(): Promise<void> {
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
