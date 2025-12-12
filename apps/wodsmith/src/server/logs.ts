import "server-only"
import { createId } from "@paralleldrive/cuid2"
import { fromZonedTime } from "date-fns-tz"
import { asc, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { ZSAError } from "@repo/zsa"
import { getDb } from "@/db"
import {
	programmingTracksTable,
	results,
	scalingGroupsTable,
	scalingLevelsTable,
	sets,
	workouts,
	scoresTable,
	scoreRoundsTable,
	createScoreId,
	createScoreRoundId,
	type WorkoutScheme,
	type ScoreType,
	type TiebreakScheme,
	type ScoreStatusNew,
} from "@/db/schema"
import {
	decodeScore,
	aggregateValues,
	parseScore as libParseScore,
	encodeTimeFromSeconds,
	computeSortKey,
	encodeRoundsRepsFromParts,
} from "@/lib/scoring"
import { convertNewToLegacy } from "@/utils/score-adapter"
import { getActiveOrPersonalTeamId } from "@/utils/auth"
import type {
	ResultSet,
	ResultSetInput,
	Workout,
	WorkoutResultWithWorkoutName,
} from "@/types"
import { requireVerifiedEmail } from "@/utils/auth"
import {
	logError,
	logInfo,
	logWarning,
} from "@/lib/logging/posthog-otel-logger"

// ============================================================================
// ENCODING MIGRATION NOTES - Phase 4
// ============================================================================
//
// This file contains the core score processing logic used by both:
// - submitLogForm (user workout logs)
// - saveCompetitionScore (competition scores)
//
// CURRENT STATE (Phase 3):
// - Scores are stored in results + sets tables with LEGACY encoding:
//   * Time: seconds (not milliseconds)
//   * Rounds+Reps: rounds * 1000 + reps (not rounds * 100000 + reps)
//   * Load: lbs (not grams)
//   * Distance: meters/feet (not millimeters)
//
// FUTURE STATE (Phase 4):
// - Dual-write to new scores + score_rounds tables with NEW encoding:
//   * Time: milliseconds
//   * Rounds+Reps: rounds * 100000 + reps
//   * Load: grams
//   * Distance: millimeters
// - Use encodeScore() and encodeRounds() from @/lib/scoring
// - Populate sortKey column using computeSortKey()
//
// KEY FUNCTIONS TO UPDATE IN PHASE 4:
// - processScoresToSetsAndWodScore(): Add encoding logic
// - addLog(): Dual-write to scores table
// - updateLog(): Update scores table
//
// COMPLEXITY NOTES:
// - This file is 1100+ lines with complex score processing logic
// - Handles multiple workout schemes (time, rounds-reps, load, etc.)
// - Aggregation logic (min, max, sum, average, first, last)
// - Time-capped results need special handling
// - Must maintain backward compatibility during migration
//
// ============================================================================

/* -------------------------------------------------------------------------- */
/*                         Shared Score Processing Types                       */
/* -------------------------------------------------------------------------- */

/**
 * Minimal workout info needed for score processing
 * Used by both submitLogForm and saveCompetitionScore
 */
export interface WorkoutScoreInfo {
	scheme: WorkoutScheme
	scoreType: ScoreType | null
	repsPerRound: number | null
	roundsToScore: number | null
	timeCap: number | null
	tiebreakScheme?: TiebreakScheme | null
}

/**
 * Normalized score entry format
 * Can represent scores from FormData or from direct input
 */
export interface NormalizedScoreEntry {
	/** The raw score string (e.g., "3:45", "150", "5+12") */
	score: string
	/** For rounds+reps: [rounds, reps] */
	parts?: [string, string]
	/** Whether this round hit the time cap */
	timeCapped?: boolean
}

/**
 * Output from processing score entries
 */
export interface ProcessedScoresResult {
	setsForDb: ResultSetInput[]
	totalSecondsForWodScore: number
	wodScore: string
	error?: string
}

/* -------------------------------------------------------------------------- */
/*                         Shared Score Processing Functions                   */
/* -------------------------------------------------------------------------- */

/**
 * Get default scoreType for a scheme
 */
export function getDefaultScoreType(
	scheme: WorkoutScheme | Workout["scheme"],
): string {
	const defaults: Record<string, string> = {
		time: "min",
		"time-with-cap": "min",
		"pass-fail": "first",
		"rounds-reps": "max",
		reps: "max",
		emom: "max",
		load: "max",
		calories: "max",
		meters: "max",
		feet: "max",
		points: "max",
	}
	return defaults[scheme] || "max"
}

/**
 * Apply score aggregation based on scoreType
 * Uses the scoring library's aggregateValues function
 */
export function aggregateScores(
	values: number[],
	scoreType: string,
): number | null {
	return aggregateValues(values, scoreType as ScoreType)
}

/**
 * Process normalized score entries into sets and generate wodScore
 * This is the shared core logic used by both submitLogForm and saveCompetitionScore
 *
 * TODO Phase 4: Add new encoding logic
 * - Call encodeScore() to generate new-format encoded values
 * - Store both legacy (for results+sets) and new (for scores) encodings
 * - Generate sortKey using computeSortKey()
 * - Return additional fields for scores table insertion
 */
export function processScoresToSetsAndWodScore(
	scoreEntries: NormalizedScoreEntry[],
	workout: WorkoutScoreInfo,
): ProcessedScoresResult {
	const setsForDb: ResultSetInput[] = []
	let totalSecondsForWodScore = 0

	const isRoundsAndRepsWorkout =
		workout.scheme === "rounds-reps" ||
		(!!workout.repsPerRound && workout.repsPerRound > 0)
	const isTimeBasedWodScore =
		workout.scheme === "time" || workout.scheme === "time-with-cap"

	// Process each score entry into a set
	for (let k = 0; k < scoreEntries.length; k++) {
		const entry = scoreEntries[k]
		if (!entry) continue
		const setNumber = k + 1

		if (isRoundsAndRepsWorkout) {
			// Rounds + Reps format - store original values for display
			// score = rounds completed, reps = extra reps
			const roundsStr = entry.parts?.[0] || entry.score.split("+")[0] || "0"
			const repsStr = entry.parts?.[1] || entry.score.split("+")[1] || "0"

			const roundsCompleted = parseInt(roundsStr.trim(), 10)
			const repsCompleted = parseInt(repsStr.trim(), 10)

			if (Number.isNaN(roundsCompleted)) {
				continue // Skip invalid entries
			}

			setsForDb.push({
				setNumber,
				score: roundsCompleted,
				reps: Number.isNaN(repsCompleted) ? 0 : repsCompleted,
				weight: null,
				status: null,
				distance: null,
				time: null,
			})
		} else if (isTimeBasedWodScore) {
			const isTimeCapped = entry.timeCapped || false
			const scoreStr = entry.score

			if (!scoreStr || scoreStr.trim() === "") {
				continue // Skip empty entries
			}

			if (workout.scheme === "time-with-cap" && isTimeCapped) {
				// Time capped - expecting reps
				const repsCompleted = parseInt(scoreStr, 10)
				if (!Number.isNaN(repsCompleted) && repsCompleted >= 0) {
					setsForDb.push({
						setNumber,
						reps: repsCompleted,
						time: null,
						weight: null,
						status: null,
						distance: null,
						score: null,
					})
				}
			} else {
				// Regular time score
				// Parse using scoring library (returns milliseconds in new encoding)
				const parseResult = libParseScore(scoreStr, workout.scheme as WorkoutScheme)
				if (parseResult.isValid && parseResult.encoded !== null) {
					// Convert from new encoding (milliseconds) to legacy (seconds) for database
					const timeInSeconds = convertNewToLegacy(
						parseResult.encoded,
						workout.scheme as WorkoutScheme,
					)
					totalSecondsForWodScore += timeInSeconds
					setsForDb.push({
						setNumber,
						time: timeInSeconds,
						reps: null,
						weight: null,
						status: null,
						distance: null,
						score: null,
					})
				}
			}
		} else {
			// For other schemes: reps, load, calories, meters, points, etc.
			const scoreStr = entry.score
			if (!scoreStr || scoreStr.trim() === "") {
				continue // Skip empty entries
			}

			const numericScore = parseInt(scoreStr, 10)
			if (!Number.isNaN(numericScore) && numericScore >= 0) {
				setsForDb.push({
					setNumber,
					score: numericScore,
					reps: null,
					weight: null,
					status: null,
					distance: null,
					time: null,
				})
			}
		}
	}

	// Generate wodScore from the processed sets
	const wodScore = generateWodScoreFromSets(
		setsForDb,
		workout,
		isTimeBasedWodScore,
		isRoundsAndRepsWorkout,
		totalSecondsForWodScore,
		scoreEntries,
	)

	return { setsForDb, totalSecondsForWodScore, wodScore }
}

/**
 * Generate wodScore string from processed sets
 * For rounds+reps: stores total reps
 * For time: stores formatted time string
 * For other schemes: stores the numeric value
 */
export function generateWodScoreFromSets(
	setsForDb: ResultSetInput[],
	workout: WorkoutScoreInfo,
	isTimeBasedWodScore: boolean,
	isRoundsAndRepsWorkout: boolean,
	totalSecondsForWodScore: number,
	scoreEntries: NormalizedScoreEntry[],
): string {
	const effectiveScoreType =
		workout.scoreType || getDefaultScoreType(workout.scheme)
	const roundsToScore = workout.roundsToScore || 1
	const hasTimeCappedRounds = scoreEntries.some((e) => e.timeCapped)
	const shouldAggregate = roundsToScore > 1 && !hasTimeCappedRounds

	// Time-based workouts
	if (isTimeBasedWodScore && !hasTimeCappedRounds) {
		if (shouldAggregate) {
			const timeValues = setsForDb
				.map((set) => set.time)
				.filter((t): t is number => t !== null && t !== undefined && t > 0)
			const aggregated = aggregateScores(timeValues, effectiveScoreType)
			if (aggregated !== null) {
				// Convert legacy (seconds) to new encoding (milliseconds) for formatting
				const encodedMs = encodeTimeFromSeconds(aggregated)
				return decodeScore(encodedMs, workout.scheme as WorkoutScheme)
			}
			return ""
		}
		if (totalSecondsForWodScore > 0) {
			// Convert legacy (seconds) to new encoding (milliseconds) for formatting
			const encodedMs = encodeTimeFromSeconds(totalSecondsForWodScore)
			return decodeScore(encodedMs, workout.scheme as WorkoutScheme)
		}
		return ""
	}

	// Rounds+reps workouts
	if (isRoundsAndRepsWorkout) {
		// For rounds+reps, sets store: score=rounds, reps=extra reps
		// With repsPerRound: calculate total reps = rounds * repsPerRound + extra reps
		// Without repsPerRound: format as "rounds+reps" string
		const repsPerRound = workout.repsPerRound

		if (repsPerRound && repsPerRound > 0) {
			// Calculate total reps for each set
			const totalRepsValues = setsForDb
				.map((set) => {
					const rounds = set.score ?? 0
					const extraReps = set.reps ?? 0
					return rounds * repsPerRound + extraReps
				})
				.filter((r) => r > 0)

			if (shouldAggregate && totalRepsValues.length > 1) {
				const aggregated = aggregateScores(totalRepsValues, effectiveScoreType)
				return aggregated !== null ? aggregated.toString() : ""
			}
			// Single round: return total reps
			if (totalRepsValues.length > 0) {
				return totalRepsValues[0]?.toString() ?? ""
			}
		} else {
			// No repsPerRound - format as "rounds+reps" string
			if (setsForDb.length > 0) {
				const firstSet = setsForDb[0]
				const rounds = firstSet?.score ?? 0
				const extraReps = firstSet?.reps ?? 0
				return `${rounds}+${extraReps}`
			}
		}
		return ""
	}

	// Other schemes with aggregation
	if (shouldAggregate) {
		const scoreValues = setsForDb
			.map((set) => set.reps || set.score || 0)
			.filter((s): s is number => s !== null && s > 0)
		const aggregated = aggregateScores(scoreValues, effectiveScoreType)
		return aggregated !== null ? aggregated.toString() : ""
	}

	// Single round non-time, non-rounds+reps: use the score directly
	if (setsForDb.length > 0) {
		const firstSet = setsForDb[0]
		if (firstSet?.score !== null && firstSet?.score !== undefined) {
			return firstSet.score.toString()
		}
		if (firstSet?.reps !== null && firstSet?.reps !== undefined) {
			return firstSet.reps.toString()
		}
	}

	// Fallback: join raw scores
	return scoreEntries
		.map((e) => e.score)
		.filter((s) => s && s.trim() !== "")
		.join(", ")
}

/* -------------------------------------------------------------------------- */
/*                         New Scores Table Helpers                            */
/* -------------------------------------------------------------------------- */

/**
 * Status order mapping for sorting
 */
const STATUS_ORDER: Record<ScoreStatusNew, number> = {
	scored: 0,
	cap: 1,
	dq: 2,
	withdrawn: 3,
}

/**
 * Encode a single set's value for the new scores table
 * Converts from legacy encoding to new encoding:
 * - Time: seconds -> milliseconds
 * - Rounds+Reps: already stored as score=rounds, reps=extra -> rounds*100000+reps
 * - Load: lbs -> grams (multiply by ~453.592)
 * - Others: integer as-is
 */
export function encodeSetForNewTable(
	set: ResultSetInput,
	scheme: WorkoutScheme,
): number | null {
	switch (scheme) {
		case "time":
		case "time-with-cap":
		case "emom":
			// Legacy stores seconds, new table needs milliseconds
			if (set.time !== null && set.time !== undefined) {
				return set.time * 1000
			}
			return null

		case "rounds-reps":
			// Legacy stores score=rounds, reps=extra reps
			// New encoding: rounds * 100000 + reps
			if (set.score !== null && set.score !== undefined) {
				const rounds = set.score
				const extraReps = set.reps ?? 0
				return encodeRoundsRepsFromParts(rounds, extraReps)
			}
			return null

		case "load":
			// Legacy stores lbs, new table stores grams
			// Note: For now, assume lbs and convert to grams
			if (set.weight !== null && set.weight !== undefined) {
				return Math.round(set.weight * 453.592)
			}
			if (set.score !== null && set.score !== undefined) {
				return Math.round(set.score * 453.592)
			}
			return null

		case "meters":
		case "feet":
			// Legacy stores meters/feet, new table stores millimeters
			if (set.distance !== null && set.distance !== undefined) {
				// Assume meters, convert to mm
				return Math.round(set.distance * 1000)
			}
			return null

		case "reps":
		case "calories":
		case "points":
			// Integer values stored as-is
			if (set.reps !== null && set.reps !== undefined) {
				return set.reps
			}
			if (set.score !== null && set.score !== undefined) {
				return set.score
			}
			return null

		case "pass-fail":
			// 1 = pass, 0 = fail
			if (set.status === "pass") return 1
			if (set.status === "fail") return 0
			if (set.score !== null && set.score !== undefined) return set.score > 0 ? 1 : 0
			return null

		default:
			return null
	}
}

/**
 * Prepare data for inserting into the new scores table
 */
export interface NewScoreData {
	scoreValue: number | null
	status: ScoreStatusNew
	statusOrder: number
	sortKey: string | null
	roundValues: number[] // For score_rounds table
}

/**
 * Process sets into data for the new scores table
 */
export function prepareNewScoreData(
	setsForDb: ResultSetInput[],
	workout: WorkoutScoreInfo,
	hasTimeCappedRounds: boolean,
): NewScoreData {
	const scheme = workout.scheme as WorkoutScheme
	const effectiveScoreType =
		(workout.scoreType as ScoreType) || getDefaultScoreType(scheme)

	// Encode each round
	const roundValues: number[] = []
	for (const set of setsForDb) {
		const encoded = encodeSetForNewTable(set, scheme)
		if (encoded !== null) {
			roundValues.push(encoded)
		}
	}

	// Determine status
	let status: ScoreStatusNew = "scored"
	if (hasTimeCappedRounds) {
		status = "cap"
	}

	// Aggregate to get the primary score value
	let scoreValue: number | null = null
	if (roundValues.length > 0) {
		if (roundValues.length === 1) {
			scoreValue = roundValues[0] ?? null
		} else {
			scoreValue = aggregateValues(roundValues, effectiveScoreType)
		}
	}

	// Compute sort key
	let sortKey: string | null = null
	if (scoreValue !== null || status !== "scored") {
		const sortKeyBigInt = computeSortKey({
			value: scoreValue,
			status,
			scheme,
			scoreType: effectiveScoreType,
		})
		sortKey = sortKeyBigInt.toString()
	}

	return {
		scoreValue,
		status,
		statusOrder: STATUS_ORDER[status],
		sortKey,
		roundValues,
	}
}

/**
 * Convert FormData parsed score entries to normalized format
 */
export function normalizeScoreEntries(
	parsedScoreEntries: Array<{ parts: string[] }>,
	timeCappedEntries: boolean[] = [],
): NormalizedScoreEntry[] {
	return parsedScoreEntries.map((entry, index) => {
		const parts = entry.parts
		const hasTwoParts = parts.length >= 2

		return {
			score: hasTwoParts
				? `${parts[0] || "0"}+${parts[1] || "0"}`
				: parts[0] || "",
			parts: hasTwoParts ? [parts[0] || "0", parts[1] || "0"] : undefined,
			timeCapped: timeCappedEntries[index] || false,
		}
	})
}
// Map legacy scale enum to { scalingLevelId, asRx } using available scaling group context
export async function mapLegacyScaleToScalingLevel({
	workoutId,
	programmingTrackId,
	scale,
}: {
	workoutId: string
	programmingTrackId?: string | null
	scale: "rx" | "scaled" | "rx+"
}): Promise<{ scalingLevelId: string; asRx: boolean }> {
	const db = getDb()

	// Resolution: workout -> track -> global system
	let resolvedGroupId: string | null = null

	const [w] = await db
		.select({ scalingGroupId: workouts.scalingGroupId })
		.from(workouts)
		.where(eq(workouts.id, workoutId))
	resolvedGroupId = w?.scalingGroupId ?? null

	if (!resolvedGroupId && programmingTrackId) {
		const [t] = await db
			.select({ scalingGroupId: programmingTracksTable.scalingGroupId })
			.from(programmingTracksTable)
			.where(eq(programmingTracksTable.id, programmingTrackId))
		resolvedGroupId = t?.scalingGroupId ?? null
	}

	if (!resolvedGroupId) {
		const [g] = await db
			.select({ id: scalingGroupsTable.id })
			.from(scalingGroupsTable)
			.where(eq(scalingGroupsTable.isSystem, 1))
			.limit(1)
		resolvedGroupId = g?.id ?? null
	}

	if (!resolvedGroupId) {
		throw new ZSAError("ERROR", "No scaling group available for workout")
	}

	const levels = await db
		.select({
			id: scalingLevelsTable.id,
			position: scalingLevelsTable.position,
		})
		.from(scalingLevelsTable)
		.where(eq(scalingLevelsTable.scalingGroupId, resolvedGroupId))
		.orderBy(asc(scalingLevelsTable.position))

	if (levels.length === 0) {
		throw new ZSAError("ERROR", "No scaling levels found for group")
	}

	// Legacy mapping by position preference
	let desiredPosition: number
	let asRx: boolean
	if (scale === "rx+") {
		desiredPosition = 0
		asRx = true
	} else if (scale === "rx") {
		desiredPosition = 1
		asRx = true
	} else {
		desiredPosition = levels[levels.length - 1]?.position ?? levels.length - 1
		asRx = false
	}

	// Find exact match, else nearest
	let chosen = levels.find((l) => l.position === desiredPosition)
	if (!chosen) {
		// nearest by absolute difference
		chosen = levels.reduce((prev, curr) => {
			const prevDiff = Math.abs(prev.position - desiredPosition)
			const currDiff = Math.abs(curr.position - desiredPosition)
			return currDiff < prevDiff ? curr : prev
		})
	}

	return { scalingLevelId: chosen.id, asRx }
}

/**
 * Get all logs by user ID with workout names and scaling level details
 */
export async function getLogsByUser(
	userId: string,
): Promise<WorkoutResultWithWorkoutName[]> {
	const db = getDb()
	logInfo({
		message: "[getLogsByUser] Fetching logs for user",
		attributes: { userId },
	})

	try {
		const logs = await db
			.select({
				id: results.id,
				userId: results.userId,
				date: results.date,
				workoutId: results.workoutId,
				type: results.type,
				notes: results.notes,
				scale: results.scale,
				scalingLevelId: results.scalingLevelId,
				asRx: results.asRx,
				scalingLevelLabel: scalingLevelsTable.label,
				scalingLevelPosition: scalingLevelsTable.position,
				wodScore: results.wodScore,
				setCount: results.setCount,
				distance: results.distance,
				time: results.time,
				createdAt: results.createdAt,
				updatedAt: results.updatedAt,
				updateCounter: results.updateCounter,
				workoutName: workouts.name,
			})
			.from(results)
			.leftJoin(workouts, eq(results.workoutId, workouts.id))
			.leftJoin(
				scalingLevelsTable,
				eq(results.scalingLevelId, scalingLevelsTable.id),
			)
			.where(eq(results.userId, userId))
			.orderBy(desc(results.date))

		logInfo({
			message: "[getLogsByUser] Fetched logs for user",
			attributes: { userId, count: logs.length },
		})
		return logs.map((log) => ({
			...log,
			workoutName: log.workoutName || undefined,
			scalingLevelLabel: log.scalingLevelLabel || undefined,
			scalingLevelPosition: log.scalingLevelPosition ?? undefined,
		})) as WorkoutResultWithWorkoutName[]
	} catch (error) {
		logError({
			message: "[getLogsByUser] Error fetching logs for user",
			error,
			attributes: { userId },
		})
		return []
	}
}

/**
 * Add a new log entry with sets
 *
 * Phase 4: Dual-writes to both legacy (results+sets) and new (scores+score_rounds) tables.
 * The new scores table uses proper encoding (milliseconds for time, grams for load, etc.)
 */
export async function addLog({
	userId,
	teamId,
	workoutId,
	date,
	scalingLevelId,
	asRx,
	wodScore,
	notes,
	setsData,
	type,
	scheduledWorkoutInstanceId,
	programmingTrackId,
	workoutInfo,
	hasTimeCappedRounds = false,
}: {
	userId: string
	teamId: string
	workoutId: string
	date: number
	scalingLevelId: string
	asRx: boolean
	wodScore: string
	notes: string
	setsData: ResultSetInput[]
	type: "wod" | "strength" | "monostructural"
	scheduledWorkoutInstanceId?: string | null
	programmingTrackId?: string | null
	workoutInfo?: WorkoutScoreInfo // Required for new scores table encoding
	hasTimeCappedRounds?: boolean
}): Promise<{ success: boolean; resultId?: string; scoreId?: string; error?: string }> {
	logInfo({
		message: "[addLog] Start",
		attributes: {
			userId,
			teamId,
			workoutId,
			date,
			scalingLevelId,
			asRx,
			wodScore,
			notesPresent: Boolean(notes),
			setsCount: setsData.length,
			type,
			scheduledWorkoutInstanceId,
			programmingTrackId,
			hasWorkoutInfo: !!workoutInfo,
		},
	})

	const session = await requireVerifiedEmail()
	if (!session) {
		logError({
			message: "[addLog] No session found - not authenticated",
			attributes: { userId, workoutId },
		})
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	let db: ReturnType<typeof getDb>
	try {
		db = getDb()
	} catch (error) {
		logError({
			message: "[addLog] Failed to get database connection",
			error,
		})
		return { success: false, error: "Database connection failed" }
	}

	const resultId = `result_${createId()}`
	const scoreId = createScoreId()

	try {
		// ========================================
		// 1. Insert into legacy results table
		// ========================================
		const insertData = {
			id: resultId,
			userId,
			workoutId,
			date: new Date(date),
			type,
			scale: null, // legacy field deprecated
			scalingLevelId,
			asRx,
			wodScore,
			notes: notes || null,
			setCount: setsData.length || null,
			scheduledWorkoutInstanceId: scheduledWorkoutInstanceId || null,
			programmingTrackId: programmingTrackId || null,
		}

		const insertResult = await db.insert(results).values(insertData).returning()
		logInfo({
			message: "[addLog] Legacy result inserted",
			attributes: { resultId, insertCount: insertResult.length },
		})

		// ========================================
		// 2. Insert into legacy sets table
		// ========================================
		if (setsData.length > 0) {
			const setsToInsert = setsData.map((set) => ({
				id: `set_${createId()}`,
				resultId,
				setNumber: set.setNumber,
				reps: set.reps || null,
				weight: set.weight || null,
				distance: set.distance || null,
				time: set.time || null,
				score: set.score || null,
				status: set.status || null,
			}))

			const setsInsertResult = await db
				.insert(sets)
				.values(setsToInsert)
				.returning()
			logInfo({
				message: "[addLog] Legacy sets inserted",
				attributes: {
					resultId,
					insertedSets: setsToInsert.length,
					returned: setsInsertResult.length,
				},
			})
		}

		// ========================================
		// 3. Insert into new scores table (dual-write)
		// ========================================
		if (workoutInfo && type === "wod") {
			try {
				const newScoreData = prepareNewScoreData(
					setsData,
					workoutInfo,
					hasTimeCappedRounds,
				)

				const scoreInsertData = {
					id: scoreId,
					userId,
					teamId,
					workoutId,
					scheme: workoutInfo.scheme as WorkoutScheme,
					scoreType: (workoutInfo.scoreType || getDefaultScoreType(workoutInfo.scheme)) as ScoreType,
					scoreValue: newScoreData.scoreValue,
					status: newScoreData.status,
					statusOrder: newScoreData.statusOrder,
					sortKey: newScoreData.sortKey,
					scalingLevelId,
					asRx,
					notes: notes || null,
					recordedAt: new Date(date),
					scheduledWorkoutInstanceId: scheduledWorkoutInstanceId || null,
					timeCapMs: workoutInfo.timeCap ? workoutInfo.timeCap * 1000 : null,
				}

				await db.insert(scoresTable).values(scoreInsertData)
				logInfo({
					message: "[addLog] New score inserted",
					attributes: {
						scoreId,
						scoreValue: newScoreData.scoreValue,
						status: newScoreData.status,
						sortKey: newScoreData.sortKey,
					},
				})

				// Insert score rounds if multi-round
				if (newScoreData.roundValues.length > 1) {
					const roundsToInsert = newScoreData.roundValues.map((value, idx) => ({
						id: createScoreRoundId(),
						scoreId,
						roundNumber: idx + 1,
						value,
					}))

					await db.insert(scoreRoundsTable).values(roundsToInsert)
					logInfo({
						message: "[addLog] Score rounds inserted",
						attributes: {
							scoreId,
							roundCount: roundsToInsert.length,
						},
					})
				}
			} catch (scoreError) {
				// Log but don't fail - legacy tables are source of truth during migration
				logError({
					message: "[addLog] Failed to insert into new scores table (non-fatal)",
					error: scoreError,
					attributes: { scoreId, workoutId, userId },
				})
			}
		}

		logInfo({
			message: "[addLog] Success",
			attributes: { resultId, scoreId, workoutId, userId },
		})
		return { success: true, resultId, scoreId }
	} catch (error) {
		logError({
			message: "[addLog] Error adding log",
			error,
			attributes: { userId, workoutId, resultId },
		})
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Failed to add log" }
	}
}

/**
 * Get result sets by result ID
 */
export async function getResultSetsById(
	resultId: string,
): Promise<ResultSet[]> {
	const db = getDb()
	logInfo({
		message: "[getResultSetsById] Fetching sets",
		attributes: { resultId },
	})

	try {
		const setDetails = await db
			.select()
			.from(sets)
			.where(eq(sets.resultId, resultId))
			.orderBy(sets.setNumber)

		logInfo({
			message: "[getResultSetsById] Found sets",
			attributes: { resultId, count: setDetails.length },
		})
		return setDetails
	} catch (error) {
		logError({
			message: "[getResultSetsById] Error fetching sets",
			error,
			attributes: { resultId },
		})
		return []
	}
}

/**
 * Get a single result by ID with workout details and scaling level
 */
export async function getResultById(resultId: string) {
	const db = getDb()
	logInfo({
		message: "[getResultById] Fetching result",
		attributes: { resultId },
	})

	try {
		const [result] = await db
			.select({
				id: results.id,
				userId: results.userId,
				date: results.date,
				workoutId: results.workoutId,
				type: results.type,
				notes: results.notes,
				scale: results.scale,
				scalingLevelId: results.scalingLevelId,
				asRx: results.asRx,
				scalingLevelLabel: scalingLevelsTable.label,
				scalingLevelPosition: scalingLevelsTable.position,
				wodScore: results.wodScore,
				setCount: results.setCount,
				distance: results.distance,
				time: results.time,
				createdAt: results.createdAt,
				updatedAt: results.updatedAt,
				updateCounter: results.updateCounter,
				scheduledWorkoutInstanceId: results.scheduledWorkoutInstanceId,
				programmingTrackId: results.programmingTrackId,
				workoutName: workouts.name,
				workoutScheme: workouts.scheme,
				workoutRepsPerRound: workouts.repsPerRound,
				workoutRoundsToScore: workouts.roundsToScore,
			})
			.from(results)
			.leftJoin(workouts, eq(results.workoutId, workouts.id))
			.leftJoin(
				scalingLevelsTable,
				eq(results.scalingLevelId, scalingLevelsTable.id),
			)
			.where(eq(results.id, resultId))
			.limit(1)

		if (!result) {
			logWarning({
				message: "[getResultById] No result found",
				attributes: { resultId },
			})
			return null
		}

		logInfo({
			message: "[getResultById] Found result",
			attributes: { resultId, workoutId: result.workoutId },
		})
		return result
	} catch (error) {
		logError({
			message: "[getResultById] Error fetching result",
			error,
			attributes: { resultId },
		})
		return null
	}
}

/**
 * Update an existing result with sets
 *
 * TODO Phase 4: Add dual-write to scores table
 * Currently only updates the legacy results+sets tables.
 * The new scores table doesn't have a direct link to results, so we would need to:
 * 1. Look up the score by (userId, workoutId, recordedAt) to find matching score
 * 2. Update or delete/recreate the score record
 * This is deferred until we establish a migration strategy.
 */
export async function updateResult({
	resultId,
	userId,
	workoutId,
	date,
	scalingLevelId,
	asRx,
	wodScore,
	notes,
	setsData,
	type,
	scheduledWorkoutInstanceId,
	programmingTrackId,
}: {
	resultId: string
	userId: string
	workoutId: string
	date: number
	scalingLevelId: string
	asRx: boolean
	wodScore: string
	notes: string
	setsData: ResultSetInput[]
	type: "wod" | "strength" | "monostructural"
	scheduledWorkoutInstanceId?: string | null
	programmingTrackId?: string | null
}): Promise<void> {
	const session = await requireVerifiedEmail()
	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDb()

	logInfo({
		message: "[updateResult] Updating result",
		attributes: { resultId, userId, workoutId, setsCount: setsData.length },
	})

	try {
		// Update the main result
		await db
			.update(results)
			.set({
				workoutId,
				date: new Date(date),
				type,
				scale: null,
				scalingLevelId,
				asRx,
				wodScore,
				notes: notes || null,
				setCount: setsData.length || null,
				scheduledWorkoutInstanceId: scheduledWorkoutInstanceId || null,
				programmingTrackId: programmingTrackId || null,
				updatedAt: new Date(),
			})
			.where(eq(results.id, resultId))

		// Delete existing sets
		await db.delete(sets).where(eq(sets.resultId, resultId))

		// Insert new sets if any
		if (setsData.length > 0) {
			const setsToInsert = setsData.map((set) => ({
				id: `set_${createId()}`,
				resultId,
				setNumber: set.setNumber,
				reps: set.reps || null,
				weight: set.weight || null,
				distance: set.distance || null,
				time: set.time || null,
				score: set.score || null,
				status: set.status || null,
			}))

			await db.insert(sets).values(setsToInsert)
			logInfo({
				message: "[updateResult] Inserted replacement sets",
				attributes: { resultId, insertedSets: setsToInsert.length },
			})
		}

		logInfo({
			message: "[updateResult] Success",
			attributes: { resultId, workoutId, userId },
		})
	} catch (error) {
		logError({
			message: "[updateResult] Error updating result",
			error,
			attributes: { resultId, workoutId, userId },
		})
		throw error
	}
}

// Form submission logic moved from actions.ts

interface BasicFormData {
	selectedWorkoutId: string | null
	dateStr: string
	scaleValue: "rx" | "scaled" | "rx+"
	notesValue: string
	redirectUrl: string | null
	scheduledInstanceId: string | null
	programmingTrackId: string | null
}

function parseBasicFormData(formData: FormData): BasicFormData {
	const selectedWorkoutId = formData.get("selectedWorkoutId") as string | null
	const dateStr = formData.get("date") as string
	const scaleValue = formData.get("scale") as "rx" | "scaled" | "rx+"
	const notesValue = formData.get("notes") as string
	const redirectUrl = formData.get("redirectUrl") as string | null
	const scheduledInstanceId = formData.get("scheduledInstanceId") as
		| string
		| null
	const programmingTrackId = formData.get("programmingTrackId") as string | null
	return {
		selectedWorkoutId,
		dateStr,
		scaleValue,
		notesValue,
		redirectUrl,
		scheduledInstanceId,
		programmingTrackId,
	}
}

function parseScoreEntries(formData: FormData): Array<{ parts: string[] }> {
	const parsedScoreEntries: Array<{ parts: string[] }> = []
	let roundIdx = 0
	// Check for scores like scores[0][0], scores[0][1], scores[1][0] etc.
	while (formData.has(`scores[${roundIdx}][0]`)) {
		const parts: string[] = []
		let partIdx = 0
		while (formData.has(`scores[${roundIdx}][${partIdx}]`)) {
			parts.push(
				(formData.get(`scores[${roundIdx}][${partIdx}]`) as string) || "",
			)
			partIdx++
		}
		if (parts.length > 0) {
			parsedScoreEntries.push({ parts })
		}
		roundIdx++
	}
	return parsedScoreEntries
}

function parseTimeCappedEntries(formData: FormData): boolean[] {
	const timeCappedEntries: boolean[] = []
	let roundIdx = 0
	// Check for timeCapped like timeCapped[0], timeCapped[1], etc.
	while (formData.has(`timeCapped[${roundIdx}]`)) {
		const isTimeCapped = formData.get(`timeCapped[${roundIdx}]`) === "true"
		timeCappedEntries.push(isTimeCapped)
		roundIdx++
	}
	return timeCappedEntries
}

function validateParsedScores(
	parsedScoreEntries: Array<{ parts: string[] }>,
	workoutScheme: Workout["scheme"],
): { error?: string } | undefined {
	const atLeastOneScorePartFilled = parsedScoreEntries.some((entry) =>
		entry.parts.some((part) => part.trim() !== ""),
	)

	if (parsedScoreEntries.length === 0 || !atLeastOneScorePartFilled) {
		if (workoutScheme !== undefined) {
			// N/A scheme might not require scores
			logWarning({
				message:
					"[submitLogForm] No valid score parts provided for a workout that expects scores",
			})
			return {
				error: "At least one score input is required and must not be empty.",
			}
		}
	}
	return undefined // Explicitly return undefined if no error
}

function validateProcessedSets(
	setsForDb: ResultSetInput[],
	workoutScheme: Workout["scheme"],
	atLeastOneScorePartFilled: boolean,
): { error?: string } | undefined {
	if (
		setsForDb.length === 0 &&
		workoutScheme !== undefined &&
		atLeastOneScorePartFilled
	) {
		logWarning({
			message:
				"[submitLogForm] Score entries produced no valid sets despite input",
		})
		return {
			error:
				"Valid score information is required. Please check your inputs for each round/set.",
		}
	}
	if (
		setsForDb.length === 0 &&
		workoutScheme !== undefined &&
		!atLeastOneScorePartFilled
	) {
		logWarning({
			message:
				"[submitLogForm] No score entries provided for workout that expects scores",
		})
		return {
			error: "At least one score input is required and must not be empty.",
		}
	}
	return undefined
}

async function submitLogToDatabase(
	userId: string,
	selectedWorkoutId: string,
	dateStr: string,
	timezone: string,
	scaleValue: "rx" | "scaled" | "rx+",
	finalWodScoreSummary: string,
	notesValue: string,
	setsForDb: ResultSetInput[],
	workoutInfo: WorkoutScoreInfo,
	hasTimeCappedRounds: boolean,
	scheduledInstanceId?: string | null,
	programmingTrackId?: string | null,
) {
	logInfo({
		message: "[submitLogToDatabase] Start",
		attributes: {
			userId,
			workoutId: selectedWorkoutId,
			date: dateStr,
			timezone,
			scale: scaleValue,
			wodScoreSummary: finalWodScoreSummary,
			notesPresent: Boolean(notesValue),
			setsCount: setsForDb.length,
			scheduledInstanceId,
			programmingTrackId,
		},
	})

	try {
		const dateInTargetTz = fromZonedTime(`${dateStr}T00:00:00`, timezone)
		const timestamp = dateInTargetTz.getTime()

		// Get user's active team for the new scores table
		const teamId = await getActiveOrPersonalTeamId(userId)

		// Map legacy scale to new scaling fields
		const { scalingLevelId, asRx } = await mapLegacyScaleToScalingLevel({
			workoutId: selectedWorkoutId,
			programmingTrackId,
			scale: scaleValue,
		})

		const result = await addLog({
			userId,
			teamId,
			workoutId: selectedWorkoutId,
			date: timestamp,
			scalingLevelId,
			asRx,
			wodScore: finalWodScoreSummary,
			notes: notesValue,
			setsData: setsForDb,
			type: "wod",
			scheduledWorkoutInstanceId: scheduledInstanceId,
			programmingTrackId: programmingTrackId,
			workoutInfo,
			hasTimeCappedRounds,
		})

		if (!result.success) {
			logError({
				message: "[submitLogToDatabase] Failed to add log",
				attributes: { userId, workoutId: selectedWorkoutId },
			})
			return { error: result.error || "Failed to save log" }
		}

		logInfo({
			message: "[submitLogToDatabase] Success",
			attributes: { resultId: result.resultId, scoreId: result.scoreId, workoutId: selectedWorkoutId },
		})
		return { success: true, resultId: result.resultId, scoreId: result.scoreId }
	} catch (error) {
		logError({
			message: "[submitLogToDatabase] Error saving log",
			error,
			attributes: { userId, workoutId: selectedWorkoutId },
		})
		return {
			error: `Failed to save log: ${
				error instanceof Error ? error.message : String(error)
			}`,
		}
	}
}

export async function submitLogForm(
	userId: string,
	workouts: Workout[],
	formData: FormData,
) {
	logInfo({
		message: "[submitLogForm] Start",
		attributes: {
			userId,
			workoutsCount: workouts.length,
		},
	})

	const headerList = await headers()
	const timezone = headerList.get("x-vercel-ip-timezone") ?? "America/Denver"
	const {
		selectedWorkoutId,
		dateStr,
		scaleValue,
		notesValue,
		scheduledInstanceId,
		programmingTrackId,
	} = parseBasicFormData(formData)

	if (!selectedWorkoutId) {
		logError({
			message: "[submitLogForm] No workout selected",
			attributes: { userId },
		})
		return { error: "No workout selected. Please select a workout." }
	}

	const workout = workouts.find((w) => w.id === selectedWorkoutId)

	if (!workout) {
		logError({
			message: "[submitLogForm] Workout not found for ID",
			attributes: { selectedWorkoutId, userId },
		})
		return { error: "Selected workout not found. Please try again." }
	}

	const parsedScoreEntries = parseScoreEntries(formData)
	const timeCappedEntries = parseTimeCappedEntries(formData)

	const validationError = validateParsedScores(
		parsedScoreEntries,
		workout.scheme,
	)
	if (validationError) {
		return validationError
	}

	const atLeastOneScorePartFilled = parsedScoreEntries.some((entry) =>
		entry.parts.some((part) => part.trim() !== ""),
	)

	// Convert to normalized format and process using shared function
	const normalizedEntries = normalizeScoreEntries(
		parsedScoreEntries,
		timeCappedEntries,
	)

	const workoutInfo: WorkoutScoreInfo = {
		scheme: workout.scheme as WorkoutScheme,
		scoreType: workout.scoreType as ScoreType | null,
		repsPerRound: workout.repsPerRound ?? null,
		roundsToScore: workout.roundsToScore ?? null,
		timeCap: workout.timeCap ?? null,
	}

	const { setsForDb, wodScore } = processScoresToSetsAndWodScore(
		normalizedEntries,
		workoutInfo,
	)

	const processedSetsValidationError = validateProcessedSets(
		setsForDb,
		workout.scheme,
		atLeastOneScorePartFilled,
	)
	if (processedSetsValidationError) {
		return processedSetsValidationError
	}

	// Check if any rounds are time-capped
	const hasTimeCappedRounds = timeCappedEntries.some((capped) => capped)

	return submitLogToDatabase(
		userId,
		selectedWorkoutId,
		dateStr,
		timezone,
		scaleValue,
		wodScore,
		notesValue,
		setsForDb,
		workoutInfo,
		hasTimeCappedRounds,
		scheduledInstanceId,
		programmingTrackId,
	)
}
