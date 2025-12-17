"use server"

import { createServerAction, ZSAError } from "@repo/zsa"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
	getLogsByUser,
	getScoreById,
	getScoreRoundsById,
	savePersonalLogScore,
	updatePersonalLogScore,
} from "@/server/logs"

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

const submitPersonalLogScoreSchema = z.object({
	selectedWorkoutId: z.string().min(1),
	date: z.string().min(1),
	notes: z.string().optional(),
	// New scaling fields
	scalingLevelId: z.string().nullable().optional(),
	asRx: z.boolean().nullable().optional(),
	// Legacy scaling fallback
	scale: z.enum(["rx", "scaled", "rx+"]).optional(),
	// Score input (single or multi-round)
	score: z.string().optional(),
	roundScores: z.array(z.object({ score: z.string() })).optional(),
	secondaryScore: z.string().nullable().optional(),
	// Context
	scheduledInstanceId: z.string().nullable().optional(),
	programmingTrackId: z.string().nullable().optional(),
})

export const submitLogFormAction = createServerAction()
	.input(submitPersonalLogScoreSchema)
	.handler(async ({ input }) => {
		try {
			const result = await savePersonalLogScore({
				selectedWorkoutId: input.selectedWorkoutId,
				date: input.date,
				notes: input.notes,
				scalingLevelId: input.scalingLevelId ?? null,
				asRx: input.asRx ?? null,
				scale: input.scale,
				score: input.score,
				roundScores: input.roundScores,
				secondaryScore: input.secondaryScore ?? null,
				scheduledInstanceId: input.scheduledInstanceId ?? null,
				programmingTrackId: input.programmingTrackId ?? null,
			})

			revalidatePath("/log")
			revalidatePath("/workouts")
			revalidatePath("/dashboard")
			revalidatePath("/movements")
			revalidatePath(`/workouts/${input.selectedWorkoutId}`)

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to submit personal log score:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to submit log")
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
const updatePersonalLogScoreSchema = submitPersonalLogScoreSchema.extend({
	scoreId: z.string().min(1),
})

export const updateResultAction = createServerAction()
	.input(updatePersonalLogScoreSchema)
	.handler(async ({ input }) => {
		try {
			await updatePersonalLogScore({
				scoreId: input.scoreId,
				selectedWorkoutId: input.selectedWorkoutId,
				date: input.date,
				notes: input.notes,
				scalingLevelId: input.scalingLevelId ?? null,
				asRx: input.asRx ?? null,
				scale: input.scale,
				score: input.score,
				roundScores: input.roundScores,
				secondaryScore: input.secondaryScore ?? null,
				scheduledInstanceId: input.scheduledInstanceId ?? null,
				programmingTrackId: input.programmingTrackId ?? null,
			})

			revalidatePath("/log")
			revalidatePath("/workouts")
			revalidatePath("/dashboard")
			revalidatePath("/movements")
			revalidatePath(`/workouts/${input.selectedWorkoutId}`)

			return { success: true }
		} catch (error) {
			console.error("Failed to update personal log score:", error)
			if (error instanceof ZSAError) throw error
			if (error instanceof Error) throw new ZSAError("ERROR", error.message)
			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update score")
		}
	})
