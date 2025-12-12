import { createServerFn } from "@tanstack/react-start/server"
import { z } from "zod"
import type { Workout } from "~/db/schema.server"
import {
	getLogsByUser,
	getResultById,
	getResultSetsById,
	submitLogForm,
	updateResult,
} from "~/server/logs"
import type { ResultSetInput } from "~/types"

/**
 * Get logs by user ID
 */
export const getLogsByUserFn = createServerFn({ method: "POST" })
	.validator(z.object({ userId: z.string().min(1, "User ID is required") }))
	.handler(async ({ data }) => {
		try {
			const logs = await getLogsByUser(data.userId)
			return { success: true, data: logs }
		} catch (error) {
			console.error("Failed to get logs by user:", error)
			throw error
		}
	})

/**
 * Get result sets by result ID
 */
export const getResultSetsByIdFn = createServerFn({ method: "POST" })
	.validator(z.object({ resultId: z.string().min(1, "Result ID is required") }))
	.handler(async ({ data }) => {
		try {
			const sets = await getResultSetsById(data.resultId)
			return { success: true, data: sets }
		} catch (error) {
			console.error("Failed to get result sets:", error)
			throw error
		}
	})

export const submitLogFormFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			userId: z.string().min(1, "User ID is required"),
			workouts: z.array(z.any()),
			formData: z.instanceof(FormData),
		}),
	)
	.handler(async ({ data }) => {
		try {
			console.log("[submitLogFormFn] START with input:", {
				userId: data.userId,
				workoutsCount: data.workouts.length,
				formDataKeys: Array.from(data.formData.keys()),
				workoutIds: data.workouts.map((w: Workout) => w.id),
			})

			const selectedWorkoutId = data.formData.get("selectedWorkoutId") as string
			const selectedWorkout = data.workouts.find(
				(w: Workout) => w.id === selectedWorkoutId,
			)

			console.log("[submitLogFormFn] Selected workout details:", {
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

			const formDataEntries: Record<string, string> = {}
			data.formData.forEach((value, key) => {
				formDataEntries[key] = String(value)
			})
			console.log("[submitLogFormFn] Form data entries:", formDataEntries)

			const result = await submitLogForm(
				data.userId,
				data.workouts,
				data.formData,
			)

			console.log("[submitLogFormFn] submitLogForm returned:", result)

			if (result && "error" in result) {
				console.error(
					"[submitLogFormFn] Error from submitLogForm:",
					result.error,
				)
				throw new Error(result.error)
			}

			console.log("[submitLogFormFn] SUCCESS - returning result:", result)
			return { success: true, data: result }
		} catch (error) {
			console.error("[submitLogFormFn] CAUGHT ERROR:", error)
			console.error("[submitLogFormFn] Error details:", {
				name: error instanceof Error ? error.name : "Unknown",
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : "No stack trace",
			})
			throw error
		}
	})

/**
 * Get a single result by ID
 */
export const getResultByIdFn = createServerFn({ method: "POST" })
	.validator(z.object({ resultId: z.string().min(1, "Result ID is required") }))
	.handler(async ({ data }) => {
		try {
			const result = await getResultById(data.resultId)
			if (!result) {
				throw new Error("Result not found")
			}
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to get result by ID:", error)
			throw error
		}
	})

/**
 * Update an existing result
 */
export const updateResultFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			resultId: z.string().min(1, "Result ID is required"),
			userId: z.string().min(1, "User ID is required"),
			workouts: z.array(z.any()),
			formData: z.instanceof(FormData),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const result = await updateResultForm(
				data.resultId,
				data.userId,
				data.workouts,
				data.formData,
			)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to update result:", error)
			throw error
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
		throw new Error("No workout selected")
	}

	const workout = workouts.find((w) => w.id === selectedWorkoutId)
	if (!workout) {
		throw new Error("Selected workout not found")
	}

	const parsedScoreEntries = parseScoreEntries(formData)
	const timeCappedEntries = parseTimeCappedEntries(formData)

	const { parseTimeScoreToSeconds, formatSecondsToTime } = await import(
		"~/lib/utils"
	)
	const { fromZonedTime } = await import("date-fns-tz")

	const setsForDb: ResultSetInput[] = []
	let totalSecondsForWodScore = 0
	const isRoundsAndRepsWorkout =
		!!workout.repsPerRound && workout.repsPerRound > 0
	const isTimeBasedWodScore =
		workout.scheme === "time" || workout.scheme === "time-with-cap"

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

	let finalWodScoreSummary = ""
	const hasTimeCappedRounds = timeCappedEntries.some((capped) => capped)

	const { getDefaultScoreType, aggregateScores } = await import("~/server/logs")

	const effectiveScoreType =
		workout.scoreType || getDefaultScoreType(workout.scheme)
	const shouldAggregate =
		(workout.roundsToScore || 1) > 1 && !hasTimeCappedRounds

	if (isTimeBasedWodScore && !hasTimeCappedRounds) {
		if (shouldAggregate) {
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

	const dateInTargetTz = fromZonedTime(`${dateStr}T00:00:00`, timezone)
	const timestamp = dateInTargetTz.getTime()

	let scalingLevelId = explicitScalingLevelId
	let asRx = explicitAsRx

	if (!scalingLevelId || asRx === undefined) {
		const { mapLegacyScaleToScalingLevel } = await import("~/server/logs")

		const mapped = await mapLegacyScaleToScalingLevel({
			workoutId: selectedWorkoutId,
			programmingTrackId,
			scale: scaleValue,
		})

		if (!scalingLevelId) {
			scalingLevelId = mapped.scalingLevelId
		}
		if (asRx === undefined) {
			asRx = mapped.asRx
		}
	}

	await updateResult({
		resultId,
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

	return { success: true }
}
