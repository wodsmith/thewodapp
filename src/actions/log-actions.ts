"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServerAction, ZSAError } from "zsa"
import {
	getLogsByUser,
	getResultById,
	getResultSetsById,
	submitLogForm,
	updateResult,
} from "@/server/logs"
import type { Workout, Set as DBSet } from "@/db/schema"
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
 * Get result sets by result ID
 */
export const getResultSetsByIdAction = createServerAction()
	.input(z.object({ resultId: z.string().min(1, "Result ID is required") }))
	.handler(async ({ input }) => {
		try {
			const sets = await getResultSetsById(input.resultId)
			return { success: true, data: sets }
		} catch (error) {
			console.error("Failed to get result sets:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get result sets")
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
			workoutIds: input.workouts.map((w: any) => w.id),
		})

		// Log the specific workout being submitted
		const selectedWorkoutId = input.formData.get("selectedWorkoutId") as string
		const selectedWorkout = input.workouts.find(
			(w: any) => w.id === selectedWorkoutId,
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
				// Log specific details for the problematic workout
				if (selectedWorkoutId === "workout_pwtf9kdcxqp157lgttav7ia7") {
					console.error(
						"[submitLogFormAction] SAWTOOTH WORKOUT ERROR - Details:",
						{
							error: result.error,
							formData: formDataEntries,
							workout: selectedWorkout,
						},
					)
				}
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
 * Get a single result by ID
 */
export const getResultByIdAction = createServerAction()
	.input(z.object({ resultId: z.string().min(1, "Result ID is required") }))
	.handler(async ({ input }) => {
		try {
			const result = await getResultById(input.resultId)
			if (!result) {
				throw new ZSAError("NOT_FOUND", "Result not found")
			}
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to get result by ID:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get result")
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
		return {
			selectedWorkoutId,
			dateStr,
			scaleValue,
			notesValue,
			scheduledInstanceId,
			programmingTrackId,
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

	const {
		selectedWorkoutId,
		dateStr,
		scaleValue,
		notesValue,
		scheduledInstanceId,
		programmingTrackId,
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
		} else if (workout.scheme === "time") {
			const timeStr = scoreParts[0]
			if (timeStr && timeStr.trim() !== "") {
				const timeInSeconds = parseTimeScoreToSeconds(timeStr)
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
	if (isTimeBasedWodScore) {
		finalWodScoreSummary = formatSecondsToTime(totalSecondsForWodScore)
	} else {
		const scoreSummaries: string[] = []
		for (let k = 0; k < parsedScoreEntries.length; k++) {
			const entry = parsedScoreEntries[k]
			const scoreParts = entry.parts

			if (isRoundsAndRepsWorkout) {
				const roundsStr = scoreParts[0] || "0"
				const repsStr = scoreParts[1] || "0"
				if (roundsStr !== "0" || repsStr !== "0") {
					scoreSummaries.push(`${roundsStr} + ${repsStr}`)
				}
			} else if (workout.scheme === "time") {
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

	// Convert date to timestamp
	const dateInTargetTz = fromZonedTime(`${dateStr}T00:00:00`, timezone)
	const timestamp = dateInTargetTz.getTime()

	// Update the result
	await updateResult({
		resultId,
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
