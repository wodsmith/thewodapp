/**
 * Production Migration: Snapshot Free Plan to All Existing Teams
 *
 * This script ensures all existing teams get the free plan entitlements
 * snapshotted to their team_feature_entitlement and team_limit_entitlement tables.
 *
 * IMPORTANT: Run this AFTER running the seed-entitlements-production.sql script
 *
 * Usage:
 *   Local:      pnpm tsx scripts/snapshot-teams-production.ts
 *   Production: Run the equivalent SQL script below via wrangler
 */

import { getDb } from "../src/db"
import { teamTable } from "../src/db/schema"
import { snapshotPlanEntitlements } from "../src/server/entitlements"

async function main() {
	console.log("🚀 Starting production team snapshot migration...\n")

	const db = getDb()

	// Get all teams
	const teams = await db.query.teamTable.findMany({
		orderBy: (teams, { asc }) => [asc(teams.createdAt)],
	})

	console.log(`Found ${teams.length} teams to snapshot\n`)

	let successCount = 0
	let errorCount = 0
	const errors: Array<{ teamId: string; teamName: string; error: string }> = []

	for (const team of teams) {
		try {
			// Use the team's current plan, defaulting to 'free' if none set
			const planId = team.currentPlanId || "free"

			console.log(`📸 Team: ${team.name} (${team.id})`)
			console.log(`   Plan: ${planId}`)

			// Snapshot the plan's entitlements to this team
			await snapshotPlanEntitlements(team.id, planId)

			successCount++
			console.log(`   ✅ Success\n`)
		} catch (error) {
			errorCount++
			const errorMsg = error instanceof Error ? error.message : String(error)
			errors.push({
				teamId: team.id,
				teamName: team.name,
				error: errorMsg,
			})
			console.error(`   ❌ Error: ${errorMsg}\n`)
		}
	}

	console.log("━".repeat(60))
	console.log(`\n✨ Migration Results:`)
	console.log(`   Successful: ${successCount}`)
	console.log(`   Failed: ${errorCount}`)
	console.log(`   Total: ${teams.length}\n`)

	if (errorCount > 0) {
		console.error("\n⚠️  Failed Teams:")
		for (const err of errors) {
			console.error(`   • ${err.teamName} (${err.teamId}): ${err.error}`)
		}
		console.error(
			"\n⚠️  Some teams failed to migrate. Please review errors above.\n",
		)
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
