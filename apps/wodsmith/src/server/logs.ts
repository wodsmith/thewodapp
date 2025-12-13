import "server-only"
import { fromZonedTime } from "date-fns-tz"
import { asc, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { ZSAError } from "@repo/zsa"
import { getDb } from "@/db"
import {
	programmingTracksTable,
	scalingGroupsTable,
	scalingLevelsTable,
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
	GRAMS_PER_UNIT,
	MM_PER_UNIT,
} from "@/lib/scoring"
import { parseScore as parseScoreInput } from "@/utils/score-parser-new"
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
				const parseResult = libParseScore(
					scoreStr,
					workout.scheme as WorkoutScheme,
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
		return logs.map((log) => {
			let displayScore: string | undefined
			if (log.scheme) {
				if (log.status === "cap" && log.scheme === "time-with-cap") {
					const timeStr =
						log.scoreValue !== null
							? decodeScore(log.scoreValue, log.scheme as WorkoutScheme)
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
	const db = getDb()
	logInfo({
		message: "[getScoreById] Fetching score",
		attributes: { scoreId },
	})

	try {
		const [score] = await db
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

		logInfo({
			message: "[getScoreById] Found score",
			attributes: { scoreId, workoutId: score.workoutId },
		})
		return score
	} catch (error) {
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

		// Update the main score
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

		// Delete existing rounds
		await db
			.delete(scoreRoundsTable)
			.where(eq(scoreRoundsTable.scoreId, scoreId))

		// Insert new rounds if multi-round
		if (baseScoreData.roundValues.length > 1) {
			const roundsToInsert = baseScoreData.roundValues.map((value, idx) => ({
				id: createScoreRoundId(),
				scoreId,
				roundNumber: idx + 1,
				value,
			}))

			await db.insert(scoreRoundsTable).values(roundsToInsert)
			logInfo({
				message: "[updateScore] Inserted replacement rounds",
				attributes: { scoreId, insertedRounds: roundsToInsert.length },
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

	// Multi-round
	if (isMultiRound) {
		const roundScores = input.roundScores ?? []
		const hasAtLeastOne = roundScores.some((r) => r.score.trim() !== "")
		if (!hasAtLeastOne) {
			throw new ZSAError("ERROR", "At least one score is required")
		}

		const normalizedEntries = roundScores.map((r) => ({
			score: r.score,
			timeCapped: false,
		}))

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

		const { setsForDb, wodScore } = processScoresToSetsAndWodScore(
			normalizedEntries,
			workoutInfo,
		)

		const result = await addLog({
			userId: session.userId,
			teamId,
			workoutId: workout.id,
			date: timestamp,
			scalingLevelId,
			asRx,
			wodScore,
			notes: input.notes ?? "",
			setsData: setsForDb,
			type: "wod",
			scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
			programmingTrackId: input.programmingTrackId ?? null,
			workoutInfo,
			hasTimeCappedRounds: false,
		})

		if (!result.success || !result.scoreId) {
			throw new ZSAError("ERROR", result.error || "Failed to save log")
		}
		return { scoreId: result.scoreId }
	}

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

	// CAP handling for time-with-cap workouts: store scoreValue=timeCapMs, secondaryValue=reps
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

		const result = await addLog({
			userId: session.userId,
			teamId,
			workoutId: workout.id,
			date: timestamp,
			scalingLevelId,
			asRx,
			wodScore: parsed.formatted,
			notes: input.notes ?? "",
			setsData: [],
			type: "wod",
			scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
			programmingTrackId: input.programmingTrackId ?? null,
			workoutInfo,
			hasTimeCappedRounds: false,
			statusOverride: "cap",
			scoreValueOverride: timeCapMs,
			secondaryValue: reps,
		})

		if (!result.success || !result.scoreId) {
			throw new ZSAError("ERROR", result.error || "Failed to save log")
		}
		return { scoreId: result.scoreId }
	}

	// Normal scored / withdrawn single-round: store as a single-entry set
	const normalizedEntries = [{ score: rawScore, timeCapped: false }]
	const { setsForDb, wodScore } = processScoresToSetsAndWodScore(
		normalizedEntries,
		workoutInfo,
	)

	const result = await addLog({
		userId: session.userId,
		teamId,
		workoutId: workout.id,
		date: timestamp,
		scalingLevelId,
		asRx,
		wodScore,
		notes: input.notes ?? "",
		setsData: setsForDb,
		type: "wod",
		scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
		programmingTrackId: input.programmingTrackId ?? null,
		workoutInfo,
		hasTimeCappedRounds: false,
		statusOverride: status === "withdrawn" ? "withdrawn" : undefined,
		scoreValueOverride: status === "withdrawn" ? null : undefined,
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

	if (isMultiRound) {
		const roundScores = input.roundScores ?? []
		const hasAtLeastOne = roundScores.some((r) => r.score.trim() !== "")
		if (!hasAtLeastOne) {
			throw new ZSAError("ERROR", "At least one score is required")
		}
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

		const normalizedEntries = roundScores.map((r) => ({
			score: r.score,
			timeCapped: false,
		}))

		const { setsForDb } = processScoresToSetsAndWodScore(
			normalizedEntries,
			workoutInfo,
		)

		await updateScore({
			scoreId: input.scoreId,
			userId: session.userId,
			workoutId: workout.id,
			date: timestamp,
			scalingLevelId,
			asRx,
			notes: input.notes ?? "",
			setsData: setsForDb,
			scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
			workoutInfo,
			hasTimeCappedRounds: false,
			statusOverride: "scored",
			secondaryValue: null,
		})
		return
	}

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

		await updateScore({
			scoreId: input.scoreId,
			userId: session.userId,
			workoutId: workout.id,
			date: timestamp,
			scalingLevelId,
			asRx,
			notes: input.notes ?? "",
			setsData: [],
			scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
			workoutInfo,
			hasTimeCappedRounds: false,
			statusOverride: "cap",
			scoreValueOverride: timeCapMs,
			secondaryValue: reps,
		})
		return
	}

	const normalizedEntries = [{ score: rawScore, timeCapped: false }]
	const { setsForDb } = processScoresToSetsAndWodScore(
		normalizedEntries,
		workoutInfo,
	)

	await updateScore({
		scoreId: input.scoreId,
		userId: session.userId,
		workoutId: workout.id,
		date: timestamp,
		scalingLevelId,
		asRx,
		notes: input.notes ?? "",
		setsData: setsForDb,
		scheduledWorkoutInstanceId: input.scheduledInstanceId ?? null,
		workoutInfo,
		hasTimeCappedRounds: false,
		statusOverride: status,
		scoreValueOverride: status === "withdrawn" ? null : undefined,
		secondaryValue: null,
	})
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
			attributes: {
				resultId: result.resultId,
				scoreId: result.scoreId,
				workoutId: selectedWorkoutId,
			},
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

// ============================================================================
// Backward Compatibility Aliases
// These aliases maintain compatibility with code that uses the old function names.
// They should be removed once all callers are updated.
// ============================================================================

/** @deprecated Use getScoreById instead */
export const getResultById = getScoreById

/** @deprecated Use getScoreRoundsById instead */
export const getResultSetsById = getScoreRoundsById
