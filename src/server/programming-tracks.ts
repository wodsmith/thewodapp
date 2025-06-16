import "server-only"

import { getDB } from "@/db"
import {
	PROGRAMMING_TRACK_TYPE,
	type ProgrammingTrack,
	type Team,
	type TeamProgrammingTrack,
	type TrackWorkout,
	type Workout,
	programmingTracksTable,
	teamProgrammingTracksTable,
	teamTable,
	trackWorkoutsTable,
	workouts,
} from "@/db/schema"
import { createId } from "@paralleldrive/cuid2"
import { and, eq, notExists, or } from "drizzle-orm"

/* -------------------------------------------------------------------------- */
/*                                Data Types                                  */
/* -------------------------------------------------------------------------- */

export interface CreateTrackInput {
	name: string
	description?: string | null
	type:
		| keyof typeof PROGRAMMING_TRACK_TYPE
		| (typeof PROGRAMMING_TRACK_TYPE)[keyof typeof PROGRAMMING_TRACK_TYPE]
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

	const [track] = await db
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
): Promise<(TrackWorkout & { workout?: Workout })[]> {
	const db = getDB()

	const trackWorkouts = await db
		.select({
			trackWorkout: trackWorkoutsTable,
			workout: workouts,
		})
		.from(trackWorkoutsTable)
		.leftJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
		.where(eq(trackWorkoutsTable.trackId, trackId))

	return trackWorkouts.map((row) => ({
		...row.trackWorkout,
		workout: row.workout ?? undefined,
	}))
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

/**
 * Get workouts that are not in any programming track
 * These are "standalone" workouts that can be scheduled independently
 */
export async function getWorkoutsNotInTracks(
	userId: string,
): Promise<Workout[]> {
	const db = getDB()

	// Get workouts that are either public or belong to the user
	// AND are not referenced in any track_workout record
	const availableWorkouts = await db
		.select()
		.from(workouts)
		.where(
			and(
				or(eq(workouts.scope, "public"), eq(workouts.userId, userId)),
				notExists(
					db
						.select()
						.from(trackWorkoutsTable)
						.where(eq(trackWorkoutsTable.workoutId, workouts.id)),
				),
			),
		)

	return availableWorkouts
}

/**
 * Schedule a standalone workout by creating a temporary track and track workout
 * This allows us to use the existing scheduling infrastructure
 */
export async function scheduleStandaloneWorkout({
	teamId,
	workoutId,
	scheduledDate,
	teamSpecificNotes,
	scalingGuidanceForDay,
	classTimes,
}: {
	teamId: string
	workoutId: string
	scheduledDate: Date
	teamSpecificNotes?: string
	scalingGuidanceForDay?: string
	classTimes?: string
}): Promise<TrackWorkout> {
	const db = getDB()

	// Create a temporary track for this standalone workout
	const tempTrack = await createProgrammingTrack({
		name: `Standalone Workout Track - ${scheduledDate.toISOString().split("T")[0]}`,
		description: "Temporary track for standalone workout scheduling",
		type: PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED,
		ownerTeamId: teamId,
		isPublic: false,
	})

	// Add the workout to the temporary track
	const trackWorkout = await addWorkoutToTrack({
		trackId: tempTrack.id,
		workoutId: workoutId,
		dayNumber: 1,
		weekNumber: null,
		notes: "Standalone workout",
	})

	return trackWorkout
}
