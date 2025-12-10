/**
 * Migration Script: results+sets → scores+score_rounds
 *
 * This script backfills the new scores table from the legacy results+sets tables.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-results-to-scores.ts [--dry-run] [--limit=N] [--competition-only]
 *
 * Options:
 *   --dry-run          Show what would be migrated without writing to DB
 *   --limit=N          Only migrate N results (for testing)
 *   --competition-only Only migrate competition scores (competitionEventId not null)
 *
 * What it does:
 * 1. Reads results + sets from legacy tables
 * 2. Converts legacy encoding to new encoding:
 *    - Time: seconds → milliseconds (*1000)
 *    - Rounds+Reps: rounds*1000+reps → rounds*100000+reps
 *    - Load: lbs → grams (*453.592)
 *    - Distance: meters/feet → millimeters
 * 3. Computes sortKey for efficient leaderboard queries
 * 4. Inserts into scores + score_rounds tables
 */

import { db } from "@/db"
import { results, sets } from "@/db/schema"
import { scoresTable, scoreRoundsTable } from "@/db/schemas/scores"
import { workouts } from "@/db/schemas/workouts"
import type { WorkoutScheme } from "@/db/schema"
import {
	computeSortKey,
	sortKeyToString,
	type Score,
	type ScoreStatus,
	type ScoreType,
} from "@/lib/scoring"
import {
	convertLegacyToNew,
	convertLegacyFractionalRoundsReps,
} from "@/utils/score-adapter"
import { eq, isNotNull, sql } from "drizzle-orm"

interface MigrationOptions {
	dryRun: boolean
	limit?: number
	competitionOnly: boolean
}

interface LegacyResult {
	id: string
	userId: string
	date: Date
	workoutId: string | null
	notes: string | null
	scalingLevelId: string | null
	asRx: boolean
	wodScore: string | null
	competitionEventId: string | null
	competitionRegistrationId: string | null
	scoreStatus: string | null
	tieBreakScore: string | null
	secondaryScore: string | null
	enteredBy: string | null
	scheduledWorkoutInstanceId: string | null
	sets: Array<{
		id: string
		setNumber: number
		reps: number | null
		weight: number | null
		time: number | null
		score: number | null
		distance: number | null
		status: string | null
		notes: string | null
	}>
	workout: {
		id: string
		scheme: WorkoutScheme
		scoreType: ScoreType | null
		tiebreakScheme: string | null
		timeCap: number | null
		teamId: string
	} | null
}

async function parseArgs(): Promise<MigrationOptions> {
	const args = process.argv.slice(2)
	const options: MigrationOptions = {
		dryRun: args.includes("--dry-run"),
		competitionOnly: args.includes("--competition-only"),
	}

	const limitArg = args.find((arg) => arg.startsWith("--limit="))
	if (limitArg) {
		options.limit = Number.parseInt(limitArg.split("=")[1], 10)
	}

	return options
}

/**
 * Convert legacy scoreStatus to new ScoreStatus
 */
function convertScoreStatus(
	legacyStatus: string | null,
): ScoreStatus {
	switch (legacyStatus?.toLowerCase()) {
		case "cap":
			return "cap"
		case "dq":
			return "dq"
		case "dns":
		case "dnf":
			return "withdrawn"
		default:
			return "scored"
	}
}

/**
 * Get status order for sorting
 */
function getStatusOrder(status: ScoreStatus): number {
	const statusOrder = { scored: 0, cap: 1, dq: 2, withdrawn: 3 }
	return statusOrder[status]
}

/**
 * Parse legacy wodScore string and convert to new encoding
 */
function parseAndConvertWodScore(
	wodScore: string | null,
	scheme: WorkoutScheme,
	sets: LegacyResult["sets"],
): { value: number | null; rounds: number[] } {
	// For multi-set workouts, extract individual set values
	const rounds: number[] = []

	switch (scheme) {
		case "time":
		case "time-with-cap":
		case "emom": {
			// Time stored in sets.time as seconds
			const timeValues = sets
				.map((s) => s.time)
				.filter((t): t is number => t !== null)

			if (timeValues.length > 0) {
				// Convert each to milliseconds
				rounds.push(...timeValues.map((t) => t * 1000))
				// Take min for aggregated value (best time)
				return { value: Math.min(...rounds), rounds }
			}
			return { value: null, rounds: [] }
		}

		case "rounds-reps": {
			// Stored as score=rounds, reps=reps in sets
			for (const set of sets) {
				if (set.score !== null || set.reps !== null) {
					const rounds_legacy = set.score ?? 0
					const reps = set.reps ?? 0
					// Convert: rounds*1000+reps → rounds*100000+reps
					const newEncoding = rounds_legacy * 100000 + reps
					rounds.push(newEncoding)
				}
			}

			if (rounds.length > 0) {
				return { value: Math.max(...rounds), rounds }
			}

			// Fallback: parse wodScore if available
			if (wodScore) {
				// Try fractional format first (5.12 = 5+12)
				if (wodScore.includes(".")) {
					const fractional = Number.parseFloat(wodScore)
					if (!Number.isNaN(fractional)) {
						const newEncoding = convertLegacyFractionalRoundsReps(fractional)
						return { value: newEncoding, rounds: [newEncoding] }
					}
				}
			}

			return { value: null, rounds: [] }
		}

		case "reps":
		case "calories":
		case "points": {
			const repValues = sets
				.map((s) => s.reps ?? s.score)
				.filter((r): r is number => r !== null)

			if (repValues.length > 0) {
				rounds.push(...repValues)
				return { value: Math.max(...repValues), rounds }
			}
			return { value: null, rounds: [] }
		}

		case "load": {
			const loadValues = sets
				.map((s) => s.weight)
				.filter((w): w is number => w !== null)

			if (loadValues.length > 0) {
				// Convert lbs → grams
				const gramsValues = loadValues.map((lbs) =>
					Math.round(lbs * 453.592),
				)
				rounds.push(...gramsValues)
				return { value: Math.max(...gramsValues), rounds }
			}
			return { value: null, rounds: [] }
		}

		case "meters":
		case "feet": {
			const distanceValues = sets
				.map((s) => s.distance ?? s.score)
				.filter((d): d is number => d !== null)

			if (distanceValues.length > 0) {
				// Convert to millimeters
				const multiplier = scheme === "meters" ? 1000 : 304.8
				const mmValues = distanceValues.map((d) => Math.round(d * multiplier))
				rounds.push(...mmValues)
				return { value: Math.max(...mmValues), rounds }
			}
			return { value: null, rounds: [] }
		}

		case "pass-fail": {
			const statusValues = sets
				.map((s) => (s.status === "pass" ? 1 : 0))
				.filter((v) => v !== null)

			if (statusValues.length > 0) {
				rounds.push(...statusValues)
				return { value: Math.max(...statusValues), rounds }
			}
			return { value: null, rounds: [] }
		}

		default:
			return { value: null, rounds: [] }
	}
}

/**
 * Parse tiebreak score
 * Handles both numeric strings ("120") and time-formatted strings ("2:00")
 */
function parseTiebreak(
	tieBreakScore: string | null,
	tiebreakScheme: string | null,
): { scheme: "time" | "reps" | null; value: number | null } {
	if (!tieBreakScore || !tiebreakScheme) {
		return { scheme: null, value: null }
	}

	if (tiebreakScheme === "time") {
		// Handle both numeric (seconds) and formatted time (MM:SS or M:SS)
		let seconds: number
		if (tieBreakScore.includes(":")) {
			const parts = tieBreakScore.split(":")
			const mins = Number.parseInt(parts[0] ?? "0", 10)
			const secs = Number.parseInt(parts[1] ?? "0", 10)
			if (Number.isNaN(mins) || Number.isNaN(secs)) {
				return { scheme: null, value: null }
			}
			seconds = mins * 60 + secs
		} else {
			seconds = Number.parseInt(tieBreakScore, 10)
			if (Number.isNaN(seconds)) {
				return { scheme: null, value: null }
			}
		}
		// Convert seconds → milliseconds
		return { scheme: "time", value: seconds * 1000 }
	}

	if (tiebreakScheme === "reps") {
		const numValue = Number.parseInt(tieBreakScore, 10)
		if (Number.isNaN(numValue)) {
			return { scheme: null, value: null }
		}
		return { scheme: "reps", value: numValue }
	}

	return { scheme: null, value: null }
}

/**
 * Migrate a single result to the scores table
 */
async function migrateResult(
	result: LegacyResult,
	options: MigrationOptions,
): Promise<{ success: boolean; error?: string }> {
	if (!result.workout) {
		return {
			success: false,
			error: `Result ${result.id} has no associated workout`,
		}
	}

	const { workout, sets: legacySets } = result

	// Convert score
	const { value, rounds } = parseAndConvertWodScore(
		result.wodScore,
		workout.scheme,
		legacySets,
	)

	// Convert status
	const status = convertScoreStatus(result.scoreStatus)
	const statusOrder = getStatusOrder(status)

	// Convert tiebreak
	const tiebreak = parseTiebreak(result.tieBreakScore, workout.tiebreakScheme)

	// Build Score object for sortKey computation
	const scoreObj: Score = {
		scheme: workout.scheme,
		scoreType: workout.scoreType ?? "max",
		value,
		status,
		...(tiebreak.scheme && tiebreak.value
			? {
					tiebreak: {
						scheme: tiebreak.scheme,
						value: tiebreak.value,
					},
				}
			: {}),
	}

	// Compute sortKey
	const sortKey = value !== null ? computeSortKey(scoreObj) : null

	if (options.dryRun) {
		console.log(`[DRY RUN] Would migrate result ${result.id}:`, {
			userId: result.userId,
			workoutId: result.workoutId,
			scheme: workout.scheme,
			legacyWodScore: result.wodScore,
			newValue: value,
			rounds: rounds.length,
			status,
			sortKey: sortKey ? sortKeyToString(sortKey) : null,
		})
		return { success: true }
	}

	try {
		// Insert into scores table with upsert for competition scores
		// (unique constraint on competition_event_id + user_id)
		const scoreValues = {
			userId: result.userId,
			teamId: workout.teamId,
			workoutId: result.workoutId!,
			competitionEventId: result.competitionEventId,
			scheduledWorkoutInstanceId: result.scheduledWorkoutInstanceId,
			scheme: workout.scheme,
			scoreType: workout.scoreType ?? "max",
			scoreValue: value,
			tiebreakScheme: tiebreak.scheme,
			tiebreakValue: tiebreak.value,
			timeCapMs: workout.timeCap ? workout.timeCap * 1000 : null,
			secondaryScheme: null, // TODO: parse from secondaryScore if needed
			secondaryValue: result.secondaryScore
				? Number.parseInt(result.secondaryScore, 10)
				: null,
			status,
			statusOrder,
			sortKey: sortKey ? sortKeyToString(sortKey) : null,
			scalingLevelId: result.scalingLevelId,
			asRx: result.asRx,
			notes: result.notes,
			recordedAt: result.date,
		}

		const [insertedScore] = await db
			.insert(scoresTable)
			.values(scoreValues)
			.onConflictDoUpdate({
				target: [scoresTable.competitionEventId, scoresTable.userId],
				set: scoreValues,
			})
			.returning()

		// Insert rounds if multiple sets
		if (rounds.length > 1) {
			// Delete existing rounds (for re-run scenarios)
			await db
				.delete(scoreRoundsTable)
				.where(eq(scoreRoundsTable.scoreId, insertedScore.id))

			// Insert new rounds
			await db.insert(scoreRoundsTable).values(
				rounds.map((value, index) => ({
					scoreId: insertedScore.id,
					roundNumber: index + 1,
					value,
					schemeOverride: null,
					status: null,
					secondaryValue: null,
					notes: legacySets[index]?.notes ?? null,
				})),
			)
		}

		return { success: true }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * Main migration function
 */
async function main() {
	const options = await parseArgs()

	console.log("🚀 Starting migration: results+sets → scores")
	console.log("Options:", options)
	console.log("")

	// Build query
	let query = db
		.select({
			result: results,
			workout: workouts,
		})
		.from(results)
		.leftJoin(workouts, eq(results.workoutId, workouts.id))
		.$dynamic()

	// Filter to competition results only if requested
	if (options.competitionOnly) {
		query = query.where(isNotNull(results.competitionEventId))
	}

	// Apply limit if specified
	if (options.limit) {
		query = query.limit(options.limit)
	}

	// Fetch results
	console.log("📥 Fetching results from database...")
	const resultsWithWorkouts = await query

	console.log(`Found ${resultsWithWorkouts.length} results to migrate\n`)

	if (resultsWithWorkouts.length === 0) {
		console.log("✅ No results to migrate")
		return
	}

	// Fetch sets for each result
	const resultsToMigrate: LegacyResult[] = []
	for (const row of resultsWithWorkouts) {
		const resultSets = await db
			.select()
			.from(sets)
			.where(eq(sets.resultId, row.result.id))
			.orderBy(sets.setNumber)

		resultsToMigrate.push({
			...row.result,
			sets: resultSets,
			workout: row.workout,
		})
	}

	// Migrate each result
	let successCount = 0
	let errorCount = 0
	const errors: Array<{ resultId: string; error: string }> = []

	console.log("🔄 Migrating results...")
	for (const result of resultsToMigrate) {
		const { success, error } = await migrateResult(result, options)

		if (success) {
			successCount++
		} else {
			errorCount++
			errors.push({ resultId: result.id, error: error ?? "Unknown error" })
		}

		// Progress indicator
		if ((successCount + errorCount) % 100 === 0) {
			console.log(
				`Progress: ${successCount + errorCount}/${resultsToMigrate.length}`,
			)
		}
	}

	// Summary
	console.log("\n" + "=".repeat(60))
	console.log("📊 Migration Summary")
	console.log("=".repeat(60))
	console.log(`Total results:    ${resultsToMigrate.length}`)
	console.log(`✅ Successful:    ${successCount}`)
	console.log(`❌ Errors:        ${errorCount}`)
	console.log("=".repeat(60))

	if (errors.length > 0) {
		console.log("\n❌ Errors encountered:")
		for (const { resultId, error } of errors.slice(0, 10)) {
			console.log(`  - Result ${resultId}: ${error}`)
		}
		if (errors.length > 10) {
			console.log(`  ... and ${errors.length - 10} more`)
		}
	}

	if (options.dryRun) {
		console.log("\n💡 This was a dry run. No data was written to the database.")
		console.log("   Run without --dry-run to perform the actual migration.")
	}
}

main()
	.then(() => {
		console.log("\n✅ Migration complete")
		process.exit(0)
	})
	.catch((error) => {
		console.error("\n❌ Migration failed:", error)
		process.exit(1)
	})
