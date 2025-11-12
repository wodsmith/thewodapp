import "server-only"
import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ZSAError } from "@repo/zsa"
import { getDb } from "@/db"
import {
	MOVEMENT_TYPE_VALUES,
	movements,
	tags,
	workoutMovements,
	workouts,
	workoutTags,
} from "@/db/schema"
import { requireVerifiedEmail } from "@/utils/auth"

export const VALID_MOVEMENT_TYPES = movements.type

const MOVEMENT_TYPE_SCHEMA = z.enum(MOVEMENT_TYPE_VALUES)

/**
 * Get all movements available in the system
 */
export async function getAllMovements() {
	const db = getDb()
	const session = await requireVerifiedEmail()

	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const allMovements = await db.select().from(movements)

	return allMovements
}

/**
 * Get a single movement by ID
 */
export async function getMovementById(id: string) {
	const db = getDb()

	const movement = await db
		.select()
		.from(movements)
		.where(eq(movements.id, id))
		.get()

	return movement
}

/**
 * Get all workouts that include a specific movement
 */
export async function getWorkoutsByMovementId(movementId: string) {
	const db = getDb()

	// Get workout IDs that include this movement
	const workoutMovementRows = await db
		.select()
		.from(workoutMovements)
		.where(eq(workoutMovements.movementId, movementId))

	const workoutIds = workoutMovementRows
		.map((wm) => wm.workoutId)
		.filter((id): id is string => id !== null)

	if (workoutIds.length === 0) {
		return []
	}

	// Get the actual workouts
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

	const tagsByWorkoutId = new Map<string, Array<{ id: string; name: string }>>()
	for (const item of workoutTagsData) {
		if (!tagsByWorkoutId.has(item.workoutId)) {
			tagsByWorkoutId.set(item.workoutId, [])
		}
		tagsByWorkoutId.get(item.workoutId)?.push({
			id: item.tagId,
			name: item.tagName,
		})
	}

	// Get movements for these workouts
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
	return workoutsData.map((w) => ({
		...w,
		tags: tagsByWorkoutId.get(w.id) || [],
		movements: movementsByWorkoutId.get(w.id) || [],
	}))
}

// Create a new movement
export async function createMovement(
	db: ReturnType<typeof getDb>,
	data: {
		name: string
		type: string
		// userId is not in the current schema for movements table
		userId?: string
	},
) {
	console.log(
		"[server/functions/movement] createMovement called with data:",
		data,
	)
	const { name, type: rawType } = data

	const lowerCaseType = rawType.toLowerCase()

	const parseResult = MOVEMENT_TYPE_SCHEMA.safeParse(lowerCaseType)
	if (!parseResult.success) {
		const allowed = MOVEMENT_TYPE_SCHEMA.options.join(", ")
		const errorMessage = `Invalid movement type: '${lowerCaseType}'. Must be one of: ${allowed}.`
		console.error(`[server/functions/movement] ${errorMessage}`)
		throw new Error(errorMessage)
	}

	const movementType = parseResult.data

	if (!name) {
		// type is already validated by implication above
		console.error("[server/functions/movement] Name is required.")
		throw new Error("Movement name is required.")
	}

	const movementId = crypto.randomUUID()
	console.log(`[server/functions/movement] Generated movementId: ${movementId}`)

	try {
		await db.insert(movements).values({
			id: movementId,
			name,
			type: movementType,
		})
		console.log(
			`[server/functions/movement] Movement created successfully: ${movementId}`,
		)

		revalidatePath("/movements")
		revalidatePath("/") // Revalidate home page if it lists movements or related data
		console.log("[server/functions/movement] Revalidated paths: /movements, /")

		// Return the created movement or its ID, could be useful for the client
		// For now, the action in page.tsx doesn't expect a return value for redirection
		return { id: movementId, name, movementType }
	} catch (error) {
		console.error(
			`[server/functions/movement] Error creating movement '${name}':`,
			error,
		)
		// Consider more specific error messages based on error type
		throw new Error("Failed to create movement in the database.")
	}
}
