/**
 * Migration Script: Snapshot Existing Teams' Plan Entitlements
 *
 * This script migrates from the old system (where entitlements were dynamically
 * queried from plan definitions) to the new system (where each team has a
 * snapshot of their plan's entitlements).
 *
 * This ensures that future changes to plan definitions don't affect existing
 * customers - the core principle of separating billing from entitlements.
 *
 * Usage: pnpm tsx scripts/migrate-teams-to-snapshot-entitlements.ts
 */

import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { eq } from "drizzle-orm"
import * as schema from "../src/db/schema"
import path from "node:path"
import { fileURLToPath } from "node:url"
import fs from "node:fs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const {
	teamTable,
	planTable,
	teamFeatureEntitlementTable,
	teamLimitEntitlementTable,
} = schema

/**
 * Get local D1 database for development
 */
function getLocalDatabase() {
	// Find the local D1 database file
	const dbPath = path.resolve(
		__dirname,
		"../.wrangler/state/v3/d1/miniflare-D1DatabaseObject",
	)

	// Find .sqlite file in directory
	const files = fs.readdirSync(dbPath)
	const sqliteFile = files.find((f: string) => f.endsWith(".sqlite"))

	if (!sqliteFile) {
		throw new Error(`No SQLite database found in ${dbPath}`)
	}

	const fullPath = path.join(dbPath, sqliteFile)
	console.log(`📂 Using local D1 database: ${fullPath}\n`)

	const sqlite = new Database(fullPath)
	return drizzle(sqlite, { schema })
}

/**
 * Snapshot a plan's entitlements to a team
 */
async function snapshotPlanEntitlements(
	db: ReturnType<typeof drizzle>,
	teamId: string,
	planId: string,
): Promise<void> {
	// 1. Get the plan with all its features and limits
	const plan = await db.query.planTable.findFirst({
		where: eq(planTable.id, planId),
		with: {
			planFeatures: {
				with: {
					feature: true,
				},
			},
			planLimits: {
				with: {
					limit: true,
				},
			},
		},
	})

	if (!plan) {
		throw new Error(`Plan ${planId} not found`)
	}

	// 2. Delete existing team entitlements (we're replacing them)
	await db
		.delete(teamFeatureEntitlementTable)
		.where(eq(teamFeatureEntitlementTable.teamId, teamId))

	await db
		.delete(teamLimitEntitlementTable)
		.where(eq(teamLimitEntitlementTable.teamId, teamId))

	// 3. Snapshot features
	if (plan.planFeatures.length > 0) {
		await db.insert(teamFeatureEntitlementTable).values(
			plan.planFeatures.map((pf) => ({
				teamId,
				featureId: pf.featureId,
				source: "plan" as const,
				sourcePlanId: planId,
			})),
		)
	}

	// 4. Snapshot limits
	if (plan.planLimits.length > 0) {
		await db.insert(teamLimitEntitlementTable).values(
			plan.planLimits.map((pl) => ({
				teamId,
				limitId: pl.limitId,
				value: pl.value,
				source: "plan" as const,
				sourcePlanId: planId,
			})),
		)
	}

	console.log(
		`   Snapshotted plan "${plan.name}": ${plan.planFeatures.length} features, ${plan.planLimits.length} limits`,
	)
}

async function main() {
	console.log("🚀 Starting entitlement snapshot migration...\n")

	const db = getLocalDatabase()

	// Get all teams
	const teams = await db.query.teamTable.findMany({
		orderBy: (teams, { asc }) => [asc(teams.createdAt)],
	})

	console.log(`Found ${teams.length} teams to migrate\n`)

	let successCount = 0
	let errorCount = 0

	for (const team of teams) {
		try {
			const planId = team.currentPlanId || "free"

			console.log(`📸 Snapshotting team: ${team.name} (${team.id})`)
			console.log(`   Current plan: ${planId}`)

			// Snapshot the plan's entitlements to this team
			await snapshotPlanEntitlements(db, team.id, planId)

			successCount++
			console.log(`   ✅ Success\n`)
		} catch (error) {
			errorCount++
			console.error(
				`   ❌ Error: ${error instanceof Error ? error.message : String(error)}\n`,
			)
		}
	}

	console.log("━".repeat(60))
	console.log(`\n✨ Migration complete!`)
	console.log(`   Successful: ${successCount}`)
	console.log(`   Failed: ${errorCount}`)
	console.log(`   Total: ${teams.length}\n`)

	if (errorCount > 0) {
		console.error("⚠️  Some teams failed to migrate. Please review errors above.")
		process.exit(1)
	}

	console.log(
		"🎉 All teams successfully migrated to snapshot-based entitlements!",
	)
}

main()
	.then(() => {
		process.exit(0)
	})
	.catch((error) => {
		console.error("Fatal error:", error)
		process.exit(1)
	})
