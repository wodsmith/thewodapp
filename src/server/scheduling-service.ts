import "server-only"

import { createId } from "@paralleldrive/cuid2"
import { and, between, eq, inArray } from "drizzle-orm"
import { getDd } from "@/db"
import {
	movements,
	type ScheduledWorkoutInstance,
	scheduledWorkoutInstancesTable,
	type TrackWorkout,
	trackWorkoutsTable,
	type Workout,
	workoutMovements,
	workouts,
} from "@/db/schema"

/* -------------------------------------------------------------------------- */
/*                             Data Type Helpers                               */
/* -------------------------------------------------------------------------- */

export interface ScheduleWorkoutInput {
	teamId: string
	trackWorkoutId: string
	scheduledDate: Date
	teamSpecificNotes?: string | null
	scalingGuidanceForDay?: string | null
	classTimes?: string | null
}

export interface UpdateScheduleInput {
	teamSpecificNotes?: string | null
	scalingGuidanceForDay?: string | null
	classTimes?: string | null
}

export type WorkoutWithMovements = Workout & {
	movements?: Array<{ id: string; name: string; type: string }>
}

export type ScheduledWorkoutInstanceWithDetails = ScheduledWorkoutInstance & {
	trackWorkout?: (TrackWorkout & { workout?: WorkoutWithMovements }) | null
}

/* -------------------------------------------------------------------------- */
/*                                Operations                                   */
/* -------------------------------------------------------------------------- */

export async function scheduleWorkoutForTeam(
	data: ScheduleWorkoutInput,
): Promise<ScheduledWorkoutInstance> {
	const db = getDd()

	const [instance] = await db
		.insert(scheduledWorkoutInstancesTable)
		.values({
			id: `swi_${createId()}`,
			teamId: data.teamId,
			trackWorkoutId: data.trackWorkoutId,
			scheduledDate: data.scheduledDate,
			teamSpecificNotes: data.teamSpecificNotes,
			scalingGuidanceForDay: data.scalingGuidanceForDay,
			classTimes: data.classTimes,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning()

	return instance
}

export async function getScheduledWorkoutsForTeam(
	teamId: string,
	dateRange: { start: Date; end: Date },
): Promise<ScheduledWorkoutInstanceWithDetails[]> {
	const db = getDd()

	const rows = await db
		.select({
			instance: scheduledWorkoutInstancesTable,
			trackWorkout: trackWorkoutsTable,
			workout: workouts,
		})
		.from(scheduledWorkoutInstancesTable)
		.leftJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.id, scheduledWorkoutInstancesTable.trackWorkoutId),
		)
		.leftJoin(workouts, eq(workouts.id, trackWorkoutsTable.workoutId))
		.where(
			and(
				eq(scheduledWorkoutInstancesTable.teamId, teamId),
				between(
					scheduledWorkoutInstancesTable.scheduledDate,
					dateRange.start,
					dateRange.end,
				),
			),
		)

	// Extract workout IDs to fetch movements
	const workoutIds = rows
		.map((r) => r.workout?.id)
		.filter((id): id is string => id !== null && id !== undefined)

	// Fetch movements for all workouts
	const movementsByWorkoutId = new Map<
		string,
		Array<{ id: string; name: string; type: string }>
	>()
	if (workoutIds.length > 0) {
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
	}

	return rows.map((r) => ({
		...r.instance,
		trackWorkout: r.trackWorkout
			? {
					...r.trackWorkout,
					workout: r.workout
						? {
								...r.workout,
								movements: movementsByWorkoutId.get(r.workout.id) || [],
							}
						: undefined,
				}
			: null,
	}))
}

export async function getScheduledWorkoutInstanceById(
	instanceId: string,
): Promise<ScheduledWorkoutInstanceWithDetails | null> {
	const db = getDd()
	const rows = await db
		.select({
			instance: scheduledWorkoutInstancesTable,
			trackWorkout: trackWorkoutsTable,
			workout: workouts,
		})
		.from(scheduledWorkoutInstancesTable)
		.leftJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.id, scheduledWorkoutInstancesTable.trackWorkoutId),
		)
		.leftJoin(workouts, eq(workouts.id, trackWorkoutsTable.workoutId))
		.where(eq(scheduledWorkoutInstancesTable.id, instanceId))

	if (rows.length === 0) return null
	const row = rows[0]
	return {
		...row.instance,
		trackWorkout: row.trackWorkout
			? {
					...row.trackWorkout,
					workout: row.workout ?? undefined,
				}
			: null,
	}
}

export async function updateScheduledWorkoutInstance(
	instanceId: string,
	data: UpdateScheduleInput,
): Promise<ScheduledWorkoutInstance> {
	const db = getDd()
	const [updated] = await db
		.update(scheduledWorkoutInstancesTable)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(scheduledWorkoutInstancesTable.id, instanceId))
		.returning()
	return updated
}

export async function deleteScheduledWorkoutInstance(
	instanceId: string,
): Promise<void> {
	const db = getDd()
	await db
		.delete(scheduledWorkoutInstancesTable)
		.where(eq(scheduledWorkoutInstancesTable.id, instanceId))
}
