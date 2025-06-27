"use server"

import { z } from "zod"
import { createServerAction, ZSAError } from "zsa"
import { getLogsByUser, getResultSetsById, submitLogForm } from "@/server/logs"

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
		try {
			const result = await submitLogForm(
				input.userId,
				input.workouts,
				input.formData,
			)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to submit log form:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to submit log form")
		}
	})
