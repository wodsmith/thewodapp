import "server-only"

import { getDB } from "@/db"
import {
	type ProgrammingTrack,
	type Team,
	type TeamProgrammingTrack,
	type TrackWorkout,
	type Workout,
	programmingTracksTable,
	teamProgrammingTracksTable,
	teamTable, // Corrected: teamTable (as per schema.ts)
	trackWorkoutsTable,
	workouts, // Corrected: workouts (as per schema.ts)
} from "@/db/schema"
import { createId } from "@paralleldrive/cuid2"
import { and, asc, desc, eq, getTableColumns, sql } from "drizzle-orm"

/* -------------------------------------------------------------------------- */
/*                                Data Types                                  */
/* -------------------------------------------------------------------------- */

export interface CreateTrackInput {
	name: string
	description?: string | null
	type: "standard" | "onboarding" | "template" // This should align with your actual schema enum if different
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

export interface TrackWorkoutWithDetails extends TrackWorkout {
	workout: Workout
}

/* -------------------------------------------------------------------------- */
/*                              Core Functions                                 */
/* -------------------------------------------------------------------------- */

export async function createProgrammingTrack(
	data: CreateTrackInput,
): Promise<ProgrammingTrack> {
	const db = getDB()

	const newTrack = {
		id: `ptrk_${createId()}`,
		name: data.name,
		description: data.description,
		// Ensure this 'type' matches the enum in programmingTracksTable schema
		type: data.type as ProgrammingTrack["type"], // Cast if necessary, ensure data.type is valid
		ownerTeamId: data.ownerTeamId,
		isPublic: data.isPublic ? 1 : 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	}

	const result = await db
		.insert(programmingTracksTable)
		.values(newTrack)
		.returning()
		.get() // Assuming .get() for SQLite returning a single object

	return result
}

export async function getProgrammingTrackById(
	trackId: string,
): Promise<ProgrammingTrack | null> {
	const db = getDB()
	const track = await db
		.select()
		.from(programmingTracksTable)
		.where(eq(programmingTracksTable.id, trackId))
		.get() // Assuming .get() for SQLite to get a single record or null
	return track ?? null
}

export async function addWorkoutToTrack(
	data: AddWorkoutToTrackInput,
): Promise<TrackWorkout> {
	const db = getDB()

	const newTrackWorkout = {
		id: `trwk_${createId()}`,
		trackId: data.trackId,
		workoutId: data.workoutId,
		dayNumber: data.dayNumber,
		weekNumber: data.weekNumber,
		notes: data.notes,
		createdAt: new Date(),
		updatedAt: new Date(),
	}

	const trackWorkout = await db
		.insert(trackWorkoutsTable)
		.values(newTrackWorkout)
		.returning()
		.get() // Assuming .get() for SQLite

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
		.orderBy(asc(trackWorkoutsTable.dayNumber)) // Added orderBy
}

export async function getTrackWorkoutsWithDetails(
	currentTrackId: string,
): Promise<TrackWorkoutWithDetails[]> {
	const db = getDB()
	const results = await db
		.select({
			// Select all columns from trackWorkoutsTable for the main part of TrackWorkoutWithDetails
			...getTableColumns(trackWorkoutsTable),
			// Nest workout details under the 'workout' key
			workout: getTableColumns(workouts), // Corrected: workouts
		})
		.from(trackWorkoutsTable)
		.leftJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id)) // Corrected: workouts
		.where(eq(trackWorkoutsTable.trackId, currentTrackId))
		.orderBy(asc(trackWorkoutsTable.dayNumber)) // Crucially order by dayNumber

	// Drizzle's select with nested objects might directly return the desired structure.
	// If not, a manual mapping step would be needed, but often it aligns well.
	// Ensure that the 'workout' field in TrackWorkoutWithDetails matches what getTableColumns(workoutTable) provides.
	return results as TrackWorkoutWithDetails[]
}

export async function assignTrackToTeam(
	teamId: string,
	trackId: string,
	isActive = true,
): Promise<TeamProgrammingTrack> {
	const db = getDB()
	const valuesToInsert = {
		teamId,
		trackId,
		isActive: isActive ? 1 : 0,
		addedAt: new Date(),
		createdAt: new Date(), // Assuming commonColumns handles this if not specified
		updatedAt: new Date(), // Assuming commonColumns handles this if not specified
	}
	// teamProgrammingTracksTable does not have an 'id' column based on schema, it has a composite PK.
	const [teamTrack] = await db
		.insert(teamProgrammingTracksTable)
		.values(valuesToInsert)
		.returning()

	return teamTrack
}

export async function getTeamTracks(
	teamId: string,
	activeOnly = true,
): Promise<ProgrammingTrack[]> {
	const db = getDB()
	const conditions = [eq(teamProgrammingTracksTable.teamId, teamId)]

	if (activeOnly) {
		conditions.push(eq(teamProgrammingTracksTable.isActive, 1))
	}

	const queryBuilder = db
		.select(getTableColumns(programmingTracksTable))
		.from(teamProgrammingTracksTable)
		.innerJoin(
			programmingTracksTable,
			eq(teamProgrammingTracksTable.trackId, programmingTracksTable.id),
		)
		.where(and(...conditions))

	const results = await queryBuilder.orderBy(
		desc(programmingTracksTable.createdAt),
	)

	return results
}

export async function updateTeamDefaultTrack(
	teamId: string,
	newDefaultTrackId: string | null,
): Promise<Team> {
	const db = getDB()
	const updatedTeam = await db
		.update(teamTable) // Corrected: teamTable
		.set({
			defaultProgrammingTrackId: newDefaultTrackId,
			updatedAt: new Date(),
		})
		.where(eq(teamTable.id, teamId))
		.returning()
		.get() // Use .get() to retrieve the updated record

	if (!updatedTeam) {
		throw new Error(
			`Failed to update team with ID ${teamId} or team not found.`,
		)
	}

	return updatedTeam
}
