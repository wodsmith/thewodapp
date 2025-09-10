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
import { getTeamSpecificWorkout } from "./workouts"

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

	// First, get the basic scheduled workout data with track workouts
	const rows = await db
		.select({
			instance: scheduledWorkoutInstancesTable,
			trackWorkout: trackWorkoutsTable,
		})
		.from(scheduledWorkoutInstancesTable)
		.leftJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.id, scheduledWorkoutInstancesTable.trackWorkoutId),
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

	// Resolve team-specific workouts for each track workout
	const resolvedWorkouts = new Map<string, Workout>()
	for (const row of rows) {
		if (row.trackWorkout?.workoutId) {
			try {
				const teamSpecificWorkout = await getTeamSpecificWorkout({
					originalWorkoutId: row.trackWorkout.workoutId,
					teamId,
				})
				resolvedWorkouts.set(row.trackWorkout.workoutId, teamSpecificWorkout)
			} catch (error) {
				console.error(
					`Failed to resolve team-specific workout for ${row.trackWorkout.workoutId}:`,
					error,
				)
				// Fall back to querying the original workout directly
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
		const resolvedWorkout = r.trackWorkout?.workoutId
			? resolvedWorkouts.get(r.trackWorkout.workoutId)
			: undefined

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
		})
		.from(scheduledWorkoutInstancesTable)
		.leftJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.id, scheduledWorkoutInstancesTable.trackWorkoutId),
		)
		.where(eq(scheduledWorkoutInstancesTable.id, instanceId))

	if (rows.length === 0) return null
	const row = rows[0]

	// Resolve team-specific workout if track workout exists
	let resolvedWorkout: Workout | undefined
	if (row.trackWorkout?.workoutId && row.instance.teamId) {
		try {
			resolvedWorkout = await getTeamSpecificWorkout({
				originalWorkoutId: row.trackWorkout.workoutId,
				teamId: row.instance.teamId,
			})
		} catch (error) {
			console.error(
				`Failed to resolve team-specific workout for ${row.trackWorkout.workoutId}:`,
				error,
			)
			// Fall back to original workout
			resolvedWorkout = await db
				.select()
				.from(workouts)
				.where(eq(workouts.id, row.trackWorkout.workoutId))
				.get()
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
