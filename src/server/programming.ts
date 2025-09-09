import "server-only"
import { eq, and, asc, sql } from "drizzle-orm"
import { getDd } from "@/db"
import {
	programmingTracksTable,
	teamProgrammingTracksTable,
	trackWorkoutsTable,
	scheduledWorkoutInstancesTable,
	type ProgrammingTrack,
	type TrackWorkout,
} from "@/db/schemas/programming"
import { teamTable } from "@/db/schemas/teams"
import { workouts, type Workout } from "@/db/schemas/workouts"

interface PublicProgrammingTrack extends ProgrammingTrack {
	ownerTeam: {
		id: string
		name: string
	} | null
}

export async function getPublicProgrammingTracks(): Promise<
	PublicProgrammingTrack[]
> {
	console.info("INFO: Fetching public programming tracks")

	const db = getDd()
	const tracks = await db
		.select({
			id: programmingTracksTable.id,
			name: programmingTracksTable.name,
			description: programmingTracksTable.description,
			type: programmingTracksTable.type,
			ownerTeamId: programmingTracksTable.ownerTeamId,
			isPublic: programmingTracksTable.isPublic,
			createdAt: programmingTracksTable.createdAt,
			updatedAt: programmingTracksTable.updatedAt,
			updateCounter: programmingTracksTable.updateCounter,
			ownerTeam: {
				id: teamTable.id,
				name: teamTable.name,
			},
		})
		.from(programmingTracksTable)
		.leftJoin(teamTable, eq(programmingTracksTable.ownerTeamId, teamTable.id))
		.where(eq(programmingTracksTable.isPublic, 1))

	return tracks
}

export async function getTeamProgrammingTracks(
	teamId: string,
): Promise<(PublicProgrammingTrack & { subscribedAt: Date })[]> {
	const db = getDd()
	const tracks = await db
		.select({
			id: programmingTracksTable.id,
			name: programmingTracksTable.name,
			description: programmingTracksTable.description,
			type: programmingTracksTable.type,
			ownerTeamId: programmingTracksTable.ownerTeamId,
			isPublic: programmingTracksTable.isPublic,
			createdAt: programmingTracksTable.createdAt,
			updatedAt: programmingTracksTable.updatedAt,
			updateCounter: programmingTracksTable.updateCounter,
			ownerTeam: {
				id: teamTable.id,
				name: teamTable.name,
			},
			subscribedAt: teamProgrammingTracksTable.subscribedAt,
		})
		.from(teamProgrammingTracksTable)
		.innerJoin(
			programmingTracksTable,
			eq(teamProgrammingTracksTable.trackId, programmingTracksTable.id),
		)
		.leftJoin(teamTable, eq(programmingTracksTable.ownerTeamId, teamTable.id))
		.where(
			and(
				eq(teamProgrammingTracksTable.teamId, teamId),
				eq(teamProgrammingTracksTable.isActive, 1),
			),
		)

	return tracks
}

export async function getProgrammingTrackById(
	trackId: string,
): Promise<PublicProgrammingTrack | null> {
	console.info("INFO: Fetching programming track by ID", { trackId })

	const db = getDd()
	const result = await db
		.select({
			id: programmingTracksTable.id,
			name: programmingTracksTable.name,
			description: programmingTracksTable.description,
			type: programmingTracksTable.type,
			ownerTeamId: programmingTracksTable.ownerTeamId,
			isPublic: programmingTracksTable.isPublic,
			createdAt: programmingTracksTable.createdAt,
			updatedAt: programmingTracksTable.updatedAt,
			updateCounter: programmingTracksTable.updateCounter,
			ownerTeam: {
				id: teamTable.id,
				name: teamTable.name,
			},
		})
		.from(programmingTracksTable)
		.leftJoin(teamTable, eq(programmingTracksTable.ownerTeamId, teamTable.id))
		.where(eq(programmingTracksTable.id, trackId))
		.limit(1)

	return result[0] || null
}

export interface PaginatedTrackWorkoutsResult {
	workouts: (TrackWorkout & {
		workout: Workout
		isScheduled?: boolean
		lastScheduledAt?: Date | null
	})[]
	pagination: {
		page: number
		pageSize: number
		totalCount: number
		totalPages: number
		hasNextPage: boolean
		hasPrevPage: boolean
	}
}

export async function getPaginatedTrackWorkouts(
	trackId: string,
	teamId: string,
	page = 1,
	pageSize = 50,
): Promise<PaginatedTrackWorkoutsResult> {
	console.info("INFO: Fetching paginated track workouts", {
		trackId,
		teamId,
		page,
		pageSize,
	})

	const db = getDd()

	// Validate pagination parameters
	const validPage = Math.max(1, page)
	const validPageSize = Math.min(100, Math.max(1, pageSize)) // Cap at 100
	const offset = (validPage - 1) * validPageSize

	// Get total count
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.trackId, trackId))

	const totalCount = countResult[0]?.count || 0
	const totalPages = Math.ceil(totalCount / validPageSize)

	// Get paginated workouts with details
	const workoutsResult = await db
		.select({
			trackWorkout: trackWorkoutsTable,
			workout: workouts,
		})
		.from(trackWorkoutsTable)
		.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
		.where(eq(trackWorkoutsTable.trackId, trackId))
		.orderBy(asc(trackWorkoutsTable.dayNumber))
		.limit(validPageSize)
		.offset(offset)

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

	const workoutsWithScheduledInfo = workoutsResult.map((w) => ({
		...w.trackWorkout,
		workout: w.workout,
		isScheduled: scheduledDatesMap.has(w.trackWorkout.id),
		lastScheduledAt: scheduledDatesMap.get(w.trackWorkout.id) ?? null,
	}))

	return {
		workouts: workoutsWithScheduledInfo,
		pagination: {
			page: validPage,
			pageSize: validPageSize,
			totalCount,
			totalPages,
			hasNextPage: validPage < totalPages,
			hasPrevPage: validPage > 1,
		},
	}
}
