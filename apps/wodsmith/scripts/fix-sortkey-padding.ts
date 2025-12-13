/**
 * Fix sortKey padding in scores table
 * 
 * This script updates all sortKey values to be zero-padded to 19 digits
 * for proper lexicographic string comparison in leaderboard queries.
 * 
 * Background:
 * - sortKey is stored as text (since SQLite doesn't support BIGINT)
 * - String comparison requires zero-padding for correct ordering
 * - Without padding, "100" < "99" lexicographically (wrong!)
 * - With padding, "0000000000000000100" < "0000000000000000099" (correct!)
 * 
 * Usage:
 * pnpm tsx scripts/fix-sortkey-padding.ts [--dry-run]
 */

import { sql } from "drizzle-orm"
import { getDb } from "@/db"
import { scoresTable } from "@/db/schemas/scores"

interface MigrationOptions {
	dryRun: boolean
}

async function fixSortKeyPadding(options: MigrationOptions) {
	const db = getDb()

	console.log("Starting sortKey padding fix...")
	console.log(`Mode: ${options.dryRun ? "DRY RUN" : "LIVE"}`)

	// Get all scores with non-null sortKey
	const scores = await db
		.select({
			id: scoresTable.id,
			sortKey: scoresTable.sortKey,
		})
		.from(scoresTable)
		.where(sql`${scoresTable.sortKey} IS NOT NULL`)

	console.log(`Found ${scores.length} scores with sortKey values`)

	if (scores.length === 0) {
		console.log("No scores to update")
		return
	}

	let updatedCount = 0
	let skippedCount = 0

	for (const score of scores) {
		if (!score.sortKey) continue

		// Check if already padded (19 digits)
		if (score.sortKey.length === 19) {
			skippedCount++
			continue
		}

		// Pad to 19 digits
		const paddedSortKey = score.sortKey.padStart(19, "0")

		if (options.dryRun) {
			console.log(`[DRY RUN] Would update score ${score.id}:`)
			console.log(`  Old: "${score.sortKey}" (${score.sortKey.length} chars)`)
			console.log(`  New: "${paddedSortKey}" (${paddedSortKey.length} chars)`)
		} else {
			await db
				.update(scoresTable)
				.set({ sortKey: paddedSortKey })
				.where(sql`${scoresTable.id} = ${score.id}`)
			
			updatedCount++
			
			if (updatedCount % 100 === 0) {
				console.log(`Updated ${updatedCount} scores...`)
			}
		}
	}

	console.log("\nMigration complete!")
	console.log(`Updated: ${options.dryRun ? "N/A (dry run)" : updatedCount}`)
	console.log(`Skipped (already padded): ${skippedCount}`)
	console.log(`Total processed: ${scores.length}`)
}

// Parse command line args
const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")

fixSortKeyPadding({ dryRun })
	.then(() => {
		console.log("\nDone!")
		process.exit(0)
	})
	.catch((error) => {
		console.error("Error:", error)
		process.exit(1)
	})
