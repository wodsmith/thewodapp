import { createServerFn } from "@tanstack/react-start/server"
import { z } from "zod"
import { getDb } from "~/db/index.server"
import { MOVEMENT_TYPE_VALUES } from "~/db/schema.server"
import {
	createMovement,
	getAllMovements,
	getMovementById,
	getWorkoutsByMovementId,
} from "~/server/movements"

export const getAllMovementsFn = createServerFn({ method: "POST" })
	.validator(z.object({}))
	.handler(async () => {
		try {
			const movements = await getAllMovements()
			return { success: true, data: movements }
		} catch (error) {
			console.error("Failed to get movements:", error)
			throw error
		}
	})

const createMovementSchema = z.object({
	name: z.string().min(1),
	type: z.enum(MOVEMENT_TYPE_VALUES),
})

/**
 * Create a new movement
 */
export const createMovementFn = createServerFn({ method: "POST" })
	.validator(createMovementSchema)
	.handler(async ({ data }) => {
		try {
			const db = getDb()
			const result = await createMovement(db, data)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to create movement:", error)
			throw error
		}
	})

export const getMovementByIdFn = createServerFn({ method: "POST" })
	.validator(z.object({ id: z.string().min(1, "Movement ID is required") }))
	.handler(async ({ data }) => {
		try {
			const movement = await getMovementById(data.id)
			return { success: true, data: movement }
		} catch (error) {
			console.error("Failed to get movement:", error)
			throw error
		}
	})

export const getWorkoutsByMovementIdFn = createServerFn({ method: "POST" })
	.validator(
		z.object({ movementId: z.string().min(1, "Movement ID is required") }),
	)
	.handler(async ({ data }) => {
		try {
			const workouts = await getWorkoutsByMovementId(data.movementId)
			return { success: true, data: workouts }
		} catch (error) {
			console.error("Failed to get workouts by movement:", error)
			throw error
		}
	})
