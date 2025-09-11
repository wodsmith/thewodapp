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
	workoutId?: string // Explicit workout selection (original or specific remix)
	scheduledDate: Date
	teamSpecificNotes?: string | null
	scalingGuidanceForDay?: string | null
	classTimes?: string | null
}

export interface ScheduleStandaloneWorkoutInput {
	teamId: string
	workoutId: string // Required for standalone workouts
	scheduledDate: Date
	teamSpecificNotes?: string | null
	scalingGuidanceForDay?: string | null
	classTimes?: string | null
}

export interface UpdateScheduleInput {
	workoutId?: string | null
	teamSpecificNotes?: string | null
	scalingGuidanceForDay?: string | null
	classTimes?: string | null
}

export type WorkoutWithMovements = Workout & {
	movements?: Array<{ id: string; name: string; type: string }>
}

export type ScheduledWorkoutInstanceWithDetails = ScheduledWorkoutInstance & {
	trackWorkout?: (TrackWorkout & { workout?: WorkoutWithMovements }) | null
	workout?: WorkoutWithMovements // Direct workout for standalone scheduled instances
}

/* -------------------------------------------------------------------------- */
/*                                Operations                                   */
/* -------------------------------------------------------------------------- */

export async function scheduleWorkoutForTeam(
	data: ScheduleWorkoutInput,
): Promise<ScheduledWorkoutInstance> {
	const db = getDd()

	// If no explicit workoutId provided, use the original workout from the track
	let workoutId = data.workoutId
	if (!workoutId) {
		const trackWorkout = await db
			.select()
			.from(trackWorkoutsTable)
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
			.get()

		if (trackWorkout) {
			workoutId = trackWorkout.workoutId
		}
	}

	const [instance] = await db
		.insert(scheduledWorkoutInstancesTable)
		.values({
			id: `swi_${createId()}`,
			teamId: data.teamId,
			trackWorkoutId: data.trackWorkoutId,
			workoutId, // Now explicitly storing the workout selection
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

export async function scheduleStandaloneWorkoutForTeam(
	data: ScheduleStandaloneWorkoutInput,
): Promise<ScheduledWorkoutInstance> {
	const db = getDd()

	const [instance] = await db
		.insert(scheduledWorkoutInstancesTable)
		.values({
			id: `swi_${createId()}`,
			teamId: data.teamId,
			trackWorkoutId: null, // No track workout for standalone
			workoutId: data.workoutId, // Direct workout reference
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

	// First, get the basic scheduled workout data with track workouts and explicit workouts
	const rows = await db
		.select({
			instance: scheduledWorkoutInstancesTable,
			trackWorkout: trackWorkoutsTable,
			workout: workouts, // Direct join to get the explicit workout
		})
		.from(scheduledWorkoutInstancesTable)
		.leftJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.id, scheduledWorkoutInstancesTable.trackWorkoutId),
		)
		.leftJoin(
			workouts,
			eq(workouts.id, scheduledWorkoutInstancesTable.workoutId),
		)
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

	// For backward compatibility: if workoutId is null, fall back to track workout's original workout
	const resolvedWorkouts = new Map<string, Workout>()
	for (const row of rows) {
		if (row.instance.workoutId && row.workout) {
			// Use the explicitly stored workout
			resolvedWorkouts.set(row.instance.workoutId, row.workout)
		} else if (row.trackWorkout?.workoutId) {
			// Backward compatibility: fetch the original workout from track
			const fallbackWorkout = await db
				.select()
				.from(workouts)
				.where(eq(workouts.id, row.trackWorkout.workoutId))
				.get()
			if (fallbackWorkout) {
				resolvedWorkouts.set(row.trackWorkout.workoutId, fallbackWorkout)
			}
		}
	}

	// Extract resolved workout IDs to fetch movements
	const resolvedWorkoutIds = Array.from(resolvedWorkouts.values()).map(
		(w) => w.id,
	)

	// Fetch movements for all resolved workouts
	const movementsByWorkoutId = new Map<
		string,
		Array<{ id: string; name: string; type: string }>
	>()
	if (resolvedWorkoutIds.length > 0) {
		const workoutMovementsData = await db
			.select({
				workoutId: workoutMovements.workoutId,
				movementId: movements.id,
				movementName: movements.name,
				movementType: movements.type,
			})
			.from(workoutMovements)
			.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
			.where(inArray(workoutMovements.workoutId, resolvedWorkoutIds))

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

	return rows.map((r) => {
		// Get the resolved workout (either from explicit workoutId or fallback)
		const resolvedWorkout = r.instance.workoutId
			? resolvedWorkouts.get(r.instance.workoutId)
			: r.trackWorkout?.workoutId
				? resolvedWorkouts.get(r.trackWorkout.workoutId)
				: undefined

		// For standalone workouts (no trackWorkout), return the instance with workout directly
		// We'll need to handle this case differently in the UI
		if (!r.trackWorkout && r.instance.workoutId && resolvedWorkout) {
			return {
				...r.instance,
				trackWorkout: null,
				workout: {
					...resolvedWorkout,
					movements: movementsByWorkoutId.get(resolvedWorkout.id) || [],
				},
			}
		}

		return {
			...r.instance,
			trackWorkout: r.trackWorkout
				? {
						...r.trackWorkout,
						workout: resolvedWorkout
							? {
									...resolvedWorkout,
									movements: movementsByWorkoutId.get(resolvedWorkout.id) || [],
								}
							: undefined,
					}
				: null,
		}
	})
}

export async function getScheduledWorkoutInstanceById(
	instanceId: string,
): Promise<ScheduledWorkoutInstanceWithDetails | null> {
	const db = getDd()
	const rows = await db
		.select({
			instance: scheduledWorkoutInstancesTable,
			trackWorkout: trackWorkoutsTable,
			workout: workouts, // Direct join to get the explicit workout
		})
		.from(scheduledWorkoutInstancesTable)
		.leftJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.id, scheduledWorkoutInstancesTable.trackWorkoutId),
		)
		.leftJoin(
			workouts,
			eq(workouts.id, scheduledWorkoutInstancesTable.workoutId),
		)
		.where(eq(scheduledWorkoutInstancesTable.id, instanceId))

	if (rows.length === 0) return null
	const row = rows[0]

	// Use explicit workout if available, otherwise fall back to track workout's original
	let resolvedWorkout: Workout | undefined
	if (row.instance.workoutId && row.workout) {
		// Use the explicitly stored workout
		resolvedWorkout = row.workout
	} else if (row.trackWorkout?.workoutId) {
		// Backward compatibility: fetch the original workout from track
		resolvedWorkout = await db
			.select()
			.from(workouts)
			.where(eq(workouts.id, row.trackWorkout.workoutId))
			.get()
	}

	// For standalone workouts (no trackWorkout), return the instance with workout directly
	// We'll need to handle this case differently in the UI
	if (!row.trackWorkout && row.instance.workoutId && resolvedWorkout) {
		// Fetch movements for the standalone workout
		const workoutMovementsList = await db
			.select({
				id: movements.id,
				name: movements.name,
				type: movements.type,
			})
			.from(workoutMovements)
			.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
			.where(eq(workoutMovements.workoutId, resolvedWorkout.id))

		return {
			...row.instance,
			trackWorkout: null,
			workout: {
				...resolvedWorkout,
				movements: workoutMovementsList,
			},
		}
	}

	return {
		...row.instance,
		trackWorkout: row.trackWorkout
			? {
					...row.trackWorkout,
					workout: resolvedWorkout,
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
