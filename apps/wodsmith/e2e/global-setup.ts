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
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_DIR = join(__dirname, "..")

export default async function globalSetup(): Promise<void> {
	console.log("\n🧪 [E2E Global Setup] Preparing test database...")

	try {
		// Run the E2E database setup script
		execSync("pnpm tsx scripts/setup-e2e-db.ts", {
			cwd: APP_DIR,
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
