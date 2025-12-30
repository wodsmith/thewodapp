/**
 * Seed script for 23 MWFC 2025 Demo Judges
 *
 * Creates 23 demo volunteer judges for competition comp_mwfc2025
 * All emails are obviously fake to distinguish demo data from real signups
 * All judges are pre-approved with status "approved" so they show immediately for scheduling
 *
 * Usage:
 *   Local:  pnpm tsx scripts/seed-mwfc-judges.ts
 *   Remote: pnpm tsx scripts/seed-mwfc-judges.ts --remote
 *
 * Or use SQL directly:
 *   Local:  wrangler d1 execute wodsmith-db --local --file=./scripts/seed-mwfc-judges.sql
 *   Remote: wrangler d1 execute wodsmith-db --remote --file=./scripts/seed-mwfc-judges.sql
 */

import { execSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_DIR = join(__dirname, "..")

/**
 * Get database name from wrangler configuration
 */
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

/**
 * Run a wrangler d1 command
 */
function runD1Command(command: string, description: string): void {
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

async function main(): Promise<void> {
	console.log("🧑‍⚖️ Seeding MWFC 2025 Demo Judges...")
	console.log("=".repeat(50))

	const isRemote = process.argv.includes("--remote")
	const dbName = getDbName()
	const envFlag = isRemote ? "--remote" : "--local"

	console.log(`📊 Database: ${dbName}`)
	console.log(`🌍 Environment: ${isRemote ? "REMOTE (PRODUCTION)" : "LOCAL"}`)

	if (isRemote) {
		console.log("\n⚠️  WARNING: This will modify PRODUCTION data!")
		console.log("   Press Ctrl+C within 3 seconds to abort...")
		await new Promise((resolve) => setTimeout(resolve, 3000))
	}

	// Run the SQL seed file
	runD1Command(
		`wrangler d1 execute ${dbName} ${envFlag} --file=./scripts/seed-mwfc-judges.sql`,
		"Creating 23 demo judges for MWFC 2025",
	)

	console.log("\n" + "=".repeat(50))
	console.log("✅ MWFC 2025 demo judges seeded successfully!")
	console.log("\nCreated 23 volunteer judges with:")
	console.log("  • Role: JUDGE")
	console.log("  • Availability: ALL_DAY")
	console.log("  • Status: APPROVED (ready for scheduling)")
	console.log("\nEmails use obviously fake domains:")
	console.log("  • @fake-judges.test")
	console.log("  • @not-a-real-email.invalid")
	console.log("  • @demo-volunteer.fake")
}

main().catch((error) => {
	console.error("\n❌ Seeding failed:", error.message)
	process.exit(1)
})
