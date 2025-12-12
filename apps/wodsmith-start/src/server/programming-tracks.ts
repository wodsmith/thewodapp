/**
 * Programming Tracks Server Module (Stub)
 * TODO: Implement full functionality
 */

import type { ProgrammingTrack, TrackWorkout, Workout } from "~/db/schema"

export interface CreateTrackInput {
	name: string
	description?: string | null
	type: ProgrammingTrack["type"]
	ownerTeamId?: string | null
	isPublic?: boolean
	scalingGroupId?: string | null
}

export interface AddWorkoutToTrackInput {
	trackId: string
	workoutId: string
	trackOrder?: number
	notes?: string | null
	pointsMultiplier?: number
}

export async function createProgrammingTrack(
	_data: CreateTrackInput,
): Promise<ProgrammingTrack> {
	throw new Error("Not implemented")
}

export async function updateProgrammingTrack(
	_trackId: string,
	_data: Partial<CreateTrackInput>,
): Promise<ProgrammingTrack> {
	throw new Error("Not implemented")
}

export async function getProgrammingTrackById(
	_trackId: string,
): Promise<ProgrammingTrack | null> {
	throw new Error("Not implemented")
}

export async function isTrackOwner(
	_trackId: string,
	_teamId: string,
): Promise<boolean> {
	throw new Error("Not implemented")
}

export async function hasTrackAccess(
	_trackId: string,
	_teamId: string,
): Promise<boolean> {
	throw new Error("Not implemented")
}

export async function getNextTrackOrderForTrack(
	_trackId: string,
): Promise<number> {
	throw new Error("Not implemented")
}

export async function addWorkoutToTrack(
	_data: AddWorkoutToTrackInput,
): Promise<TrackWorkout> {
	throw new Error("Not implemented")
}

export async function getWorkoutsForTrack(
	_trackId: string,
): Promise<(TrackWorkout & { workout: Workout })[]> {
	throw new Error("Not implemented")
}

export async function assignTrackToTeam(
	_trackId: string,
	_teamId: string,
): Promise<void> {
	throw new Error("Not implemented")
}

export async function getTracksOwnedByTeam(
	_teamId: string,
): Promise<ProgrammingTrack[]> {
	throw new Error("Not implemented")
}

export async function getTeamTracks(
	_teamId: string,
): Promise<ProgrammingTrack[]> {
	throw new Error("Not implemented")
}

export async function getWorkoutsNotInTracks(
	_teamId: string,
): Promise<Workout[]> {
	throw new Error("Not implemented")
}

export async function updateTeamDefaultTrack(
	_teamId: string,
	_trackId: string | null,
): Promise<void> {
	throw new Error("Not implemented")
}

export async function scheduleStandaloneWorkout(_params: {
	workoutId: string
	teamId: string
	scheduledDate: Date
	notes?: string | null
}): Promise<void> {
	throw new Error("Not implemented")
}

export async function deleteProgrammingTrack(_trackId: string): Promise<void> {
	throw new Error("Not implemented")
}

export async function removeWorkoutFromTrack(
	_trackId: string,
	_workoutId: string,
): Promise<void> {
	throw new Error("Not implemented")
}

export async function updateTrackWorkout(_params: {
	trackId: string
	workoutId: string
	notes?: string | null
	pointsMultiplier?: number
}): Promise<TrackWorkout> {
	throw new Error("Not implemented")
}

export async function reorderTrackWorkouts(
	_trackId: string,
	_workoutIds: string[],
): Promise<void> {
	throw new Error("Not implemented")
}
