import "server-only"

import { getDB } from "@/db"
import {
	type ProgrammingTrack,
	type Team,
	type TeamProgrammingTrack,
	type TrackWorkout,
	programmingTracksTable,
	teamProgrammingTracksTable,
	teamTable,
	trackWorkoutsTable,
	workouts,
} from "@/db/schema"
import { createId } from "@paralleldrive/cuid2"
import { and, eq } from "drizzle-orm"

/* -------------------------------------------------------------------------- */
/*                                Data Types                                  */
/* -------------------------------------------------------------------------- */

export interface CreateTrackInput {
	name: string
	description?: string | null
	type: ProgrammingTrack["type"]
	ownerTeamId?: string | null
	isPublic?: boolean
}

export interface AddWorkoutToTrackInput {
	trackId: string
	workoutId: string
	dayNumber: number
	weekNumber?: number | null
	notes?: string | null
}

/* -------------------------------------------------------------------------- */
/*                              Core Functions                                 */
/* -------------------------------------------------------------------------- */

export async function createProgrammingTrack(
	data: CreateTrackInput,
): Promise<ProgrammingTrack> {
	const db = getDB()

	const result = await db
		.insert(programmingTracksTable)
		.values({
			id: `ptrk_${createId()}`,
			name: data.name,
			description: data.description,
			type: data.type,
			ownerTeamId: data.ownerTeamId,
			isPublic: data.isPublic ? 1 : 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning()

	const [track] = Array.isArray(result) ? result : []
	return track
}

export async function getProgrammingTrackById(
	trackId: string,
): Promise<ProgrammingTrack | null> {
	const db = getDB()
	const [track] = await db
		.select()
		.from(programmingTracksTable)
		.where(eq(programmingTracksTable.id, trackId))
	return track ?? null
}

export async function addWorkoutToTrack(
	data: AddWorkoutToTrackInput,
): Promise<TrackWorkout> {
	const db = getDB()

	const [trackWorkout] = await db
		.insert(trackWorkoutsTable)
		.values({
			id: `trwk_${createId()}`,
			trackId: data.trackId,
			workoutId: data.workoutId,
			dayNumber: data.dayNumber,
			weekNumber: data.weekNumber,
			notes: data.notes,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning()

	return trackWorkout
}

export async function getWorkoutsForTrack(
	trackId: string,
): Promise<TrackWorkout[]> {
	const db = getDB()
	return db
		.select()
		.from(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.trackId, trackId))
}

export async function assignTrackToTeam(
	teamId: string,
	trackId: string,
	isActive = true,
): Promise<TeamProgrammingTrack> {
	const db = getDB()

	// Upsert behaviour: if record exists update isActive else insert
	const existing = await db
		.select()
		.from(teamProgrammingTracksTable)
		.where(
			and(
				eq(teamProgrammingTracksTable.teamId, teamId),
				eq(teamProgrammingTracksTable.trackId, trackId),
			),
		)
	if (existing.length > 0) {
		const [updated] = await db
			.update(teamProgrammingTracksTable)
			.set({ isActive: isActive ? 1 : 0, updatedAt: new Date() })
			.where(
				and(
					eq(teamProgrammingTracksTable.teamId, teamId),
					eq(teamProgrammingTracksTable.trackId, trackId),
				),
			)
			.returning()
		return updated
	}

	const [created] = await db
		.insert(teamProgrammingTracksTable)
		.values({
			teamId,
			trackId,
			isActive: isActive ? 1 : 0,
			addedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning()
	return created
}

export async function getTeamTracks(
	teamId: string,
	activeOnly = true,
): Promise<ProgrammingTrack[]> {
	const db = getDB()

	const joins = db
		.select({ track: programmingTracksTable })
		.from(programmingTracksTable)
		.innerJoin(
			teamProgrammingTracksTable,
			and(
				eq(teamProgrammingTracksTable.trackId, programmingTracksTable.id),
				eq(teamProgrammingTracksTable.teamId, teamId),
				activeOnly ? eq(teamProgrammingTracksTable.isActive, 1) : undefined, // ignore filter if not activeOnly
			),
		)

	const records = await joins
	return records.map((r) => r.track)
}

export async function updateTeamDefaultTrack(
	teamId: string,
	trackId: string | null,
): Promise<Team> {
	const db = getDB()
	const result = await db
		.update(teamTable)
		.set({ defaultTrackId: trackId, updatedAt: new Date() })
		.where(eq(teamTable.id, teamId))
		.returning()
	const [team] = Array.isArray(result) ? result : []
	return team
}
