/**
 * Programming Server Module (Stub)
 * TODO: Implement full functionality
 */

import type { ProgrammingTrack, TrackWorkout, Workout } from "~/db/schema"

interface PublicProgrammingTrack extends ProgrammingTrack {
	competitionId: string | null
	ownerTeam: {
		id: string
		name: string
	} | null
}

export interface PaginatedTrackWorkoutsResult {
	workouts: (TrackWorkout & { workout: Workout })[]
	total: number
	hasMore: boolean
}

export interface ExternalWorkoutDetectionResult {
	isExternal: boolean
	trackId?: string
	trackName?: string
}

export async function getPublicProgrammingTracks(): Promise<
	PublicProgrammingTrack[]
> {
	throw new Error("Not implemented")
}

export async function getTeamProgrammingTracks(
	_teamId: string,
): Promise<(PublicProgrammingTrack & { subscribedAt: Date })[]> {
	throw new Error("Not implemented")
}

export async function getProgrammingTrackById(
	_trackId: string,
): Promise<PublicProgrammingTrack | null> {
	throw new Error("Not implemented")
}

export async function getPaginatedTrackWorkouts(
	_trackId: string,
	_options?: { page?: number; pageSize?: number },
): Promise<PaginatedTrackWorkoutsResult> {
	throw new Error("Not implemented")
}

export async function detectExternalProgrammingTrackWorkouts(
	_workoutId: string,
	_teamId: string,
): Promise<ExternalWorkoutDetectionResult> {
	throw new Error("Not implemented")
}

export async function isTeamSubscribedToProgrammingTrack(
	_teamId: string,
	_trackId: string,
): Promise<boolean> {
	throw new Error("Not implemented")
}

export async function isWorkoutInTeamSubscribedTrack(
	_workoutId: string,
	_teamId: string,
): Promise<boolean> {
	throw new Error("Not implemented")
}

export async function getUserProgrammingTracks(
	_userTeamIds: string[],
): Promise<ProgrammingTrack[]> {
	throw new Error("Not implemented")
}
