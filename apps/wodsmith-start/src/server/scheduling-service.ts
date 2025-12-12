/**
 * Scheduling Service (Stub)
 * TODO: Implement full functionality
 */

import type {
	ScheduledWorkoutInstance,
	Workout,
	Movement,
	WorkoutMovement,
} from "~/db/schema"

export interface ScheduleWorkoutInput {
	teamId: string
	trackWorkoutId: string
	scheduledDate: Date
	notes?: string | null
}

export interface ScheduleStandaloneWorkoutInput {
	teamId: string
	workoutId: string
	scheduledDate: Date
	notes?: string | null
}

export interface UpdateScheduleInput {
	instanceId: string
	scheduledDate?: Date
	notes?: string | null
}

export type WorkoutWithMovements = Workout & {
	workoutMovements: (WorkoutMovement & {
		movement: Movement
	})[]
}

export type ScheduledWorkoutInstanceWithDetails = ScheduledWorkoutInstance & {
	workout: WorkoutWithMovements | null
	trackWorkout?: {
		id: string
		trackId: string
		workoutId: string
		trackOrder: number
		notes: string | null
		workout: WorkoutWithMovements
	} | null
}

export async function scheduleWorkoutForTeam(
	_input: ScheduleWorkoutInput,
): Promise<ScheduledWorkoutInstance> {
	throw new Error("Not implemented")
}

export async function scheduleStandaloneWorkoutForTeam(
	_input: ScheduleStandaloneWorkoutInput,
): Promise<ScheduledWorkoutInstance> {
	throw new Error("Not implemented")
}

export async function getScheduledWorkoutsForTeam(
	_teamId: string,
	_options?: { startDate?: Date; endDate?: Date },
): Promise<ScheduledWorkoutInstanceWithDetails[]> {
	throw new Error("Not implemented")
}

export async function getScheduledWorkoutInstanceById(
	_instanceId: string,
): Promise<ScheduledWorkoutInstanceWithDetails | null> {
	throw new Error("Not implemented")
}

export async function updateScheduledWorkoutInstance(
	_input: UpdateScheduleInput,
): Promise<ScheduledWorkoutInstance> {
	throw new Error("Not implemented")
}

export async function deleteScheduledWorkoutInstance(
	_instanceId: string,
): Promise<void> {
	throw new Error("Not implemented")
}
