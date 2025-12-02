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
	type WorkoutScheme,
	type ScoreType,
} from "@/db/schema"
import { formatSecondsToTime, parseTimeScoreToSeconds } from "@/lib/utils"
import type {
	ResultSet,
	ResultSetInput,
	Workout,
	WorkoutResultWithWorkoutName,
} from "@/types"
import { requireVerifiedEmail } from "@/utils/auth"

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
export function getDefaultScoreType(scheme: WorkoutScheme | Workout["scheme"]): string {
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
 */
export function aggregateScores(
	values: number[],
	scoreType: string,
): number | null {
	if (values.length === 0) return null

	switch (scoreType) {
		case "min":
			return Math.min(...values)
		case "max":
			return Math.max(...values)
		case "sum":
			return values.reduce((sum, v) => sum + v, 0)
		case "average":
			return values.reduce((sum, v) => sum + v, 0) / values.length
		case "first":
			return values[0] ?? null
		case "last":
			return values[values.length - 1] ?? null
		default:
			return null
	}
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
			// Rounds + Reps format
			const roundsStr = entry.parts?.[0] || entry.score.split("+")[0] || "0"
			const repsStr = entry.parts?.[1] || entry.score.split("+")[1] || "0"

			const roundsCompleted = parseInt(roundsStr.trim(), 10)
			const repsCompleted = parseInt(repsStr.trim(), 10)

			if (Number.isNaN(roundsCompleted)) {
				continue // Skip invalid entries
			}

			// Calculate total reps: rounds * repsPerRound + reps
			const totalReps =
				roundsCompleted * (workout.repsPerRound ?? 0) +
				(Number.isNaN(repsCompleted) ? 0 : repsCompleted)

			setsForDb.push({
				setNumber,
				reps: totalReps,
				score: null,
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
				const timeInSeconds = parseTimeScoreToSeconds(scoreStr)
				if (timeInSeconds !== null) {
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
			return aggregated !== null ? formatSecondsToTime(aggregated) : ""
		}
		return totalSecondsForWodScore > 0
			? formatSecondsToTime(totalSecondsForWodScore)
			: ""
	}

	// Rounds+reps workouts: wodScore is total reps
	if (isRoundsAndRepsWorkout) {
		const repsValues = setsForDb
			.map((set) => set.reps)
			.filter((r): r is number => r !== null && r !== undefined)

		if (shouldAggregate && repsValues.length > 1) {
			const aggregated = aggregateScores(repsValues, effectiveScoreType)
			return aggregated !== null ? aggregated.toString() : ""
		}
		// Single round: return total reps
		if (repsValues.length > 0) {
			return repsValues[0]?.toString() ?? ""
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
			score: hasTwoParts ? `${parts[0] || "0"}+${parts[1] || "0"}` : parts[0] || "",
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
	console.log(`[getLogsByUser] Fetching logs for userId: ${userId}`)

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

		console.log(
			`[getLogsByUser] Found ${logs.length} logs for userId: ${userId}`,
		)
		return logs.map((log) => ({
			...log,
			workoutName: log.workoutName || undefined,
			scalingLevelLabel: log.scalingLevelLabel || undefined,
			scalingLevelPosition: log.scalingLevelPosition ?? undefined,
		})) as WorkoutResultWithWorkoutName[]
	} catch (error) {
		console.error(
			`[getLogsByUser] Error fetching logs for userId ${userId}:`,
			error,
		)
		return []
	}
}

/**
 * Add a new log entry with sets
 */
export async function addLog({
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
}): Promise<{ success: boolean; resultId?: string; error?: string }> {
	console.log("[addLog] START - Input parameters:", {
		userId,
		workoutId,
		date,
		scalingLevelId,
		asRx,
		wodScore,
		notes,
		setsDataLength: setsData.length,
		setsData,
		type,
		scheduledWorkoutInstanceId,
		programmingTrackId,
	})

	const session = await requireVerifiedEmail()
	if (!session) {
		console.error("[addLog] No session found - not authenticated")
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}
	console.log("[addLog] Session verified for user:", session.user.id)

	let db: ReturnType<typeof getDb>
	try {
		db = getDb()
		console.log("[addLog] Database connection obtained successfully")
	} catch (error) {
		console.error("[addLog] Failed to get database connection:", error)
		return { success: false, error: "Database connection failed" }
	}

	const resultId = `result_${createId()}`
	console.log("[addLog] Generated resultId:", resultId)

	try {
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
		console.log("[addLog] Attempting to insert result with data:", insertData)

		// Special logging for the problematic workout
		if (workoutId === "workout_pwtf9kdcxqp157lgttav7ia7") {
			console.log("[addLog] SAWTOOTH WORKOUT INSERT - Full details:", {
				insertData,
				setsData,
				dateObject: new Date(date),
				dateTimestamp: date,
			})
		}

		// Insert the main result - using timestamp mode for date field
		const insertResult = await db.insert(results).values(insertData).returning()
		console.log("[addLog] Result insert successful, returned:", insertResult)

		// Insert sets if any
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
			console.log("[addLog] Attempting to insert sets:", setsToInsert)

			const setsInsertResult = await db
				.insert(sets)
				.values(setsToInsert)
				.returning()
			console.log(
				`[addLog] Added ${setsToInsert.length} sets for resultId: ${resultId}`,
				setsInsertResult,
			)
		}

		console.log(`[addLog] SUCCESS - Added log with resultId: ${resultId}`)
		return { success: true, resultId }
	} catch (error) {
		console.error(`[addLog] ERROR adding log for userId ${userId}:`, error)
		console.error("[addLog] Error details:", {
			name: error instanceof Error ? error.name : "Unknown",
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : "No stack trace",
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
	console.log(`[getResultSetsById] Fetching sets for resultId: ${resultId}`)

	try {
		const setDetails = await db
			.select()
			.from(sets)
			.where(eq(sets.resultId, resultId))
			.orderBy(sets.setNumber)

		console.log(
			`[getResultSetsById] Found ${setDetails.length} sets for resultId ${resultId}`,
		)
		return setDetails
	} catch (error) {
		console.error(
			`[getResultSetsById] Error fetching sets for resultId ${resultId}:`,
			error,
		)
		return []
	}
}

/**
 * Get a single result by ID with workout details and scaling level
 */
export async function getResultById(resultId: string) {
	const db = getDb()
	console.log(`[getResultById] Fetching result with id: ${resultId}`)

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
			console.log(`[getResultById] No result found with id: ${resultId}`)
			return null
		}

		console.log(`[getResultById] Found result for id: ${resultId}`)
		return result
	} catch (error) {
		console.error(
			`[getResultById] Error fetching result with id ${resultId}:`,
			error,
		)
		return null
	}
}

/**
 * Update an existing result with sets
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

	console.log(
		`[updateResult] Updating result with id: ${resultId}, userId: ${userId}, workoutId: ${workoutId}`,
	)

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
			console.log(
				`[updateResult] Updated ${setsToInsert.length} sets for resultId: ${resultId}`,
			)
		}

		console.log(
			`[updateResult] Successfully updated result with id: ${resultId}`,
		)
	} catch (error) {
		console.error(
			`[updateResult] Error updating result with id ${resultId}:`,
			error,
		)
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
			console.error(
				"[Action] No valid score parts provided for a workout that expects scores.",
			)
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
		console.error(
			"[Action] All provided score entries resulted in no valid sets to save, but some input was detected.",
		)
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
		console.error(
			"[Action] No score entries provided or all were empty, and workout expects scores.",
		)
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
	scheduledInstanceId?: string | null,
	programmingTrackId?: string | null,
) {
	console.log("[Action] Submitting log with sets:", {
		userId,
		selectedWorkoutId,
		date: dateStr,
		scale: scaleValue,
		wodScoreSummary: finalWodScoreSummary,
		notes: notesValue,
		sets: setsForDb,
	})

	console.log("[Action] Date in timezone:", new Date(dateStr).getTime())

	try {
		const dateInTargetTz = fromZonedTime(`${dateStr}T00:00:00`, timezone)
		const timestamp = dateInTargetTz.getTime()

		console.log(
			`[Action] Original date string: ${dateStr}, Target Timezone: ${timezone}, Timestamp: ${timestamp}`,
		)

		// Map legacy scale to new scaling fields
		const { scalingLevelId, asRx } = await mapLegacyScaleToScalingLevel({
			workoutId: selectedWorkoutId,
			programmingTrackId,
			scale: scaleValue,
		})

		const result = await addLog({
			userId,
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
		})

		if (!result.success) {
			console.error("[Action] Failed to add log:", result.error)
			return { error: result.error || "Failed to save log" }
		}

		console.log(
			"[Action] Successfully added log with resultId:",
			result.resultId,
		)
		return { success: true, resultId: result.resultId }
	} catch (error) {
		console.error("[Action] Failed to add log with sets:", error)
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
	console.log("[submitLogForm] START with params:", {
		userId,
		workoutsCount: workouts.length,
		workoutIds: workouts.map((w) => w.id),
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

	console.log("[submitLogForm] Parsed form data:", {
		selectedWorkoutId,
		dateStr,
		scaleValue,
		notesValue,
		scheduledInstanceId,
		programmingTrackId,
	})

	if (!selectedWorkoutId) {
		console.error("[submitLogForm] No workout selected")
		return { error: "No workout selected. Please select a workout." }
	}

	const workout = workouts.find((w) => w.id === selectedWorkoutId)
	console.log("[submitLogForm] Found workout:", {
		id: workout?.id,
		name: workout?.name,
		scheme: workout?.scheme,
		repsPerRound: workout?.repsPerRound,
		roundsToScore: workout?.roundsToScore,
	})

	if (!workout) {
		console.error(
			"[submitLogForm] Workout not found for ID:",
			selectedWorkoutId,
		)
		console.error(
			"[submitLogForm] Available workout IDs:",
			workouts.map((w) => w.id),
		)
		return { error: "Selected workout not found. Please try again." }
	}

	// Special logging for the problematic workout
	if (selectedWorkoutId === "workout_pwtf9kdcxqp157lgttav7ia7") {
		console.log("[submitLogForm] SAWTOOTH WORKOUT - Full details:", {
			workout,
			formDataEntries: Array.from(formData.entries()),
		})
	}

	const parsedScoreEntries = parseScoreEntries(formData)
	const timeCappedEntries = parseTimeCappedEntries(formData)
	console.log(
		"[Action] Parsed Score Entries:",
		JSON.stringify(parsedScoreEntries),
	)
	console.log(
		"[Action] Parsed Time Capped Entries:",
		JSON.stringify(timeCappedEntries),
	)

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

	return submitLogToDatabase(
		userId,
		selectedWorkoutId,
		dateStr,
		timezone,
		scaleValue,
		wodScore,
		notesValue,
		setsForDb,
		scheduledInstanceId,
		programmingTrackId,
	)
}
