import "server-only"
import { ZSAError } from "@repo/zsa"
import { fromZonedTime } from "date-fns-tz"
import { asc, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { getDb } from "@/db"
import {
	createScoreId,
	createScoreRoundId,
	programmingTracksTable,
	type ScoreStatusNew,
	type ScoreType,
	scalingGroupsTable,
	scalingLevelsTable,
	scoreRoundsTable,
	scoresTable,
	type TiebreakScheme,
	type WorkoutScheme,
	workouts,
} from "@/db/schema"
import {
	logError,
	logInfo,
	logWarning,
} from "@/lib/logging/posthog-otel-logger"
import {
	aggregateValues,
	computeSortKey,
	decodeScore,
	encodeRoundsReps,
	encodeRoundsRepsFromParts,
	encodeTimeFromSeconds,
	extractRoundsReps,
	GRAMS_PER_UNIT,
	parseScore as libParseScore,
	MM_PER_UNIT,
} from "@/lib/scoring"
import type {
	ResultSet,
	ResultSetInput,
	Workout,
	WorkoutResultWithWorkoutName,
} from "@/types"
import { getActiveOrPersonalTeamId, requireVerifiedEmail } from "@/utils/auth"
import { parseScore as parseScoreInput } from "@/utils/score-parser-new"

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
 * Input for a single round/score entry
 */
export interface ScoreEntryInput {
	/** The raw score string (e.g., "3:45", "150", "5+12") */
	raw: string
	/** Whether this round hit the time cap */
	isCapped?: boolean
}

/**
 * Output from processing score entries - ready for scores/score_rounds tables
 */
export interface ProcessedScoreResult {
	/** Aggregated score value (encoded) */
	scoreValue: number | null
	/** Individual round values (encoded) */
	roundValues: number[]
	/** Score status */
	status: ScoreStatusNew
	/** Status order for sorting */
	statusOrder: number
	/** Computed sort key */
	sortKey: string | null
	/** Display string for the score */
	displayScore: string
}

// Legacy types - kept for backward compatibility during migration
/**
 * @deprecated Use ScoreEntryInput instead
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
 * @deprecated Use ProcessedScoreResult instead
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
			// Rounds + Reps format - use scoring library to parse
			// Supports "5+12", "5.12", or plain "5" (complete rounds)
			let rounds: number
			let reps: number

			if (entry.parts?.[0] !== undefined && entry.parts?.[1] !== undefined) {
				// Use pre-parsed parts if available
				rounds = parseInt(entry.parts[0].trim(), 10)
				reps = parseInt(entry.parts[1].trim(), 10)
				if (Number.isNaN(rounds)) continue
				if (Number.isNaN(reps)) reps = 0
			} else {
				// Use scoring library to encode, then extract rounds/reps
				const encoded = encodeRoundsReps(entry.score)
				if (encoded === null) continue
				const extracted = extractRoundsReps(encoded)
				rounds = extracted.rounds
				reps = extracted.reps
			}

			setsForDb.push({
				setNumber,
				score: rounds,
				reps: reps,
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
				// Use timePrecision: "seconds" so "60" → 60 seconds (1:00), not invalid "0:60"
				const parseResult = libParseScore(
					scoreStr,
					workout.scheme as WorkoutScheme,
					{ timePrecision: "seconds" },
				)
				if (parseResult.isValid && parseResult.encoded !== null) {
					// Store time in milliseconds (new encoding)
					const timeInMs = parseResult.encoded
					totalSecondsForWodScore += timeInMs / 1000 // For wodScore display string
					setsForDb.push({
						setNumber,
						time: timeInMs,
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

/* -------------------------------------------------------------------------- */
/*                    New Direct Score Processing (v2)                         */
/* -------------------------------------------------------------------------- */

/**
 * Process score entries directly to the new scores/score_rounds format.
 * This is the clean replacement for processScoresToSetsAndWodScore + prepareNewScoreData.
 *
 * @param entries - Raw score entries from user input
 * @param workout - Workout info for encoding
 * @returns ProcessedScoreResult ready for database insertion
 */
export function processScoreEntries(
	entries: ScoreEntryInput[],
	workout: WorkoutScoreInfo,
): ProcessedScoreResult {
	const scheme = workout.scheme as WorkoutScheme
	const scoreType = (workout.scoreType ||
		getDefaultScoreType(scheme)) as ScoreType

	// Encode each entry directly to the new format
	const roundValues: number[] = []

	for (const entry of entries) {
		if (!entry.raw || entry.raw.trim() === "") continue

		const encoded = encodeEntryValue(entry.raw, scheme)
		if (encoded !== null) {
			roundValues.push(encoded)
		}
	}

	// Determine status
	const hasCappedEntries = entries.some((e) => e.isCapped)
	const status: ScoreStatusNew = hasCappedEntries ? "cap" : "scored"
	const statusOrder = STATUS_ORDER[status]

	// Aggregate to get primary score value
	let scoreValue: number | null = null
	if (roundValues.length === 1) {
		scoreValue = roundValues[0] ?? null
	} else if (roundValues.length > 1) {
		scoreValue = aggregateValues(roundValues, scoreType)
	}

	// Compute sort key
	let sortKey: string | null = null
	if (scoreValue !== null || status !== "scored") {
		const sortKeyBigInt = computeSortKey({
			value: scoreValue,
			status,
			scheme,
			scoreType,
		})
		sortKey = sortKeyBigInt.toString()
	}

	// Generate display string
	const displayScore =
		scoreValue !== null
			? decodeScore(scoreValue, scheme, { includeUnit: true })
			: ""

	return {
		scoreValue,
		roundValues,
		status,
		statusOrder,
		sortKey,
		displayScore,
	}
}

/**
 * Encode a single raw score entry to the new format.
 * Uses the scoring library's parseScore for proper encoding.
 *
 * For time-based schemes, uses timePrecision: "seconds" so plain numbers
 * like "60" are interpreted as 60 seconds (1:00), not as MM:SS format.
 */
function encodeEntryValue(raw: string, scheme: WorkoutScheme): number | null {
	const parseResult = libParseScore(raw, scheme, { timePrecision: "seconds" })
	if (parseResult.isValid && parseResult.encoded !== null) {
		return parseResult.encoded
	}
	return null
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
			// ResultSetInput.time is stored as milliseconds (new encoding)
			if (set.time !== null && set.time !== undefined) {
				return set.time
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
				return Math.round(set.weight * GRAMS_PER_UNIT.lbs)
			}
			if (set.score !== null && set.score !== undefined) {
				return Math.round(set.score * GRAMS_PER_UNIT.lbs)
			}
			return null

		case "meters":
			// Legacy stores meters, new table stores millimeters
			if (set.distance !== null && set.distance !== undefined) {
				return Math.round(set.distance * MM_PER_UNIT.m)
			}
			if (set.score !== null && set.score !== undefined) {
				return Math.round(set.score * MM_PER_UNIT.m)
			}
			return null

		case "feet":
			// Legacy stores feet, new table stores millimeters
			if (set.distance !== null && set.distance !== undefined) {
				return Math.round(set.distance * MM_PER_UNIT.ft)
			}
			if (set.score !== null && set.score !== undefined) {
				return Math.round(set.score * MM_PER_UNIT.ft)
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
			if (set.score !== null && set.score !== undefined)
				return set.score > 0 ? 1 : 0
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
 * Get all logs (scores) by user ID with workout names and scaling level details
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
				id: scoresTable.id,
				userId: scoresTable.userId,
				date: scoresTable.recordedAt,
				workoutId: scoresTable.workoutId,
				notes: scoresTable.notes,
				scalingLevelId: scoresTable.scalingLevelId,
				asRx: scoresTable.asRx,
				scalingLevelLabel: scalingLevelsTable.label,
				scalingLevelPosition: scalingLevelsTable.position,
				scoreValue: scoresTable.scoreValue,
				secondaryValue: scoresTable.secondaryValue,
				scheme: scoresTable.scheme,
				status: scoresTable.status,
				createdAt: scoresTable.createdAt,
				updatedAt: scoresTable.updatedAt,
				workoutName: workouts.name,
			})
			.from(scoresTable)
			.leftJoin(workouts, eq(scoresTable.workoutId, workouts.id))
			.leftJoin(
				scalingLevelsTable,
				eq(scoresTable.scalingLevelId, scalingLevelsTable.id),
			)
			.where(eq(scoresTable.userId, userId))
			.orderBy(desc(scoresTable.recordedAt))

		logInfo({
			message: "[getLogsByUser] Fetched logs for user",
			attributes: { userId, count: logs.length },
		})
		// Decode scoreValue to formatted string for display
		// Include units for load/distance schemes so users see "225 lbs" not just "225"
		return logs.map((log) => {
			let displayScore: string | undefined
			if (log.scheme) {
				if (log.status === "cap" && log.scheme === "time-with-cap") {
					const timeStr =
						log.scoreValue !== null
							? decodeScore(log.scoreValue, log.scheme as WorkoutScheme, {
									includeUnit: true,
								})
							: ""
					displayScore =
						log.secondaryValue !== null
							? `CAP (${timeStr}) - ${log.secondaryValue} reps`
							: `CAP (${timeStr})`
				} else if (log.status === "withdrawn") {
					displayScore = "WITHDRAWN"
				} else if (log.scoreValue !== null) {
					displayScore = decodeScore(
						log.scoreValue,
						log.scheme as WorkoutScheme,
						{ includeUnit: true },
					)
				}
			}
			return {
				...log,
				displayScore,
				workoutName: log.workoutName || undefined,
				scalingLevelLabel: log.scalingLevelLabel || undefined,
				scalingLevelPosition: log.scalingLevelPosition ?? undefined,
			}
		}) as WorkoutResultWithWorkoutName[]
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
 * Writes to scores and score_rounds tables with proper encoding (milliseconds for time, etc.)
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
	statusOverride,
	scoreValueOverride,
	secondaryValue,
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
	statusOverride?: ScoreStatusNew
	/** Override the computed primary encoded scoreValue (new encoding). */
	scoreValueOverride?: number | null
	/** Reps completed at cap (time-with-cap CAP). */
	secondaryValue?: number | null
}): Promise<{
	success: boolean
	resultId?: string
	scoreId?: string
	error?: string
}> {
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

	const scoreId = createScoreId()

	try {
		// Require workoutInfo for proper score encoding
		if (!workoutInfo) {
			logError({
				message: "[addLog] workoutInfo is required for score encoding",
				attributes: { userId, workoutId },
			})
			return { success: false, error: "Workout info required for logging" }
		}

		// ========================================
		// Insert into scores table
		// ========================================
		const baseScoreData = prepareNewScoreData(
			setsData,
			workoutInfo,
			hasTimeCappedRounds,
		)
		logInfo({
			message: "[addLog] Prepared score aggregation",
			attributes: {
				scoreId,
				workoutId,
				userId,
				scheme: workoutInfo.scheme,
				scoreType: workoutInfo.scoreType ?? null,
				roundsCount: baseScoreData.roundValues.length,
				scoreValue: baseScoreData.scoreValue,
				roundValuesPreview: baseScoreData.roundValues.slice(0, 5),
			},
		})

		const status: ScoreStatusNew = statusOverride ?? baseScoreData.status
		const statusOrder = STATUS_ORDER[status]
		const scoreType = (workoutInfo.scoreType ||
			getDefaultScoreType(workoutInfo.scheme)) as ScoreType
		const scheme = workoutInfo.scheme as WorkoutScheme

		const scoreValue =
			scoreValueOverride !== undefined
				? scoreValueOverride
				: baseScoreData.scoreValue

		// Compute sortKey. We always compute it when status != scored or a value exists.
		const sortKey =
			scoreValue !== null || status !== "scored"
				? computeSortKey({
						value: scoreValue,
						status,
						scheme,
						scoreType,
					}).toString()
				: null

		const scoreInsertData = {
			id: scoreId,
			userId,
			teamId,
			workoutId,
			scheme,
			scoreType,
			scoreValue,
			status,
			statusOrder,
			sortKey,
			scalingLevelId,
			asRx,
			notes: notes || null,
			secondaryValue: secondaryValue ?? null,
			recordedAt: new Date(date),
			scheduledWorkoutInstanceId: scheduledWorkoutInstanceId || null,
			timeCapMs: workoutInfo.timeCap ? workoutInfo.timeCap * 1000 : null,
		}

		await db.insert(scoresTable).values(scoreInsertData)
		logInfo({
			message: "[addLog] Score inserted",
			attributes: {
				scoreId,
				scoreValue,
				status,
				sortKey,
			},
		})

		// ========================================
		// Insert score rounds if multi-round
		// ========================================
		if (baseScoreData.roundValues.length > 1) {
			const roundsToInsert = baseScoreData.roundValues.map((value, idx) => ({
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

		logInfo({
			message: "[addLog] Success",
			attributes: { scoreId, workoutId, userId },
		})
		return { success: true, scoreId }
	} catch (error) {
		logError({
			message: "[addLog] Error adding log",
			error,
			attributes: { userId, workoutId, scoreId },
		})
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Failed to add log" }
	}
}

/* -------------------------------------------------------------------------- */
/*                         New Score API (v2)                                  */
/* -------------------------------------------------------------------------- */

/**
 * Input for adding a score using the new direct format
 */
export interface AddScoreInput {
	userId: string
	teamId: string
	workoutId: string
	/** Timestamp in milliseconds */
	recordedAt: number
	scalingLevelId: string
	asRx: boolean
	notes?: string
	/** Raw score entries to process */
	entries: ScoreEntryInput[]
	/** Workout info for encoding */
	workoutInfo: WorkoutScoreInfo
	scheduledWorkoutInstanceId?: string | null
	/** Override status (e.g., for withdrawn) */
	statusOverride?: ScoreStatusNew
	/** Override score value (e.g., for CAP with time cap value) */
	scoreValueOverride?: number | null
	/** Secondary value (e.g., reps at cap) */
	secondaryValue?: number | null
	/** Tiebreak value (already encoded) */
	tiebreakValue?: number | null
}

/**
 * Add a score using the new direct format.
 * This is the clean v2 API that processes entries directly to scores/score_rounds.
 */
export async function addScore(input: AddScoreInput): Promise<{
	success: boolean
	scoreId?: string
	error?: string
}> {
	const session = await requireVerifiedEmail()
	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDb()
	const scoreId = createScoreId()

	try {
		const scheme = input.workoutInfo.scheme as WorkoutScheme
		const scoreType = (input.workoutInfo.scoreType ||
			getDefaultScoreType(scheme)) as ScoreType

		// Process entries to get encoded values
		const processed = processScoreEntries(input.entries, input.workoutInfo)

		// Allow overrides
		const status = input.statusOverride ?? processed.status
		const statusOrder = STATUS_ORDER[status]
		const scoreValue =
			input.scoreValueOverride !== undefined
				? input.scoreValueOverride
				: processed.scoreValue

		// Compute sort key
		const sortKey =
			scoreValue !== null || status !== "scored"
				? computeSortKey({
						value: scoreValue,
						status,
						scheme,
						scoreType,
					}).toString()
				: null

		// Insert score
		await db.insert(scoresTable).values({
			id: scoreId,
			userId: input.userId,
			teamId: input.teamId,
			workoutId: input.workoutId,
			scheme,
			scoreType,
			scoreValue,
			status,
			statusOrder,
			sortKey,
			scalingLevelId: input.scalingLevelId,
			asRx: input.asRx,
			notes: input.notes || null,
			secondaryValue: input.secondaryValue ?? null,
			tiebreakValue: input.tiebreakValue ?? null,
			tiebreakScheme: input.workoutInfo.tiebreakScheme ?? null,
			recordedAt: new Date(input.recordedAt),
			scheduledWorkoutInstanceId: input.scheduledWorkoutInstanceId || null,
			timeCapMs: input.workoutInfo.timeCap
				? input.workoutInfo.timeCap * 1000
				: null,
		})

		// Insert score rounds (always, even for single round)
		if (processed.roundValues.length > 0) {
			const roundsToInsert = processed.roundValues.map((value, idx) => ({
				id: createScoreRoundId(),
				scoreId,
				roundNumber: idx + 1,
				value,
			}))

			await db.insert(scoreRoundsTable).values(roundsToInsert)
		}

		logInfo({
			message: "[addScore] Success",
			attributes: { scoreId, workoutId: input.workoutId, userId: input.userId },
		})

		return { success: true, scoreId }
	} catch (error) {
		logError({
			message: "[addScore] Error",
			error,
			attributes: { userId: input.userId, workoutId: input.workoutId, scoreId },
		})
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Failed to add score" }
	}
}

/**
 * Get score rounds by score ID
 */
export async function getScoreRoundsById(
	scoreId: string,
): Promise<ResultSet[]> {
	const db = getDb()
	logInfo({
		message: "[getScoreRoundsById] Fetching rounds",
		attributes: { scoreId },
	})

	try {
		const rounds = await db
			.select()
			.from(scoreRoundsTable)
			.where(eq(scoreRoundsTable.scoreId, scoreId))
			.orderBy(scoreRoundsTable.roundNumber)

		logInfo({
			message: "[getScoreRoundsById] Found rounds",
			attributes: { scoreId, count: rounds.length },
		})
		return rounds
	} catch (error) {
		logError({
			message: "[getScoreRoundsById] Error fetching rounds",
			error,
			attributes: { scoreId },
		})
		return []
	}
}

/**
 * Get a single score by ID with workout details and scaling level
 */
export async function getScoreById(scoreId: string) {
	const session = await requireVerifiedEmail()
	if (!session) {
		logError({
			message: "[getScoreById] Unauthorized - no session",
			attributes: { scoreId },
		})
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDb()
	logInfo({
		message: "[getScoreById] Fetching score",
		attributes: { scoreId, userId: session.userId },
	})

	try {
		const [score] = await db
			.select({
				id: scoresTable.id,
				userId: scoresTable.userId,
				teamId: scoresTable.teamId,
				date: scoresTable.recordedAt,
				workoutId: scoresTable.workoutId,
				notes: scoresTable.notes,
				scalingLevelId: scoresTable.scalingLevelId,
				asRx: scoresTable.asRx,
				scalingLevelLabel: scalingLevelsTable.label,
				scalingLevelPosition: scalingLevelsTable.position,
				scoreValue: scoresTable.scoreValue,
				secondaryValue: scoresTable.secondaryValue,
				scheme: scoresTable.scheme,
				scoreType: scoresTable.scoreType,
				status: scoresTable.status,
				sortKey: scoresTable.sortKey,
				createdAt: scoresTable.createdAt,
				updatedAt: scoresTable.updatedAt,
				scheduledWorkoutInstanceId: scoresTable.scheduledWorkoutInstanceId,
				workoutName: workouts.name,
				workoutScheme: workouts.scheme,
				workoutRepsPerRound: workouts.repsPerRound,
				workoutRoundsToScore: workouts.roundsToScore,
			})
			.from(scoresTable)
			.leftJoin(workouts, eq(scoresTable.workoutId, workouts.id))
			.leftJoin(
				scalingLevelsTable,
				eq(scoresTable.scalingLevelId, scalingLevelsTable.id),
			)
			.where(eq(scoresTable.id, scoreId))
			.limit(1)

		if (!score) {
			logWarning({
				message: "[getScoreById] No score found",
				attributes: { scoreId },
			})
			return null
		}

		// Authorization check: verify user owns the score OR user has access to the team
		const isOwner = score.userId === session.userId
		const hasTeamAccess = session.teams?.some(
			(team) => team.id === score.teamId,
		)

		if (!isOwner && !hasTeamAccess) {
			logError({
				message: "[getScoreById] Unauthorized access attempt",
				attributes: {
					scoreId,
					userId: session.userId,
					scoreUserId: score.userId,
					scoreTeamId: score.teamId,
					userTeams: session.teams?.map((t) => t.id) || [],
				},
			})
			throw new ZSAError(
				"NOT_AUTHORIZED",
				"Not authorized to access this score",
			)
		}

		logInfo({
			message: "[getScoreById] Found score - authorization verified",
			attributes: {
				scoreId,
				workoutId: score.workoutId,
				userId: session.userId,
				isOwner,
				hasTeamAccess,
			},
		})
		return score
	} catch (error) {
		if (error instanceof ZSAError) {
			throw error
		}
		logError({
			message: "[getScoreById] Error fetching score",
			error,
			attributes: { scoreId },
		})
		return null
	}
}

/**
 * Update an existing score with rounds
 */
export async function updateScore({
	scoreId,
	userId,
	workoutId,
	date,
	scalingLevelId,
	asRx,
	notes,
	setsData,
	scheduledWorkoutInstanceId,
	workoutInfo,
	hasTimeCappedRounds,
	statusOverride,
	scoreValueOverride,
	secondaryValue,
}: {
	scoreId: string
	userId: string
	workoutId: string
	date: number
	scalingLevelId: string
	asRx: boolean
	notes: string
	setsData: ResultSetInput[]
	scheduledWorkoutInstanceId?: string | null
	workoutInfo: WorkoutScoreInfo
	hasTimeCappedRounds?: boolean
	statusOverride?: ScoreStatusNew
	scoreValueOverride?: number | null
	secondaryValue?: number | null
}): Promise<void> {
	const session = await requireVerifiedEmail()
	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDb()

	logInfo({
		message: "[updateScore] Updating score",
		attributes: { scoreId, userId, workoutId, setsCount: setsData.length },
	})

	try {
		// Prepare new score data from sets
		const baseScoreData = prepareNewScoreData(
			setsData,
			workoutInfo,
			hasTimeCappedRounds ?? false,
		)

		const status: ScoreStatusNew = statusOverride ?? baseScoreData.status
		const statusOrder = STATUS_ORDER[status]
		const scoreType = (workoutInfo.scoreType ||
			getDefaultScoreType(workoutInfo.scheme)) as ScoreType
		const scheme = workoutInfo.scheme as WorkoutScheme
		const scoreValue =
			scoreValueOverride !== undefined
				? scoreValueOverride
				: baseScoreData.scoreValue
		const sortKey =
			scoreValue !== null || status !== "scored"
				? computeSortKey({
						value: scoreValue,
						status,
						scheme,
						scoreType,
					}).toString()
				: null

		// Fetch old round IDs before making changes
		// We'll delete these specific IDs after inserting new rounds to avoid race condition
		const oldRounds = await db
			.select({ id: scoreRoundsTable.id })
			.from(scoreRoundsTable)
			.where(eq(scoreRoundsTable.scoreId, scoreId))

		const oldRoundIds = oldRounds.map((r) => r.id)

		// Insert new rounds first (if multi-round)
		// This ordering avoids a race condition where reads see a score with no rounds
		// D1 doesn't support transactions, so insert-then-delete ensures data completeness
		if (baseScoreData.roundValues.length > 1) {
			const roundsToInsert = baseScoreData.roundValues.map((value, idx) => ({
				id: createScoreRoundId(),
				scoreId,
				roundNumber: idx + 1,
				value,
			}))

			await db.insert(scoreRoundsTable).values(roundsToInsert)
			logInfo({
				message: "[updateScore] Inserted new rounds",
				attributes: { scoreId, insertedRounds: roundsToInsert.length },
			})
		}

		// Update the main score after new rounds are in place
		await db
			.update(scoresTable)
			.set({
				workoutId,
				recordedAt: new Date(date),
				scheme,
				scoreType,
				scoreValue,
				status,
				statusOrder,
				sortKey,
				scalingLevelId,
				asRx,
				notes: notes || null,
				secondaryValue: secondaryValue ?? null,
				scheduledWorkoutInstanceId: scheduledWorkoutInstanceId || null,
				timeCapMs: workoutInfo.timeCap ? workoutInfo.timeCap * 1000 : null,
				updatedAt: new Date(),
			})
			.where(eq(scoresTable.id, scoreId))

		// Delete old rounds last using their specific IDs
		// This avoids deleting the new rounds we just inserted
		if (oldRoundIds.length > 0) {
			for (const oldId of oldRoundIds) {
				await db.delete(scoreRoundsTable).where(eq(scoreRoundsTable.id, oldId))
			}
			logInfo({
				message: "[updateScore] Deleted old rounds",
				attributes: { scoreId, deletedRounds: oldRoundIds.length },
			})
		}

		logInfo({
			message: "[updateScore] Success",
			attributes: { scoreId, workoutId, userId },
		})
	} catch (error) {
		logError({
			message: "[updateScore] Error updating score",
			error,
			attributes: { scoreId, workoutId, userId },
		})
		throw error
	}
}

/**
 * Input for updating a score using the new direct format
 */
export interface UpdateScoreV2Input {
	scoreId: string
	workoutId: string
	/** Timestamp in milliseconds */
	recordedAt: number
	scalingLevelId: string
	asRx: boolean
	notes?: string
	/** Raw score entries to process */
	entries: ScoreEntryInput[]
	/** Workout info for encoding */
	workoutInfo: WorkoutScoreInfo
	scheduledWorkoutInstanceId?: string | null
	/** Override status (e.g., for withdrawn) */
	statusOverride?: ScoreStatusNew
	/** Override score value (e.g., for CAP with time cap value) */
	scoreValueOverride?: number | null
	/** Secondary value (e.g., reps at cap) */
	secondaryValue?: number | null
	/** Tiebreak value (already encoded) */
	tiebreakValue?: number | null
}

/**
 * Update a score using the new direct format.
 * This is the clean v2 API that processes entries directly to scores/score_rounds.
 */
export async function updateScoreV2(input: UpdateScoreV2Input): Promise<void> {
	const session = await requireVerifiedEmail()
	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDb()

	logInfo({
		message: "[updateScoreV2] Updating score",
		attributes: {
			scoreId: input.scoreId,
			workoutId: input.workoutId,
			entriesCount: input.entries.length,
		},
	})

	try {
		const scheme = input.workoutInfo.scheme as WorkoutScheme
		const scoreType = (input.workoutInfo.scoreType ||
			getDefaultScoreType(scheme)) as ScoreType

		// Process entries to get encoded values
		const processed = processScoreEntries(input.entries, input.workoutInfo)

		// Allow overrides
		const status = input.statusOverride ?? processed.status
		const statusOrder = STATUS_ORDER[status]
		const scoreValue =
			input.scoreValueOverride !== undefined
				? input.scoreValueOverride
				: processed.scoreValue

		// Compute sort key
		const sortKey =
			scoreValue !== null || status !== "scored"
				? computeSortKey({
						value: scoreValue,
						status,
						scheme,
						scoreType,
					}).toString()
				: null

		// Fetch old round IDs before making changes
		// We'll delete these specific IDs after inserting new rounds to avoid race condition
		const oldRounds = await db
			.select({ id: scoreRoundsTable.id })
			.from(scoreRoundsTable)
			.where(eq(scoreRoundsTable.scoreId, input.scoreId))

		const oldRoundIds = oldRounds.map((r) => r.id)

		// Insert new rounds first (always, even for single round)
		// This ordering avoids a race condition where reads see a score with no rounds
		// D1 doesn't support transactions, so insert-then-delete ensures data completeness
		if (processed.roundValues.length > 0) {
			const roundsToInsert = processed.roundValues.map((value, idx) => ({
				id: createScoreRoundId(),
				scoreId: input.scoreId,
				roundNumber: idx + 1,
				value,
			}))

			await db.insert(scoreRoundsTable).values(roundsToInsert)
			logInfo({
				message: "[updateScoreV2] Inserted new rounds",
				attributes: {
					scoreId: input.scoreId,
					insertedRounds: roundsToInsert.length,
				},
			})
		}

		// Update the main score after new rounds are in place
		await db
			.update(scoresTable)
			.set({
				workoutId: input.workoutId,
				recordedAt: new Date(input.recordedAt),
				scheme,
				scoreType,
				scoreValue,
				status,
				statusOrder,
				sortKey,
				scalingLevelId: input.scalingLevelId,
				asRx: input.asRx,
				notes: input.notes || null,
				secondaryValue: input.secondaryValue ?? null,
				tiebreakValue: input.tiebreakValue ?? null,
				tiebreakScheme: input.workoutInfo.tiebreakScheme ?? null,
				scheduledWorkoutInstanceId: input.scheduledWorkoutInstanceId || null,
				timeCapMs: input.workoutInfo.timeCap
					? input.workoutInfo.timeCap * 1000
					: null,
				updatedAt: new Date(),
			})
			.where(eq(scoresTable.id, input.scoreId))

		// Delete old rounds last using their specific IDs
		// This avoids deleting the new rounds we just inserted
		if (oldRoundIds.length > 0) {
			for (const oldId of oldRoundIds) {
				await db.delete(scoreRoundsTable).where(eq(scoreRoundsTable.id, oldId))
			}
			logInfo({
				message: "[updateScoreV2] Deleted old rounds",
				attributes: {
					scoreId: input.scoreId,
					deletedRounds: oldRoundIds.length,
				},
			})
		}

		logInfo({
			message: "[updateScoreV2] Success",
			attributes: { scoreId: input.scoreId, workoutId: input.workoutId },
		})
	} catch (error) {
		logError({
			message: "[updateScoreV2] Error updating score",
			error,
			attributes: { scoreId: input.scoreId, workoutId: input.workoutId },
		})
		throw error
	}
}

export interface SavePersonalLogScoreInput {
	selectedWorkoutId: string
	date: string
	notes?: string
	scalingLevelId?: string | null
	asRx?: boolean | null
	/** Legacy scale fallback when scalingLevelId/asRx not provided */
	scale?: "rx" | "scaled" | "rx+"
	/** Single-round input */
	score?: string
	/** Multi-round inputs */
	roundScores?: Array<{ score: string }>
	/** For time-with-cap CAP: reps achieved at cap */
	secondaryScore?: string | null
	scheduledInstanceId?: string | null
	programmingTrackId?: string | null
}

function mapParseStatusToScoreStatusNew(
	status: "scored" | "dns" | "dnf" | "cap" | null,
): ScoreStatusNew {
	if (status === "cap") return "cap"
	if (status === "dns" || status === "dnf") return "withdrawn"
	return "scored"
}

export async function savePersonalLogScore(
	input: SavePersonalLogScoreInput,
): Promise<{ scoreId: string }> {
	const session = await requireVerifiedEmail()
	if (!session?.userId) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDb()

	const [workout] = await db
		.select({
			id: workouts.id,
			scheme: workouts.scheme,
			scoreType: workouts.scoreType,
			repsPerRound: workouts.repsPerRound,
			roundsToScore: workouts.roundsToScore,
			timeCap: workouts.timeCap,
			tiebreakScheme: workouts.tiebreakScheme,
		})
		.from(workouts)
		.where(eq(workouts.id, input.selectedWorkoutId))
		.limit(1)

	if (!workout) {
		throw new ZSAError("NOT_FOUND", "Selected workout not found")
	}

	const headerList = await headers()
	const timezone = headerList.get("x-vercel-ip-timezone") ?? "America/Denver"
	const dateInTargetTz = fromZonedTime(`${input.date}T00:00:00`, timezone)
	const timestamp = dateInTargetTz.getTime()

	const teamId = await getActiveOrPersonalTeamId(session.userId)

	const workoutInfo: WorkoutScoreInfo = {
		scheme: workout.scheme as WorkoutScheme,
		scoreType: (workout.scoreType as ScoreType | null) ?? null,
		repsPerRound: workout.repsPerRound ?? null,
		roundsToScore: workout.roundsToScore ?? null,
		timeCap: workout.timeCap ?? null,
		tiebreakScheme: (workout.tiebreakScheme as TiebreakScheme | null) ?? null,
	}

	// Scaling: prefer explicit new fields
	let scalingLevelId = input.scalingLevelId ?? null
	let asRx = input.asRx ?? null

	if (!scalingLevelId || asRx === null) {
		const mapped = await mapLegacyScaleToScalingLevel({
			workoutId: workout.id,
			programmingTrackId: input.programmingTrackId,
			scale: input.scale ?? "rx",
		})
		if (!scalingLevelId) scalingLevelId = mapped.scalingLevelId
		if (asRx === null) asRx = mapped.asRx
	}

	if (!scalingLevelId || asRx === null) {
		throw new ZSAError("ERROR", "Scaling selection is required")
	}

	// FK safety: ensure scalingLevelId exists, else fall back to legacy mapping.
	{
		const [level] = await db
			.select({ id: scalingLevelsTable.id })
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.id, scalingLevelId))
			.limit(1)

		if (!level) {
			logWarning({
				message:
					"[savePersonalLogScore] scalingLevelId missing in DB; remapping from legacy scale",
				attributes: {
					userId: session.userId,
					workoutId: workout.id,
					scalingLevelId,
					asRx,
					programmingTrackId: input.programmingTrackId ?? null,
				},
			})

			const fallbackScale: "rx" | "scaled" | "rx+" =
				input.scale ?? (asRx ? "rx" : "scaled")
			const remapped = await mapLegacyScaleToScalingLevel({
				workoutId: workout.id,
				programmingTrackId: input.programmingTrackId,
				scale: fallbackScale,
			})
			scalingLevelId = remapped.scalingLevelId
			asRx = remapped.asRx
		}
	}

	const roundsToScore = workout.roundsToScore ?? 1
	const isMultiRound = roundsToScore > 1

	// Build entries array from input
	let entries: ScoreEntryInput[] = []

	if (isMultiRound) {
		const roundScores = input.roundScores ?? []
		const hasAtLeastOne = roundScores.some((r) => r.score.trim() !== "")
		if (!hasAtLeastOne) {
			throw new ZSAError("ERROR", "At least one score is required")
		}

		// Disallow CAP/DNS/DNF in multi-round until we support per-round status/secondary
		for (const r of roundScores) {
			const parsed = parseScoreInput(
				r.score,
				workoutInfo.scheme as WorkoutScheme,
				workoutInfo.timeCap ?? undefined,
				workoutInfo.tiebreakScheme ?? undefined,
			)
			if (parsed.scoreStatus && parsed.scoreStatus !== "scored") {
				throw new ZSAError(
					"ERROR",
					"CAP/DNS/DNF is not supported for multi-round personal logs",
				)
			}
		}

		entries = roundScores.map((r) => ({ raw: r.score, isCapped: false }))
	} else {
		// Single-round
		const rawScore = (input.score ?? "").trim()
		if (!rawScore) {
			throw new ZSAError("ERROR", "Score is required")
		}

		const parsed = parseScoreInput(
			rawScore,
			workoutInfo.scheme as WorkoutScheme,
			workoutInfo.timeCap ?? undefined,
			workoutInfo.tiebreakScheme ?? undefined,
		)
		if (!parsed.isValid) {
			throw new ZSAError("ERROR", parsed.error || "Invalid score")
		}

		const status = mapParseStatusToScoreStatusNew(parsed.scoreStatus)

		// CAP handling for time-with-cap workouts
		if (status === "cap") {
			if (workoutInfo.scheme !== "time-with-cap") {
				throw new ZSAError(
					"ERROR",
					"CAP is only supported for time-with-cap workouts",
				)
			}
			if (!workoutInfo.timeCap) {
				throw new ZSAError("ERROR", "Workout has no time cap configured")
			}
			const repsStr = (input.secondaryScore ?? "").trim()
			const reps = Number.parseInt(repsStr, 10)
			if (!repsStr || Number.isNaN(reps) || reps < 0) {
				throw new ZSAError("ERROR", "Reps at cap is required for CAP scores")
			}

			const timeCapMs = workoutInfo.timeCap * 1000

			const result = await addScore({
				userId: session.userId,
				teamId,
				workoutId: workout.id,
				recordedAt: timestamp,
				scalingLevelId,
				asRx,
				notes: input.notes,
				entries: [], // No entries for CAP - we override the value
				workoutInfo,
				scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
				statusOverride: "cap",
				scoreValueOverride: timeCapMs,
				secondaryValue: reps,
			})

			if (!result.success || !result.scoreId) {
				throw new ZSAError("ERROR", result.error || "Failed to save log")
			}
			return { scoreId: result.scoreId }
		}

		// Withdrawn status
		if (status === "withdrawn") {
			const result = await addScore({
				userId: session.userId,
				teamId,
				workoutId: workout.id,
				recordedAt: timestamp,
				scalingLevelId,
				asRx,
				notes: input.notes,
				entries: [],
				workoutInfo,
				scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
				statusOverride: "withdrawn",
				scoreValueOverride: null,
			})

			if (!result.success || !result.scoreId) {
				throw new ZSAError("ERROR", result.error || "Failed to save log")
			}
			return { scoreId: result.scoreId }
		}

		// Normal scored single-round
		entries = [{ raw: rawScore, isCapped: false }]
	}

	// Use the new addScore API
	const result = await addScore({
		userId: session.userId,
		teamId,
		workoutId: workout.id,
		recordedAt: timestamp,
		scalingLevelId,
		asRx,
		notes: input.notes,
		entries,
		workoutInfo,
		scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
	})

	if (!result.success || !result.scoreId) {
		throw new ZSAError("ERROR", result.error || "Failed to save log")
	}

	return { scoreId: result.scoreId }
}

export async function updatePersonalLogScore(input: {
	scoreId: string
	selectedWorkoutId: string
	date: string
	notes?: string
	scalingLevelId?: string | null
	asRx?: boolean | null
	scale?: "rx" | "scaled" | "rx+"
	score?: string
	roundScores?: Array<{ score: string }>
	secondaryScore?: string | null
	scheduledInstanceId?: string | null
	programmingTrackId?: string | null
}): Promise<void> {
	const session = await requireVerifiedEmail()
	if (!session?.userId) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDb()

	// Ensure ownership
	const [existing] = await db
		.select({ userId: scoresTable.userId })
		.from(scoresTable)
		.where(eq(scoresTable.id, input.scoreId))
		.limit(1)
	if (!existing) {
		throw new ZSAError("NOT_FOUND", "Score not found")
	}
	if (existing.userId !== session.userId) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authorized to edit this score")
	}

	// Reuse save logic by loading the workout and then calling updateScore
	const [workout] = await db
		.select({
			id: workouts.id,
			scheme: workouts.scheme,
			scoreType: workouts.scoreType,
			repsPerRound: workouts.repsPerRound,
			roundsToScore: workouts.roundsToScore,
			timeCap: workouts.timeCap,
			tiebreakScheme: workouts.tiebreakScheme,
		})
		.from(workouts)
		.where(eq(workouts.id, input.selectedWorkoutId))
		.limit(1)

	if (!workout) {
		throw new ZSAError("NOT_FOUND", "Selected workout not found")
	}

	const headerList = await headers()
	const timezone = headerList.get("x-vercel-ip-timezone") ?? "America/Denver"
	const dateInTargetTz = fromZonedTime(`${input.date}T00:00:00`, timezone)
	const timestamp = dateInTargetTz.getTime()

	const workoutInfo: WorkoutScoreInfo = {
		scheme: workout.scheme as WorkoutScheme,
		scoreType: (workout.scoreType as ScoreType | null) ?? null,
		repsPerRound: workout.repsPerRound ?? null,
		roundsToScore: workout.roundsToScore ?? null,
		timeCap: workout.timeCap ?? null,
		tiebreakScheme: (workout.tiebreakScheme as TiebreakScheme | null) ?? null,
	}

	let scalingLevelId = input.scalingLevelId ?? null
	let asRx = input.asRx ?? null

	if (!scalingLevelId || asRx === null) {
		const mapped = await mapLegacyScaleToScalingLevel({
			workoutId: workout.id,
			programmingTrackId: input.programmingTrackId,
			scale: input.scale ?? "rx",
		})
		if (!scalingLevelId) scalingLevelId = mapped.scalingLevelId
		if (asRx === null) asRx = mapped.asRx
	}

	if (!scalingLevelId || asRx === null) {
		throw new ZSAError("ERROR", "Scaling selection is required")
	}

	// FK safety: ensure scalingLevelId exists, else fall back to legacy mapping.
	{
		const [level] = await db
			.select({ id: scalingLevelsTable.id })
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.id, scalingLevelId))
			.limit(1)

		if (!level) {
			logWarning({
				message:
					"[updatePersonalLogScore] scalingLevelId missing in DB; remapping from legacy scale",
				attributes: {
					userId: session.userId,
					scoreId: input.scoreId,
					workoutId: workout.id,
					scalingLevelId,
					asRx,
					programmingTrackId: input.programmingTrackId ?? null,
				},
			})

			const fallbackScale: "rx" | "scaled" | "rx+" =
				input.scale ?? (asRx ? "rx" : "scaled")
			const remapped = await mapLegacyScaleToScalingLevel({
				workoutId: workout.id,
				programmingTrackId: input.programmingTrackId,
				scale: fallbackScale,
			})
			scalingLevelId = remapped.scalingLevelId
			asRx = remapped.asRx
		}
	}

	const roundsToScore = workout.roundsToScore ?? 1
	const isMultiRound = roundsToScore > 1

	// Build entries array from input
	let entries: ScoreEntryInput[] = []

	if (isMultiRound) {
		const roundScores = input.roundScores ?? []
		const hasAtLeastOne = roundScores.some((r) => r.score.trim() !== "")
		if (!hasAtLeastOne) {
			throw new ZSAError("ERROR", "At least one score is required")
		}

		// Disallow CAP/DNS/DNF in multi-round until we support per-round status/secondary
		for (const r of roundScores) {
			const p = parseScoreInput(
				r.score,
				workoutInfo.scheme as WorkoutScheme,
				workoutInfo.timeCap ?? undefined,
				workoutInfo.tiebreakScheme ?? undefined,
			)
			if (p.scoreStatus && p.scoreStatus !== "scored") {
				throw new ZSAError(
					"ERROR",
					"CAP/DNS/DNF is not supported for multi-round personal logs",
				)
			}
		}

		entries = roundScores.map((r) => ({ raw: r.score, isCapped: false }))
	} else {
		// Single-round
		const rawScore = (input.score ?? "").trim()
		if (!rawScore) {
			throw new ZSAError("ERROR", "Score is required")
		}

		const parsed = parseScoreInput(
			rawScore,
			workoutInfo.scheme as WorkoutScheme,
			workoutInfo.timeCap ?? undefined,
			workoutInfo.tiebreakScheme ?? undefined,
		)
		if (!parsed.isValid) {
			throw new ZSAError("ERROR", parsed.error || "Invalid score")
		}

		const status = mapParseStatusToScoreStatusNew(parsed.scoreStatus)

		// CAP handling for time-with-cap workouts
		if (status === "cap") {
			if (workoutInfo.scheme !== "time-with-cap") {
				throw new ZSAError(
					"ERROR",
					"CAP is only supported for time-with-cap workouts",
				)
			}
			if (!workoutInfo.timeCap) {
				throw new ZSAError("ERROR", "Workout has no time cap configured")
			}
			const repsStr = (input.secondaryScore ?? "").trim()
			const reps = Number.parseInt(repsStr, 10)
			if (!repsStr || Number.isNaN(reps) || reps < 0) {
				throw new ZSAError("ERROR", "Reps at cap is required for CAP scores")
			}

			const timeCapMs = workoutInfo.timeCap * 1000

			await updateScoreV2({
				scoreId: input.scoreId,
				workoutId: workout.id,
				recordedAt: timestamp,
				scalingLevelId,
				asRx,
				notes: input.notes,
				entries: [], // No entries for CAP - we override the value
				workoutInfo,
				scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
				statusOverride: "cap",
				scoreValueOverride: timeCapMs,
				secondaryValue: reps,
			})
			return
		}

		// Withdrawn status
		if (status === "withdrawn") {
			await updateScoreV2({
				scoreId: input.scoreId,
				workoutId: workout.id,
				recordedAt: timestamp,
				scalingLevelId,
				asRx,
				notes: input.notes,
				entries: [],
				workoutInfo,
				scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
				statusOverride: "withdrawn",
				scoreValueOverride: null,
			})
			return
		}

		// Normal scored single-round
		entries = [{ raw: rawScore, isCapped: false }]
	}

	// Use the new updateScoreV2 API
	await updateScoreV2({
		scoreId: input.scoreId,
		workoutId: workout.id,
		recordedAt: timestamp,
		scalingLevelId,
		asRx,
		notes: input.notes,
		entries,
		workoutInfo,
		scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
	})
}

// ============================================================================
// Backward Compatibility Aliases
// These aliases maintain compatibility with code that uses the old function names.
// They should be removed once all callers are updated.
// ============================================================================

/** @deprecated Use getScoreById instead */
export const getResultById = getScoreById

/** @deprecated Use getScoreRoundsById instead */
export const getResultSetsById = getScoreRoundsById
