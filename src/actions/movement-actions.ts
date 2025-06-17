import { getDB } from "@/db"
import { MOVEMENT_TYPE_VALUES } from "@/db/schema"
import {
	createMovement,
	getAllMovements,
	getMovementById,
	getWorkoutsByMovementId,
} from "@/server/movements"
import { z } from "zod"
import { ZSAError, createServerAction } from "zsa"

export const getAllMovementsAction = createServerAction().handler(async () => {
	try {
		const db = getDB()
		const movements = await getAllMovements()
		return { success: true, data: movements }
	} catch (error) {
		console.error("Failed to get movements:", error)

		if (error instanceof ZSAError) {
			throw error
		}

		throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get movements")
	}
})

const createMovementActionSchema = z.object({
	name: z.string().min(1),
	type: z.enum(MOVEMENT_TYPE_VALUES),
})

export type CreateMovementActionInput = z.infer<
	typeof createMovementActionSchema
>

/**
 * Create a new movement
 */
export const createMovementAction = createServerAction()
	.input(createMovementActionSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDB()
			const result = await createMovement(db, input)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to create movement:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create movement")
		}
	})

export const getMovementByIdAction = createServerAction()
	.input(z.object({ id: z.string().min(1, "Movement ID is required") }))
	.handler(async ({ input }) => {
		try {
			const movement = await getMovementById(input.id)
			return { success: true, data: movement }
		} catch (error) {
			console.error("Failed to get movement:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get movement")
		}
	})

export const getWorkoutsByMovementIdAction = createServerAction()
	.input(z.object({ movementId: z.string().min(1, "Movement ID is required") }))
	.handler(async ({ input }) => {
		try {
			const workouts = await getWorkoutsByMovementId(input.movementId)
			return { success: true, data: workouts }
		} catch (error) {
			console.error("Failed to get workouts by movement:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get workouts by movement",
			)
		}
	})
