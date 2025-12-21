/**
 * E2E Database Setup Script
 *
 * This script prepares the local D1 database for E2E tests:
 * 1. Applies all migrations (if needed)
 * 2. Checks if base data exists (plans, features)
 * 3. Runs base seed only if needed
 * 4. Always runs the E2E-specific seed (test users, teams, workouts)
 *
 * Run with: pnpm tsx scripts/setup-e2e-db.ts
 * Or use: pnpm db:seed:e2e
 */

import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = __dirname
const APP_DIR = join(__dirname, "..")

// Get database name from the helper script
function getDbName(): string {
	try {
		const result = execSync("node scripts/get-db-name.mjs", {
			cwd: APP_DIR,
			encoding: "utf-8",
		})
		return result.trim()
	} catch {
		return "wodsmith-db"
	}
}

function runCommand(command: string, description: string): void {
	console.log(`\n📦 ${description}...`)
	try {
		execSync(command, {
			cwd: APP_DIR,
			stdio: "inherit",
		})
		console.log(`✅ ${description} completed`)
	} catch (error) {
		console.error(`❌ ${description} failed`)
		throw error
	}
}

function checkDataExists(dbName: string): boolean {
	try {
		// Check if plans table has data (indicates base seed was run)
		const result = execSync(
			`wrangler d1 execute ${dbName} --local --command "SELECT COUNT(*) as count FROM plan" --json`,
			{ cwd: APP_DIR, encoding: "utf-8" },
		)
		const parsed = JSON.parse(result)
		const count = parsed[0]?.results?.[0]?.count ?? 0
		return count > 0
	} catch {
		return false
	}
}

async function main(): Promise<void> {
	console.log("🧪 Setting up E2E test database...")
	console.log("=".repeat(50))

	const dbName = getDbName()
	console.log(`📊 Database: ${dbName}`)

	// Check required files exist
	const e2eSeedFile = join(SCRIPTS_DIR, "seed-e2e.sql")
	if (!existsSync(e2eSeedFile)) {
		throw new Error(`E2E seed file not found: ${e2eSeedFile}`)
	}

	// Step 1: Apply migrations
	runCommand(
		`wrangler d1 migrations apply ${dbName} --local`,
		"Applying database migrations",
	)

	// Step 2: Check if base data exists
	const hasBaseData = checkDataExists(dbName)
	
	if (!hasBaseData) {
		console.log("\n⚠️  Base data not found. Running full seed first...")
		
		// Run the full seed script which handles everything
		runCommand(
			"bash ./scripts/seed-all.sh",
			"Running full database seed",
		)
	} else {
		console.log("\n✓ Base data already exists, skipping base seed")
	}

	// Step 3: Always run E2E-specific seed (it cleans up its own data first)
	runCommand(
		`wrangler d1 execute ${dbName} --local --file=./scripts/seed-e2e.sql`,
		"Running E2E test seed (users, teams, workouts)",
	)

	console.log("\n" + "=".repeat(50))
	console.log("✅ E2E database setup complete!")
	console.log("\nTest credentials:")
	console.log("  Email:    test@wodsmith.com")
	console.log("  Password: TestPassword123!")
	console.log("\nRun E2E tests with: pnpm e2e")
}

main().catch((error) => {
	console.error("\n❌ E2E database setup failed:", error.message)
	process.exit(1)
})
