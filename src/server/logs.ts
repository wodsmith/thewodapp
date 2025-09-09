import "server-only"
import { createId } from "@paralleldrive/cuid2"
import { fromZonedTime } from "date-fns-tz"
import { desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { ZSAError } from "zsa"
import { getDd } from "@/db"
import { results, sets, workouts } from "@/db/schema"
import { formatSecondsToTime, parseTimeScoreToSeconds } from "@/lib/utils"
import type {
	ResultSet,
	ResultSetInput,
	Workout,
	WorkoutResultWithWorkoutName,
} from "@/types"
import { requireVerifiedEmail } from "@/utils/auth"

/**
 * Get all logs by user ID with workout names
 */
export async function getLogsByUser(
	userId: string,
): Promise<WorkoutResultWithWorkoutName[]> {
	const db = getDd()
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
			.where(eq(results.userId, userId))
			.orderBy(desc(results.date))

		console.log(
			`[getLogsByUser] Found ${logs.length} logs for userId: ${userId}`,
		)
		return logs.map((log) => ({
			...log,
			workoutName: log.workoutName || undefined,
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
	scale,
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
	scale: "rx" | "scaled" | "rx+"
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
	const db = getDd()
	const resultId = `result_${createId()}`

	console.log(
		`[addLog] Adding log for userId: ${userId}, workoutId: ${workoutId}`,
	)

	try {
		// Insert the main result - using timestamp mode for date field
		await db.insert(results).values({
			id: resultId,
			userId,
			workoutId,
			date: new Date(date),
			type,
			scale,
			wodScore,
			notes: notes || null,
			setCount: setsData.length || null,
			scheduledWorkoutInstanceId: scheduledWorkoutInstanceId || null,
			programmingTrackId: programmingTrackId || null,
		})

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

			await db.insert(sets).values(setsToInsert)
			console.log(
				`[addLog] Added ${setsToInsert.length} sets for resultId: ${resultId}`,
			)
		}

		console.log(`[addLog] Successfully added log with resultId: ${resultId}`)
	} catch (error) {
		console.error(`[addLog] Error adding log for userId ${userId}:`, error)
		throw error
	}
}

/**
 * Get result sets by result ID
 */
export async function getResultSetsById(
	resultId: string,
): Promise<ResultSet[]> {
	const db = getDd()
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

interface ProcessedScoresOutput {
	setsForDb: ResultSetInput[]
	totalSecondsForWodScore: number
	error?: { error: string }
}

function processScoreEntries(
	parsedScoreEntries: Array<{ parts: string[] }>,
	workout: Workout,
	isTimeBasedWodScore: boolean,
	isRoundsAndRepsWorkout: boolean,
	atLeastOneScorePartFilled: boolean, // Added to resolve linter issues and use in logic
): ProcessedScoresOutput {
	const setsForDb: ResultSetInput[] = []
	let totalSecondsForWodScore = 0

	for (let k = 0; k < parsedScoreEntries.length; k++) {
		const entry = parsedScoreEntries[k]
		const setNumber = k + 1 // Set numbers are 1-indexed
		const scoreParts = entry.parts

		if (isRoundsAndRepsWorkout) {
			// Expects two parts: scoreParts[0] = rounds, scoreParts[1] = reps
			if (scoreParts.length < 2 && scoreParts[0].trim() === "") {
				if (scoreParts.every((p) => p.trim() === "")) continue // Skip fully empty entries
				return {
					setsForDb: [],
					totalSecondsForWodScore: 0,
					error: { error: `For round ${setNumber}, rounds input is required.` },
				}
			}

			const roundsStr = scoreParts[0] || "0"
			const repsStr = scoreParts[1] || "0"

			const roundsCompleted = Number.parseInt(roundsStr, 10)
			const repsCompleted = Number.parseInt(repsStr, 10)

			if (
				Number.isNaN(roundsCompleted) ||
				(scoreParts[1] !== undefined && Number.isNaN(repsCompleted))
			) {
				return {
					setsForDb: [],
					totalSecondsForWodScore: 0,
					error: {
						error: `Invalid number for rounds or reps for set ${setNumber}. Rounds: '${roundsStr}', Reps: '${repsStr}'.`,
					},
				}
			}
			if (roundsCompleted < 0 || repsCompleted < 0) {
				return {
					setsForDb: [],
					totalSecondsForWodScore: 0,
					error: {
						error: `Rounds and reps for set ${setNumber} cannot be negative.`,
					},
				}
			}
			if (workout.repsPerRound === undefined)
				throw new Error("repsPerRound is required")
			const totalReps =
				roundsCompleted * (workout.repsPerRound ?? 0) + repsCompleted

			setsForDb.push({
				setNumber,
				reps: totalReps,
				score: null,
				weight: null,
				status: null,
				distance: null,
				time: null,
			})
		} else if (workout.scheme === "time") {
			const timeStr = scoreParts[0]
			if (timeStr === undefined || timeStr.trim() === "") {
				if (parsedScoreEntries.length === 1 && !atLeastOneScorePartFilled) {
					// This case is handled by validateParsedScores
				} else if (scoreParts.every((p) => p.trim() === "")) {
					continue // Skip if this specific score entry is completely empty
				}
				return {
					setsForDb: [],
					totalSecondsForWodScore: 0,
					error: { error: `Time input for set ${setNumber} is missing.` },
				}
			}
			const timeInSeconds = parseTimeScoreToSeconds(timeStr)
			if (timeInSeconds === null) {
				return {
					setsForDb: [],
					totalSecondsForWodScore: 0,
					error: {
						error: `Invalid time format for set ${setNumber}: '${timeStr}'. Please use MM:SS or total seconds.`,
					},
				}
			}
			if (isTimeBasedWodScore) {
				totalSecondsForWodScore += timeInSeconds
			}
			setsForDb.push({
				setNumber,
				time: timeInSeconds,
				reps: null,
				weight: null,
				status: null,
				distance: null,
				score: null,
			})
		} else {
			// For schemes like 'reps', 'load', 'points'
			const scoreStr = scoreParts[0]
			if (scoreStr === undefined || scoreStr.trim() === "") {
				if (parsedScoreEntries.length === 1 && !atLeastOneScorePartFilled) {
					// Handled by validateParsedScores
				} else if (scoreParts.every((p) => p.trim() === "")) {
					continue // Skip if this specific score entry is completely empty
				}
				return {
					setsForDb: [],
					totalSecondsForWodScore: 0,
					error: {
						error: `Score input for set ${setNumber} is missing for scheme '${workout.scheme}'.`,
					},
				}
			}
			const numericScore = Number.parseInt(scoreStr, 10)
			if (Number.isNaN(numericScore)) {
				return {
					setsForDb: [],
					totalSecondsForWodScore: 0,
					error: {
						error: `Score for set ${setNumber} ('${scoreStr}') must be a valid number for scheme '${workout.scheme}'.`,
					},
				}
			}
			if (numericScore < 0) {
				return {
					setsForDb: [],
					totalSecondsForWodScore: 0,
					error: {
						error: `Score for set ${setNumber} ('${numericScore}') cannot be negative.`,
					},
				}
			}
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
	return { setsForDb, totalSecondsForWodScore }
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

function generateWodScoreSummary(
	isTimeBasedWodScore: boolean,
	totalSecondsForWodScore: number,
	parsedScoreEntries: Array<{ parts: string[] }>,
	isRoundsAndRepsWorkout: boolean,
	workoutScheme: Workout["scheme"],
	setsForDb: ResultSetInput[], // Added to check conditions for time-based summary
	atLeastOneScorePartFilled: boolean, // Added for conditional logic
): string {
	let finalWodScoreSummary = ""
	if (isTimeBasedWodScore) {
		finalWodScoreSummary = formatSecondsToTime(totalSecondsForWodScore)
		if (
			totalSecondsForWodScore === 0 &&
			setsForDb.some((set) => set?.time && set.time > 0)
		) {
			// This means valid times were logged, but somehow total is still 0. Should not happen.
		} else if (
			totalSecondsForWodScore === 0 &&
			parsedScoreEntries.length > 0 &&
			!atLeastOneScorePartFilled
		) {
			// No score parts filled, an error should have been caught earlier
			// For safety, can return empty or specific string like "No Score"
			finalWodScoreSummary = "" // Or "No Score"
		} else if (
			totalSecondsForWodScore === 0 &&
			setsForDb.length === 0 &&
			atLeastOneScorePartFilled
		) {
			// some input, but no valid sets. Error should be caught.
			// For safety, can return empty or specific string like "No Score"
			finalWodScoreSummary = "" // Or "No Score"
		}
	} else {
		const scoreSummaries: string[] = []
		for (let k = 0; k < parsedScoreEntries.length; k++) {
			const entry = parsedScoreEntries[k]
			const scoreParts = entry.parts

			if (isRoundsAndRepsWorkout) {
				const roundsStr = scoreParts[0] || "0"
				const repsStr = scoreParts[1] || "0"
				if (
					roundsStr === "0" &&
					repsStr === "0" &&
					scoreParts.every((p) => p.trim() === "")
				) {
					// Potentially skip
				} else {
					scoreSummaries.push(`${roundsStr} + ${repsStr}`)
				}
			} else if (workoutScheme === "time") {
				const timeStr = scoreParts[0]
				if (timeStr && timeStr.trim() !== "") {
					scoreSummaries.push(timeStr)
				}
			} else {
				const scoreStr = scoreParts[0]
				if (scoreStr && scoreStr.trim() !== "") {
					scoreSummaries.push(scoreStr)
				}
			}
		}
		finalWodScoreSummary = scoreSummaries.join(", ")
	}
	return finalWodScoreSummary
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

		return await addLog({
			userId,
			workoutId: selectedWorkoutId,
			date: timestamp,
			scale: scaleValue,
			wodScore: finalWodScoreSummary,
			notes: notesValue,
			setsData: setsForDb,
			type: "wod",
			scheduledWorkoutInstanceId: scheduledInstanceId,
			programmingTrackId: programmingTrackId,
		})
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

	console.log("[Action] Date:", dateStr)

	if (!selectedWorkoutId) {
		console.error("[Action] No workout selected")
		return { error: "No workout selected. Please select a workout." }
	}

	const workout = workouts.find((w) => w.id === selectedWorkoutId)

	if (!workout) {
		console.error("[Action] Workout not found for ID:", selectedWorkoutId)
		return { error: "Selected workout not found. Please try again." }
	}

	const parsedScoreEntries = parseScoreEntries(formData)
	console.log(
		"[Action] Parsed Score Entries:",
		JSON.stringify(parsedScoreEntries),
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

	const isRoundsAndRepsWorkout =
		!!workout.repsPerRound && workout.repsPerRound > 0

	const isTimeBasedWodScore =
		workout.scheme === "time" || workout.scheme === "time-with-cap"

	const processResult = processScoreEntries(
		parsedScoreEntries,
		workout,
		isTimeBasedWodScore,
		isRoundsAndRepsWorkout,
		atLeastOneScorePartFilled,
	)

	if (processResult.error) {
		return { error: processResult.error.error }
	}

	const { setsForDb, totalSecondsForWodScore } = processResult

	const processedSetsValidationError = validateProcessedSets(
		setsForDb,
		workout.scheme,
		atLeastOneScorePartFilled,
	)
	if (processedSetsValidationError) {
		return processedSetsValidationError
	}

	const finalWodScoreSummary = generateWodScoreSummary(
		isTimeBasedWodScore,
		totalSecondsForWodScore,
		parsedScoreEntries,
		isRoundsAndRepsWorkout,
		workout.scheme,
		setsForDb,
		atLeastOneScorePartFilled,
	)

	return submitLogToDatabase(
		userId,
		selectedWorkoutId,
		dateStr,
		timezone,
		scaleValue,
		finalWodScoreSummary,
		notesValue,
		setsForDb,
		scheduledInstanceId,
		programmingTrackId,
	)
}
