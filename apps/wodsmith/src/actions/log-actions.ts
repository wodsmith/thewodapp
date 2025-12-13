"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServerAction, ZSAError } from "@repo/zsa"
import type { Workout } from "@/db/schema"
import {
	getLogsByUser,
	getScoreById,
	getScoreRoundsById,
	submitLogForm,
	updateScore,
	type WorkoutScoreInfo,
} from "@/server/logs"
import type { ResultSetInput } from "@/types"

/**
 * Get logs by user ID
 */
export const getLogsByUserAction = createServerAction()
	.input(z.object({ userId: z.string().min(1, "User ID is required") }))
	.handler(async ({ input }) => {
		try {
			const logs = await getLogsByUser(input.userId)
			return { success: true, data: logs }
		} catch (error) {
			console.error("Failed to get logs by user:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get logs by user")
		}
	})

/**
 * Get score rounds by score ID
 */
export const getScoreRoundsByIdAction = createServerAction()
	.input(z.object({ scoreId: z.string().min(1, "Score ID is required") }))
	.handler(async ({ input }) => {
		try {
			const rounds = await getScoreRoundsById(input.scoreId)
			return { success: true, data: rounds }
		} catch (error) {
			console.error("Failed to get score rounds:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get score rounds")
		}
	})

export const submitLogFormAction = createServerAction()
	.input(
		z.object({
			userId: z.string().min(1, "User ID is required"),
			// TODO: Add workout schema
			workouts: z.array(z.any()),
			formData: z.instanceof(FormData),
		}),
	)
	.handler(async ({ input }) => {
		console.log("[submitLogFormAction] START with input:", {
			userId: input.userId,
			workoutsCount: input.workouts.length,
			formDataKeys: Array.from(input.formData.keys()),
			workoutIds: input.workouts.map((w: Workout) => w.id),
		})

		// Log the specific workout being submitted
		const selectedWorkoutId = input.formData.get("selectedWorkoutId") as string
		const selectedWorkout = input.workouts.find(
			(w: Workout) => w.id === selectedWorkoutId,
		)

		console.log("[submitLogFormAction] Selected workout details:", {
			id: selectedWorkoutId,
			workout: selectedWorkout
				? {
						name: selectedWorkout.name,
						scheme: selectedWorkout.scheme,
						repsPerRound: selectedWorkout.repsPerRound,
						roundsToScore: selectedWorkout.roundsToScore,
					}
				: "NOT FOUND",
		})

		// Log all form data for debugging
		const formDataEntries: Record<string, string> = {}
		input.formData.forEach((value, key) => {
			formDataEntries[key] = String(value)
		})
		console.log("[submitLogFormAction] Form data entries:", formDataEntries)

		try {
			const result = await submitLogForm(
				input.userId,
				input.workouts,
				input.formData,
			)

			console.log("[submitLogFormAction] submitLogForm returned:", result)

			// Check if there was an error
			if (result && "error" in result) {
				console.error(
					"[submitLogFormAction] Error from submitLogForm:",
					result.error,
				)
				throw new ZSAError("ERROR", result.error)
			}

			// Revalidate all pages that display workout results
			revalidatePath("/log")
			revalidatePath("/workouts")
			revalidatePath("/dashboard")
			revalidatePath("/movements")

			// Also revalidate specific workout pages if workoutId is present
			const workoutId = input.formData.get("selectedWorkoutId") as string | null
			if (workoutId) {
				revalidatePath(`/workouts/${workoutId}`)
			}

			console.log("[submitLogFormAction] SUCCESS - returning result:", result)
			return { success: true, data: result }
		} catch (error) {
			console.error("[submitLogFormAction] CAUGHT ERROR:", error)
			console.error("[submitLogFormAction] Error details:", {
				name: error instanceof Error ? error.name : "Unknown",
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : "No stack trace",
			})

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to submit log form")
		}
	})

/**
 * Get a single score by ID
 */
export const getScoreByIdAction = createServerAction()
	.input(z.object({ scoreId: z.string().min(1, "Score ID is required") }))
	.handler(async ({ input }) => {
		try {
			const score = await getScoreById(input.scoreId)
			if (!score) {
				throw new ZSAError("NOT_FOUND", "Score not found")
			}
			return { success: true, data: score }
		} catch (error) {
			console.error("Failed to get score by ID:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get score")
		}
	})

/**
 * Update an existing result
 */
export const updateResultAction = createServerAction()
	.input(
		z.object({
			resultId: z.string().min(1, "Result ID is required"),
			userId: z.string().min(1, "User ID is required"),
			workouts: z.array(z.any()),
			formData: z.instanceof(FormData),
		}),
	)
	.handler(async ({ input }) => {
		try {
			// Parse form data similar to submitLogForm
			const result = await updateResultForm(
				input.resultId,
				input.userId,
				input.workouts,
				input.formData,
			)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to update result:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update result")
		}
	})

// Helper function to update result form
async function updateResultForm(
	resultId: string,
	userId: string,
	workouts: Workout[],
	formData: FormData,
) {
	const { headers } = await import("next/headers")
	const headerList = await headers()
	const timezone = headerList.get("x-vercel-ip-timezone") ?? "America/Denver"

	// Reuse the same parsing logic from submitLogForm
	const parseBasicFormData = (formData: FormData) => {
		const selectedWorkoutId = formData.get("selectedWorkoutId") as string | null
		const dateStr = formData.get("date") as string
		const scaleValue = formData.get("scale") as "rx" | "scaled" | "rx+"
		const notesValue = formData.get("notes") as string
		const scheduledInstanceId = formData.get("scheduledInstanceId") as
			| string
			| null
		const programmingTrackId = formData.get("programmingTrackId") as
			| string
			| null
		const scalingLevelId = formData.get("scalingLevelId") as string | null
		const asRx = formData.get("asRx") === "true"
		return {
			selectedWorkoutId,
			dateStr,
			scaleValue,
			notesValue,
			scheduledInstanceId,
			programmingTrackId,
			scalingLevelId,
			asRx,
		}
	}

	const parseScoreEntries = (
		formData: FormData,
	): Array<{ parts: string[] }> => {
		const parsedScoreEntries: Array<{ parts: string[] }> = []
		let roundIdx = 0
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

	const parseTimeCappedEntries = (formData: FormData): boolean[] => {
		const timeCappedEntries: boolean[] = []
		let roundIdx = 0
		while (formData.has(`timeCapped[${roundIdx}]`)) {
			const isTimeCapped = formData.get(`timeCapped[${roundIdx}]`) === "true"
			timeCappedEntries.push(isTimeCapped)
			roundIdx++
		}
		return timeCappedEntries
	}

	const {
		selectedWorkoutId,
		dateStr,
		scaleValue,
		notesValue,
		scheduledInstanceId,
		programmingTrackId,
		scalingLevelId: explicitScalingLevelId,
		asRx: explicitAsRx,
	} = parseBasicFormData(formData)

	if (!selectedWorkoutId) {
		throw new ZSAError("ERROR", "No workout selected")
	}

	const workout = workouts.find((w) => w.id === selectedWorkoutId)
	if (!workout) {
		throw new ZSAError("NOT_FOUND", "Selected workout not found")
	}

	// Parse and process scores (similar to submitLogForm)
	const parsedScoreEntries = parseScoreEntries(formData)
	const timeCappedEntries = parseTimeCappedEntries(formData)

	// Import necessary utilities
	const { parseTimeScoreToSeconds, formatSecondsToTime } = await import(
		"@/lib/utils"
	)
	const { fromZonedTime } = await import("date-fns-tz")

	// Process scores similar to submitLogForm
	const setsForDb: ResultSetInput[] = []
	let totalSecondsForWodScore = 0
	const isRoundsAndRepsWorkout =
		!!workout.repsPerRound && workout.repsPerRound > 0
	const isTimeBasedWodScore =
		workout.scheme === "time" || workout.scheme === "time-with-cap"

	// Process each score entry
	for (let k = 0; k < parsedScoreEntries.length; k++) {
		const entry = parsedScoreEntries[k]
		if (!entry) {
			continue
		}
		const setNumber = k + 1
		const scoreParts = entry.parts

		if (isRoundsAndRepsWorkout) {
			const roundsStr = scoreParts[0] || "0"
			const repsStr = scoreParts[1] || "0"
			const roundsCompleted = Number.parseInt(roundsStr, 10)
			const repsCompleted = Number.parseInt(repsStr, 10)

			if (!Number.isNaN(roundsCompleted) && !Number.isNaN(repsCompleted)) {
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
			}
		} else if (
			workout.scheme === "time" ||
			workout.scheme === "time-with-cap"
		) {
			const isTimeCapped = timeCappedEntries[k] || false
			const scoreStr = scoreParts[0]

			if (scoreStr && scoreStr.trim() !== "") {
				if (workout.scheme === "time-with-cap" && isTimeCapped) {
					// Time capped - expecting reps
					const repsCompleted = Number.parseInt(scoreStr, 10)
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
					// Not time capped or regular time workout - expecting time
					const timeInSeconds = parseTimeScoreToSeconds(scoreStr)
					if (timeInSeconds !== null) {
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
					}
				}
			}
		} else {
			const scoreStr = scoreParts[0]
			if (scoreStr && scoreStr.trim() !== "") {
				const numericScore = Number.parseInt(scoreStr, 10)
				if (!Number.isNaN(numericScore)) {
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
	}

	// Generate WOD score summary
	let finalWodScoreSummary = ""
	// Check if any rounds are time capped - if so, use descriptive format instead of time-only format
	const hasTimeCappedRounds = timeCappedEntries.some((capped) => capped)

	// Import helper functions for score aggregation
	const { getDefaultScoreType, aggregateScores } = await import("@/server/logs")

	// Always use scoreType (with fallback to default) for multiple rounds
	const effectiveScoreType =
		workout.scoreType || getDefaultScoreType(workout.scheme)
	const shouldAggregate =
		(workout.roundsToScore || 1) > 1 && !hasTimeCappedRounds

	if (isTimeBasedWodScore && !hasTimeCappedRounds) {
		if (shouldAggregate) {
			// Aggregate time values based on scoreType
			const timeValues = setsForDb
				.map((set) => set.time)
				.filter((t): t is number => t !== null && t !== undefined && t > 0)

			const aggregated = aggregateScores(timeValues, effectiveScoreType)
			finalWodScoreSummary =
				aggregated !== null ? formatSecondsToTime(aggregated) : ""
		} else {
			finalWodScoreSummary = formatSecondsToTime(totalSecondsForWodScore)
		}
	} else if (shouldAggregate && !isRoundsAndRepsWorkout) {
		// Aggregate non-time scores based on scoreType
		const scoreValues = setsForDb
			.map((set) => set.reps || set.score || 0)
			.filter((s): s is number => s !== null && s > 0)

		const aggregated = aggregateScores(scoreValues, effectiveScoreType)
		finalWodScoreSummary = aggregated !== null ? aggregated.toString() : ""
	} else {
		const scoreSummaries: string[] = []
		for (let k = 0; k < parsedScoreEntries.length; k++) {
			const entry = parsedScoreEntries[k]
			if (!entry) {
				continue
			}
			const scoreParts = entry.parts

			if (isRoundsAndRepsWorkout) {
				const roundsStr = scoreParts[0] || "0"
				const repsStr = scoreParts[1] || "0"
				if (roundsStr !== "0" || repsStr !== "0") {
					scoreSummaries.push(`${roundsStr} + ${repsStr}`)
				}
			} else if (
				workout.scheme === "time" ||
				workout.scheme === "time-with-cap"
			) {
				const isTimeCapped = timeCappedEntries[k] || false
				const scoreStr = scoreParts[0]
				if (scoreStr && scoreStr.trim() !== "") {
					if (workout.scheme === "time-with-cap" && isTimeCapped) {
						scoreSummaries.push(`${scoreStr} reps (time capped)`)
					} else {
						scoreSummaries.push(scoreStr)
					}
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

	// Convert date to timestamp
	const dateInTargetTz = fromZonedTime(`${dateStr}T00:00:00`, timezone)
	const timestamp = dateInTargetTz.getTime()

	// Use explicit scaling values if present, otherwise map from legacy scale
	let scalingLevelId = explicitScalingLevelId
	let asRx = explicitAsRx

	if (!scalingLevelId || asRx === undefined) {
		// Import the mapping function
		const { mapLegacyScaleToScalingLevel } = await import("@/server/logs")

		// Map legacy scale to new scaling fields
		const mapped = await mapLegacyScaleToScalingLevel({
			workoutId: selectedWorkoutId,
			programmingTrackId,
			scale: scaleValue,
		})

		// Use mapped values only if the explicit ones are missing
		if (!scalingLevelId) {
			scalingLevelId = mapped.scalingLevelId
		}
		if (asRx === undefined) {
			asRx = mapped.asRx
		}
	}

	// Build workoutInfo for score encoding
	const workoutInfo = {
		scheme: workout.scheme,
		scoreType: workout.scoreType,
		repsPerRound: workout.repsPerRound,
		roundsToScore: workout.roundsToScore,
		timeCap: workout.timeCap,
		tiebreakScheme: workout.tiebreakScheme,
	}

	// Update the score
	await updateScore({
		scoreId: resultId, // resultId is actually the scoreId now
		userId,
		workoutId: selectedWorkoutId,
		date: timestamp,
		scalingLevelId,
		asRx,
		notes: notesValue,
		setsData: setsForDb,
		scheduledWorkoutInstanceId: scheduledInstanceId,
		workoutInfo,
		hasTimeCappedRounds,
	})

	// Revalidate all pages that display workout results
	revalidatePath("/log")
	revalidatePath("/workouts")
	revalidatePath("/dashboard")
	revalidatePath("/movements")

	// Also revalidate specific workout page
	if (selectedWorkoutId) {
		revalidatePath(`/workouts/${selectedWorkoutId}`)
	}

	return { success: true }
}