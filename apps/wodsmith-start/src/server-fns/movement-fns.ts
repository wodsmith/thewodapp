/**
 * Movement Server Functions for TanStack Start
 */

import { createServerFn } from "@tanstack/react-start"
import { eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	MOVEMENT_TYPE_VALUES,
	movements,
	tags,
	workoutMovements,
	workouts,
	workoutTags,
} from "@/db/schemas/workouts"
import { getSessionFromCookie, requireAdmin } from "@/utils/auth"

/**
 * Get all movements available in the system
 */
export const getAllMovementsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const allMovements = await db.select().from(movements)

		return { movements: allMovements }
	},
)

// Input validation schema for creating a movement
const createMovementInputSchema = z.object({
	name: z.string().min(1, "Name is required"),
	type: z.enum(MOVEMENT_TYPE_VALUES),
})

export type CreateMovementInput = z.infer<typeof createMovementInputSchema>

/**
 * Create a new movement
 */
export const createMovementFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createMovementInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication and admin role
		await requireAdmin()

		const movementId = crypto.randomUUID()

		await db.insert(movements).values({
			id: movementId,
			name: data.name,
			type: data.type,
		})

		const [createdMovement] = await db
			.select()
			.from(movements)
			.where(eq(movements.id, movementId))
			.limit(1)

		return { movement: createdMovement }
	})

// Input validation schema for getting a movement by ID
const getMovementByIdInputSchema = z.object({
	id: z.string().min(1, "Movement ID is required"),
})

/**
 * Get a single movement by ID
 */
export const getMovementByIdFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getMovementByIdInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const [movement] = await db
			.select()
			.from(movements)
			.where(eq(movements.id, data.id))
			.limit(1)

		return { movement: movement || null }
	})

// Input validation schema for getting workouts by movement ID
const getWorkoutsByMovementIdInputSchema = z.object({
	movementId: z.string().min(1, "Movement ID is required"),
})

/**
 * Get all workouts that include a specific movement
 * Returns workouts with their tags and movements
 */
export const getWorkoutsByMovementIdFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getWorkoutsByMovementIdInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Get workout IDs that include this movement
		const workoutMovementRows = await db
			.select()
			.from(workoutMovements)
			.where(eq(workoutMovements.movementId, data.movementId))

		const workoutIds = workoutMovementRows
			.map((wm) => wm.workoutId)
			.filter((id): id is string => id !== null)

		if (workoutIds.length === 0) {
			return { workouts: [] }
		}

		// Get the actual workouts
		// Note: 100 parameter batch limit, but for typical use cases this should be fine
		// If this becomes an issue, implement batching similar to autochunk in the Next.js version
		const workoutsData = await db
			.select()
			.from(workouts)
			.where(inArray(workouts.id, workoutIds))

		// Get tags for these workouts
		const workoutTagsData = await db
			.select({
				workoutId: workoutTags.workoutId,
				tagId: tags.id,
				tagName: tags.name,
			})
			.from(workoutTags)
			.innerJoin(tags, eq(workoutTags.tagId, tags.id))
			.where(inArray(workoutTags.workoutId, workoutIds))

		const tagsByWorkoutId = new Map<
			string,
			Array<{ id: string; name: string }>
		>()
		for (const item of workoutTagsData) {
			if (!tagsByWorkoutId.has(item.workoutId)) {
				tagsByWorkoutId.set(item.workoutId, [])
			}
			tagsByWorkoutId.get(item.workoutId)?.push({
				id: item.tagId,
				name: item.tagName,
			})
		}

		// Get all movements for these workouts
		const allWorkoutMovementsData = await db
			.select({
				workoutId: workoutMovements.workoutId,
				movementId: movements.id,
				movementName: movements.name,
				movementType: movements.type,
			})
			.from(workoutMovements)
			.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
			.where(inArray(workoutMovements.workoutId, workoutIds))

		const movementsByWorkoutId = new Map<
			string,
			Array<{
				id: string
				name: string
				type: "weightlifting" | "gymnastic" | "monostructural"
			}>
		>()
		for (const item of allWorkoutMovementsData) {
			if (item.workoutId && !movementsByWorkoutId.has(item.workoutId)) {
				movementsByWorkoutId.set(item.workoutId, [])
			}
			if (item.workoutId) {
				movementsByWorkoutId.get(item.workoutId)?.push({
					id: item.movementId,
					name: item.movementName,
					type: item.movementType,
				})
			}
		}

		// Compose final structure
		const workoutsWithRelations = workoutsData.map((w) => ({
			...w,
			tags: tagsByWorkoutId.get(w.id) || [],
			movements: movementsByWorkoutId.get(w.id) || [],
		}))

		return { workouts: workoutsWithRelations }
	})
