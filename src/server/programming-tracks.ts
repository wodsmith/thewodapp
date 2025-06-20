import "server-only"

import { getDB } from "@/db"
import {
	type ProgrammingTrack,
	type Team,
	type TeamProgrammingTrack,
	type TrackWorkout,
	type Workout,
	programmingTracksTable,
	scheduledWorkoutInstancesTable,
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

/**
 * Check if a team has access to a programming track
 * A team has access if:
 * 1. The track is owned by the team (ownerTeamId matches)
 * 2. The track is assigned to the team via team_programming_tracks
 * 3. The track is public
 */
export async function hasTrackAccess(
	teamId: string,
	trackId: string,
): Promise<boolean> {
	const db = getDB()

	// Get the track details
	const track = await getProgrammingTrackById(trackId)
	if (!track) {
		return false
	}

	// Check if track is public
	if (track.isPublic) {
		return true
	}

	// Check if team owns the track
	if (track.ownerTeamId === teamId) {
		return true
	}

	// Check if track is assigned to the team
	const teamTrackAssignment = await db
		.select()
		.from(teamProgrammingTracksTable)
		.where(
			and(
				eq(teamProgrammingTracksTable.teamId, teamId),
				eq(teamProgrammingTracksTable.trackId, trackId),
				eq(teamProgrammingTracksTable.isActive, 1),
			),
		)
		.limit(1)

	return teamTrackAssignment.length > 0
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
	teamId?: string,
): Promise<
	(TrackWorkout & { isScheduled?: boolean; lastScheduledAt?: Date | null })[]
> {
	const db = getDB()
	const workouts = await db
		.select()
		.from(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.trackId, trackId))

	if (!teamId) {
		return workouts.map((w) => ({
			...w,
			isScheduled: false,
			lastScheduledAt: null,
		}))
	}

	// Get scheduled trackWorkoutIds for this team
	const scheduledRows = await db
		.select({
			trackWorkoutId: scheduledWorkoutInstancesTable.trackWorkoutId,
			scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
		})
		.from(scheduledWorkoutInstancesTable)
		.where(eq(scheduledWorkoutInstancesTable.teamId, teamId))

	const scheduledDatesMap = new Map<string, Date>()
	if (scheduledRows) {
		for (const row of scheduledRows) {
			if (row.trackWorkoutId && row.scheduledDate) {
				const existingDate = scheduledDatesMap.get(row.trackWorkoutId)
				if (!existingDate || row.scheduledDate > existingDate) {
					scheduledDatesMap.set(row.trackWorkoutId, row.scheduledDate)
				}
			}
		}
	}

	const workoutsWithScheduledInfo = workouts.map((w) => ({
		...w,
		isScheduled: scheduledDatesMap.has(w.id),
		lastScheduledAt: scheduledDatesMap.get(w.id) ?? null,
	}))

	// Sort: unscheduled first, then scheduled
	workoutsWithScheduledInfo.sort((a, b) => {
		if (a.isScheduled && !b.isScheduled) return 1
		if (!a.isScheduled && b.isScheduled) return -1
		return 0
	})

	return workoutsWithScheduledInfo
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
	teamId?: string,
): Promise<
	(Workout & { isScheduled?: boolean; lastScheduledAt?: Date | null })[]
> {
	const db = getDB()
	const allWorkouts = await db
		.select()
		.from(workouts)
		.where(
			and(
				or(eq(workouts.scope, "public"), eq(workouts.userId, userId)),
				notExists(
					db
						.select()
						.from(trackWorkoutsTable)
						.innerJoin(
							programmingTracksTable,
							eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
						)
						.where(
							and(
								eq(trackWorkoutsTable.workoutId, workouts.id),
								or(
									eq(programmingTracksTable.type, "team_owned"),
									eq(programmingTracksTable.type, "public_template"),
								),
							),
						),
				),
			),
		)

	if (!teamId) {
		return allWorkouts.map((w) => ({
			...w,
			isScheduled: false,
			lastScheduledAt: null,
		}))
	}

	// Get scheduled workoutIds for this team
	const scheduledRows = await db
		.select({
			workoutId: trackWorkoutsTable.workoutId,
			scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
		})
		.from(scheduledWorkoutInstancesTable)
		.leftJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.id, scheduledWorkoutInstancesTable.trackWorkoutId),
		)
		.where(eq(scheduledWorkoutInstancesTable.teamId, teamId))

	const scheduledDatesMap = new Map<string, Date>()
	if (scheduledRows) {
		for (const row of scheduledRows) {
			if (row.workoutId && row.scheduledDate) {
				const existingDate = scheduledDatesMap.get(row.workoutId)
				if (!existingDate || row.scheduledDate > existingDate) {
					scheduledDatesMap.set(row.workoutId, row.scheduledDate)
				}
			}
		}
	}

	const workoutsWithScheduledInfo = allWorkouts.map((w) => ({
		...w,
		isScheduled: scheduledDatesMap.has(w.id),
		lastScheduledAt: scheduledDatesMap.get(w.id) ?? null,
	}))

	// Sort: unscheduled first, then scheduled
	workoutsWithScheduledInfo.sort((a, b) => {
		if (a.isScheduled && !b.isScheduled) return 1
		if (!a.isScheduled && b.isScheduled) return -1
		return 0
	})

	return workoutsWithScheduledInfo
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

/**
 * Schedules a standalone workout by creating a temporary track and adding the workout to it.
 * Returns the created TrackWorkout.
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
	teamSpecificNotes?: string | null
	scalingGuidanceForDay?: string | null
	classTimes?: string | null
}): Promise<TrackWorkout> {
	const db = getDB()
	// 1. Create a temporary programming track for this standalone workout
	const track = await createProgrammingTrack({
		name: `Standalone - ${workoutId} - ${scheduledDate.toISOString().slice(0, 10)}`,
		description: "Standalone scheduled workout (auto-generated)",
		type: "self_programmed",
		ownerTeamId: teamId,
		isPublic: false,
	})

	// 2. Add the workout to the track as day 1
	const trackWorkout = await addWorkoutToTrack({
		trackId: track.id,
		workoutId,
		dayNumber: 1,
		notes: teamSpecificNotes || null,
	})

	// 3. Optionally, assign the track to the team (not strictly required for scheduling)
	await assignTrackToTeam(teamId, track.id, false)

	return trackWorkout
}
