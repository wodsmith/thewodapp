import "server-only"
import { getDB } from "@/db"
import {
	movements,
	programmingTracksTable,
	results,
	tags,
	trackWorkoutsTable,
	workoutMovements,
	workoutTags,
	workouts,
} from "@/db/schema"
import type { Workout } from "@/db/schema"
import { requireVerifiedEmail } from "@/utils/auth"
import { createId } from "@paralleldrive/cuid2"
import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	notInArray,
	or,
} from "drizzle-orm"
import { ZSAError } from "zsa"

/**
 * Helper function to fetch tags by workout IDs
 */
async function fetchTagsByWorkoutId(
	db: ReturnType<typeof getDB>,
	workoutIds: string[],
): Promise<Map<string, Array<{ id: string; name: string }>>> {
	if (workoutIds.length === 0) return new Map()

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

	return tagsByWorkoutId
}

/**
 * Helper function to fetch movements by workout IDs
 */
async function fetchMovementsByWorkoutId(
	db: ReturnType<typeof getDB>,
	workoutIds: string[],
): Promise<Map<string, Array<{ id: string; name: string; type: string }>>> {
	if (workoutIds.length === 0) return new Map()

	const workoutMovementsData = await db
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
		Array<{ id: string; name: string; type: string }>
	>()

	for (const item of workoutMovementsData) {
		if (!movementsByWorkoutId.has(item?.workoutId || "")) {
			movementsByWorkoutId.set(item?.workoutId || "", [])
		}
		movementsByWorkoutId.get(item?.workoutId || "")?.push({
			id: item.movementId,
			name: item.movementName,
			type: item.movementType,
		})
	}

	return movementsByWorkoutId
}

/**
 * Helper function to fetch today's results by workout IDs
 */
async function fetchTodaysResultsByWorkoutId(
	db: ReturnType<typeof getDB>,
	userId: string,
	workoutIds: string[],
): Promise<Map<string, Array<(typeof todaysResults)[0]>>> {
	if (workoutIds.length === 0) return new Map()

	const today = new Date()
	today.setHours(0, 0, 0, 0)
	const tomorrow = new Date(today)
	tomorrow.setDate(tomorrow.getDate() + 1)

	const todaysResults = await db
		.select()
		.from(results)
		.where(
			and(
				eq(results.userId, userId),
				isNotNull(results.workoutId),
				inArray(results.workoutId, workoutIds),
				gte(results.date, today),
				lt(results.date, tomorrow),
			),
		)

	const resultsByWorkoutId = new Map<string, Array<(typeof todaysResults)[0]>>()

	for (const result of todaysResults) {
		if (result.workoutId) {
			const workoutId = result.workoutId

			if (!resultsByWorkoutId.has(workoutId)) {
				resultsByWorkoutId.set(workoutId, [])
			}
			resultsByWorkoutId.get(workoutId)?.push(result)
		}
	}

	return resultsByWorkoutId
}

/**
 * Get all workouts for the current user (public workouts + user's private workouts)
 */
export async function getUserWorkouts({ userId }: { userId: string }) {
	const db = getDB()

	// Base workouts and ids
	const allWorkouts = await db
		.select()
		.from(workouts)
		.where(or(eq(workouts.scope, "public"), eq(workouts.userId, userId)))

	const workoutIds = allWorkouts.map((w) => w.id)

	// Fetch related data in parallel
	const [tagsByWorkoutId, movementsByWorkoutId, resultsByWorkoutId] =
		await Promise.all([
			fetchTagsByWorkoutId(db, workoutIds),
			fetchMovementsByWorkoutId(db, workoutIds),
			fetchTodaysResultsByWorkoutId(db, userId, workoutIds),
		])

	// Compose final structure
	return allWorkouts.map((w) => ({
		...w,
		tags: tagsByWorkoutId.get(w.id) || [],
		movements: movementsByWorkoutId.get(w.id) || [],
		resultsToday: resultsByWorkoutId.get(w.id) || [],
	}))
}

/**
 * Create a new workout with tags and movements
 */
export async function createWorkout({
	workout,
	tagIds,
	movementIds,
	userId,
}: {
	workout: Omit<Workout, "id" | "updatedAt" | "updateCounter" | "userId"> & {
		createdAt: Date
		teamId?: string | null
	}
	tagIds: string[]
	movementIds: string[]
	userId: string
}) {
	const db = getDB()

	// Create the workout first
	const newWorkout = await db
		.insert(workouts)
		.values({
			id: `workout_${createId()}`,
			name: workout.name,
			description: workout.description,
			scheme: workout.scheme,
			scope: workout.scope,
			repsPerRound: workout.repsPerRound,
			roundsToScore: workout.roundsToScore,
			sugarId: workout.sugarId,
			tiebreakScheme: workout.tiebreakScheme,
			secondaryScheme: workout.secondaryScheme,
			teamId: workout.teamId ?? null,
			userId,
			createdAt: workout.createdAt,
			updatedAt: new Date(),
			updateCounter: 0,
		})
		.returning()
		.get()

	// Insert workout-tag relationships
	if (tagIds.length > 0) {
		await db.insert(workoutTags).values(
			tagIds.map((tagId) => ({
				id: `workout_tag_${createId()}`,
				workoutId: newWorkout.id,
				tagId,
			})),
		)
	}

	// Insert workout-movement relationships
	if (movementIds.length > 0) {
		await db.insert(workoutMovements).values(
			movementIds.map((movementId) => ({
				id: `workout_movement_${createId()}`,
				workoutId: newWorkout.id,
				movementId,
			})),
		)
	}

	return newWorkout
}

/**
 * Get a single workout by ID with its tags and movements
 */
export async function getWorkoutById(id: string) {
	const db = getDB()

	const workout = await db
		.select()
		.from(workouts)
		.where(eq(workouts.id, id))
		.get()

	if (!workout) return null

	const workoutTagRows = await db
		.select()
		.from(workoutTags)
		.where(eq(workoutTags.workoutId, id))
	const tagIds = workoutTagRows.map((wt) => wt.tagId)
	const tagObjs = tagIds.length
		? await db.select().from(tags).where(inArray(tags.id, tagIds))
		: []

	const workoutMovementRows = await db
		.select()
		.from(workoutMovements)
		.where(eq(workoutMovements.workoutId, id))
	const movementIds = workoutMovementRows
		.map((wm) => wm.movementId)
		.filter((id): id is string => id !== null)
	const movementObjs = movementIds.length
		? await db
				.select()
				.from(movements)
				.where(inArray(movements.id, movementIds))
		: []

	return {
		...workout,
		tags: tagObjs,
		movements: movementObjs,
	}
}

/**
 * Update a workout with tags and movements
 */
export async function updateWorkout({
	id,
	workout,
	tagIds,
	movementIds,
}: {
	id: string
	workout: Partial<
		Pick<
			Workout,
			| "name"
			| "description"
			| "scheme"
			| "scope"
			| "repsPerRound"
			| "roundsToScore"
		>
	>
	tagIds: string[]
	movementIds: string[]
}) {
	const db = getDB()

	await db
		.update(workouts)
		.set({
			...workout,
			updatedAt: new Date(),
		})
		.where(eq(workouts.id, id))

	await db.delete(workoutTags).where(eq(workoutTags.workoutId, id))
	await db.delete(workoutMovements).where(eq(workoutMovements.workoutId, id))

	if (tagIds.length) {
		await db.insert(workoutTags).values(
			tagIds.map((tagId) => ({
				id: `workout_tag_${createId()}`,
				workoutId: id,
				tagId,
			})),
		)
	}
	if (movementIds.length) {
		await db.insert(workoutMovements).values(
			movementIds.map((movementId) => ({
				id: `workout_movement_${createId()}`,
				workoutId: id,
				movementId,
			})),
		)
	}
}

/**
 * Get workouts for a team that are not in the specified track, sorted by criteria
 */
export async function getTeamWorkoutsNotInTrackSorted(
	currentTrackId: string,
	ownerTeamId: string,
): Promise<Workout[]> {
	const db = getDB()

	// 1. Get all workout IDs currently in the specified track
	const workoutsInCurrentTrack = await db
		.select({ workoutId: trackWorkoutsTable.workoutId })
		.from(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.trackId, currentTrackId))

	const workoutsInCurrentTrackIds = workoutsInCurrentTrack.map(
		(w) => w.workoutId,
	)

	// 2. Get all workout IDs that are part of *any* track (for sorting)
	// We only care about workouts that are in *other* tracks, not the current one.
	const workoutsInOtherTracks = await db
		.selectDistinct({ workoutId: trackWorkoutsTable.workoutId })
		.from(trackWorkoutsTable)
		.where(notInArray(trackWorkoutsTable.trackId, [currentTrackId])) // Exclude current track
	const workoutsInOtherTracksIds = workoutsInOtherTracks.map((w) => w.workoutId)

	// 3. Fetch workouts for the team, excluding those already in the current track
	const teamWorkoutsQuery = db
		.select()
		.from(workouts) // Corrected: use 'workouts' table
		.where(
			and(
				eq(workouts.teamId, ownerTeamId),
				workoutsInCurrentTrackIds.length > 0
					? notInArray(workouts.id, workoutsInCurrentTrackIds)
					: undefined, // If no workouts in current track, this condition is omitted
			),
		)
		.orderBy(
			desc(workouts.createdAt), // Default sort by creation date
		)

	const availableTeamWorkouts = await teamWorkoutsQuery

	// 4. Sort the results: workouts present in other tracks go to the bottom
	const sortedWorkouts = availableTeamWorkouts.sort((a, b) => {
		// Check if workout 'a' is in another track (and not the current one)
		const aInOtherTrack = workoutsInOtherTracksIds.includes(a.id)
		// Check if workout 'b' is in another track (and not the current one)
		const bInOtherTrack = workoutsInOtherTracksIds.includes(b.id)

		if (aInOtherTrack && !bInOtherTrack) {
			return 1 // a comes after b
		}
		if (!aInOtherTrack && bInOtherTrack) {
			return -1 // a comes before b
		}
		// If both are in other tracks or neither are, maintain original sort (e.g., by createdAt)
		return 0
	})

	return sortedWorkouts
}
