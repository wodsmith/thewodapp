/**
 * Workout Server Functions for TanStack Start
 * Simplified port of apps/wodsmith/src/server/workouts.ts
 * for use by API routes
 */

import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm"
import { getDb } from "@/db"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import {
	movements,
	tags,
	workoutMovements,
	workouts,
	workoutTags,
} from "@/db/schemas/workouts"
import { autochunk } from "@/utils/batch-query"

/**
 * Get workouts for a team with optional search and filtering
 */
export async function getUserWorkouts({
	teamId,
	trackId,
	search,
	tag,
	movement,
	type,
	limit = 50,
	offset = 0,
}: {
	teamId: string | string[]
	trackId?: string
	search?: string
	tag?: string
	movement?: string
	type?: "all" | "original" | "remix"
	limit?: number
	offset?: number
}): Promise<
	Array<{
		id: string
		name: string
		description: string | null
		scheme: string
		scope: string
		teamId: string | null
		sourceWorkoutId: string | null
		createdAt: Date
		updatedAt: Date
		tags: Array<{ id: string; name: string }>
		movements: Array<{ id: string; name: string; type: string }>
	}>
> {
	const db = getDb()

	// Determine which joins we need
	const needsTrackJoin = !!trackId
	const needsTagJoin = !!tag
	const needsMovementJoin = !!movement

	// Build conditions
	const conditions: ReturnType<typeof eq>[] = []

	// Base condition: team-owned or public workouts
	const teamIds = Array.isArray(teamId) ? teamId : [teamId]
	const teamOrPublicCondition = or(
		inArray(workouts.teamId, teamIds),
		eq(workouts.scope, "public"),
	)
	if (teamOrPublicCondition) {
		conditions.push(teamOrPublicCondition)
	}

	// Type filter
	if (type === "original") {
		conditions.push(isNull(workouts.sourceWorkoutId))
	} else if (type === "remix") {
		conditions.push(isNotNull(workouts.sourceWorkoutId))
	}

	// Track filter
	if (trackId) {
		conditions.push(eq(trackWorkoutsTable.trackId, trackId))
	}

	// Tag filter
	if (tag) {
		conditions.push(eq(tags.name, tag))
	}

	// Movement filter
	if (movement) {
		conditions.push(eq(movements.name, movement))
	}

	// Search filter
	if (search) {
		const searchLower = search.toLowerCase()
		const searchCondition = or(
			sql`LOWER(${workouts.name}) LIKE ${`%${searchLower}%`}`,
			sql`LOWER(${workouts.description}) LIKE ${`%${searchLower}%`}`,
		)
		if (searchCondition) {
			conditions.push(searchCondition)
		}
	}

	// Get matching workout IDs if we have join-based filters
	let filteredWorkoutIds: string[] | null = null

	if (needsTrackJoin || needsTagJoin || needsMovementJoin) {
		let idQuery = db.select({ id: workouts.id }).from(workouts).$dynamic()

		if (needsTrackJoin) {
			idQuery = idQuery.innerJoin(
				trackWorkoutsTable,
				eq(trackWorkoutsTable.workoutId, workouts.id),
			)
		}
		if (needsTagJoin) {
			idQuery = idQuery
				.innerJoin(workoutTags, eq(workoutTags.workoutId, workouts.id))
				.innerJoin(tags, eq(workoutTags.tagId, tags.id))
		}
		if (needsMovementJoin) {
			idQuery = idQuery
				.innerJoin(
					workoutMovements,
					eq(workoutMovements.workoutId, workouts.id),
				)
				.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
		}

		const matchingRows = await idQuery.where(
			conditions.length > 0 ? and(...conditions) : undefined,
		)

		const idSet = new Set<string>()
		for (const row of matchingRows) {
			idSet.add(row.id)
		}
		filteredWorkoutIds = Array.from(idSet)

		if (filteredWorkoutIds.length === 0) {
			return []
		}
	}

	// Build main conditions
	const mainConditions = filteredWorkoutIds
		? [inArray(workouts.id, filteredWorkoutIds)]
		: conditions

	// Fetch workouts
	const workoutsList = await db
		.select({
			id: workouts.id,
			name: workouts.name,
			description: workouts.description,
			scheme: workouts.scheme,
			scope: workouts.scope,
			teamId: workouts.teamId,
			sourceWorkoutId: workouts.sourceWorkoutId,
			createdAt: workouts.createdAt,
			updatedAt: workouts.updatedAt,
		})
		.from(workouts)
		.where(mainConditions.length > 0 ? and(...mainConditions) : undefined)
		.orderBy(desc(workouts.updatedAt))
		.limit(limit)
		.offset(offset)

	// Fetch related tags and movements
	const workoutIds = workoutsList.map((w) => w.id)

	if (workoutIds.length === 0) {
		return []
	}

	const [tagsByWorkoutId, movementsByWorkoutId] = await Promise.all([
		fetchTagsByWorkoutId(db, workoutIds),
		fetchMovementsByWorkoutId(db, workoutIds),
	])

	return workoutsList.map((w) => ({
		...w,
		tags: tagsByWorkoutId.get(w.id) || [],
		movements: movementsByWorkoutId.get(w.id) || [],
	}))
}

/**
 * Helper function to fetch tags by workout IDs
 */
async function fetchTagsByWorkoutId(
	db: ReturnType<typeof getDb>,
	workoutIds: string[],
): Promise<Map<string, Array<{ id: string; name: string }>>> {
	if (workoutIds.length === 0) return new Map()

	const workoutTagsData = await autochunk(
		{ items: workoutIds },
		async (chunk) =>
			db
				.select({
					workoutId: workoutTags.workoutId,
					tagId: tags.id,
					tagName: tags.name,
				})
				.from(workoutTags)
				.innerJoin(tags, eq(workoutTags.tagId, tags.id))
				.where(inArray(workoutTags.workoutId, chunk)),
	)

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

	return tagsByWorkoutId
}

/**
 * Helper function to fetch movements by workout IDs
 */
async function fetchMovementsByWorkoutId(
	db: ReturnType<typeof getDb>,
	workoutIds: string[],
): Promise<Map<string, Array<{ id: string; name: string; type: string }>>> {
	if (workoutIds.length === 0) return new Map()

	const workoutMovementsData = await autochunk(
		{ items: workoutIds },
		async (chunk) =>
			db
				.select({
					workoutId: workoutMovements.workoutId,
					movementId: movements.id,
					movementName: movements.name,
					movementType: movements.type,
				})
				.from(workoutMovements)
				.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
				.where(inArray(workoutMovements.workoutId, chunk)),
	)

	const movementsByWorkoutId = new Map<
		string,
		Array<{ id: string; name: string; type: string }>
	>()

	for (const item of workoutMovementsData) {
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

	return movementsByWorkoutId
}
