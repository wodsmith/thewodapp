import "server-only"
import { createId } from "@paralleldrive/cuid2"
import { and, eq, gte, inArray, isNotNull, lt } from "drizzle-orm"
import { ZSAError } from "zsa"
import { getDB } from "@/db"
import type { Workout } from "@/db/schema"
import {
	movements,
	results,
	scheduledWorkoutInstancesTable,
	tags,
	trackWorkoutsTable,
	workoutMovements,
	workouts,
	workoutTags,
} from "@/db/schema"
import { requireVerifiedEmail } from "@/utils/auth"

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
 * Get all workouts for the current team
 */
export async function getUserWorkouts({ teamId }: { teamId: string }) {
	const db = getDB()
	const session = await requireVerifiedEmail()

	if (!session?.user?.id) {
		throw new ZSAError("NOT_AUTHORIZED", "User must be authenticated")
	}

	// Base workouts and ids
	const allWorkouts = await db
		.select()
		.from(workouts)
		.where(eq(workouts.teamId, teamId))

	const workoutIds = allWorkouts.map((w) => w.id)

	// Fetch related data in parallel
	const [tagsByWorkoutId, movementsByWorkoutId, resultsByWorkoutId] =
		await Promise.all([
			fetchTagsByWorkoutId(db, workoutIds),
			fetchMovementsByWorkoutId(db, workoutIds),
			fetchTodaysResultsByWorkoutId(db, session.user.id, workoutIds),
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
	teamId,
}: {
	workout: Omit<Workout, "id" | "updatedAt" | "updateCounter" | "teamId"> & {
		createdAt: Date
	}
	tagIds: string[]
	movementIds: string[]
	teamId: string
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
			teamId,
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
 * Get user workouts with track scheduling information
 */
export async function getUserWorkoutsWithTrackScheduling({
	trackId,
	teamId,
}: {
	trackId: string
	teamId: string
}) {
	const db = getDB()

	// Get all team workouts
	const userWorkouts = await getUserWorkouts({ teamId })

	// Get scheduling information for workouts in this track
	const scheduledWorkouts = await db
		.select({
			workoutId: trackWorkoutsTable.workoutId,
			scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
		})
		.from(trackWorkoutsTable)
		.leftJoin(
			scheduledWorkoutInstancesTable,
			eq(scheduledWorkoutInstancesTable.trackWorkoutId, trackWorkoutsTable.id),
		)
		.where(
			and(
				eq(trackWorkoutsTable.trackId, trackId),
				eq(scheduledWorkoutInstancesTable.teamId, teamId),
			),
		)

	// Create a map of workout ID to last scheduled date
	const schedulingMap = new Map<string, Date>()
	for (const row of scheduledWorkouts) {
		if (row.workoutId && row.scheduledDate) {
			const existingDate = schedulingMap.get(row.workoutId)
			if (!existingDate || row.scheduledDate > existingDate) {
				schedulingMap.set(row.workoutId, row.scheduledDate)
			}
		}
	}

	// Combine user workouts with scheduling information
	return userWorkouts.map((workout) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { resultsToday, ...workoutWithoutResults } = workout
		return {
			...workoutWithoutResults,
			lastScheduledAt: schedulingMap.get(workout.id) ?? null,
		}
	})
}
