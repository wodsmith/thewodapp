import "server-only"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { getDd } from "@/db"
import {
	type ProgrammingTrack,
	programmingTracksTable,
	scheduledWorkoutInstancesTable,
	type TrackWorkout,
	teamProgrammingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { teamTable } from "@/db/schemas/teams"
import { type Workout, workouts } from "@/db/schemas/workouts"
import type { ScheduledWorkoutInstanceWithDetails } from "@/server/scheduling-service"

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
			scalingGroupId: programmingTracksTable.scalingGroupId,
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
			scalingGroupId: programmingTracksTable.scalingGroupId,
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
			scalingGroupId: programmingTracksTable.scalingGroupId,
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
		.orderBy(desc(trackWorkoutsTable.dayNumber))
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

export interface ExternalWorkoutDetectionResult {
	scheduledWorkout: ScheduledWorkoutInstanceWithDetails
	isExternal: boolean
	trackOwnership: {
		trackId: string
		trackOwnerTeamId: string | null
		isOwnedByTeam: boolean
	} | null
}

export async function detectExternalProgrammingTrackWorkouts(
	teamId: string,
	scheduledWorkoutIds: string[],
): Promise<ExternalWorkoutDetectionResult[]> {
	console.info("INFO: Detecting external programming track workouts", {
		teamId,
		scheduledWorkoutIds,
	})

	if (scheduledWorkoutIds.length === 0) {
		return []
	}

	const db = getDd()

	// Get scheduled workout instances with track workouts and programming tracks
	const rows = await db
		.select({
			// Scheduled workout instance fields
			instanceId: scheduledWorkoutInstancesTable.id,
			instanceTeamId: scheduledWorkoutInstancesTable.teamId,
			instanceTrackWorkoutId: scheduledWorkoutInstancesTable.trackWorkoutId,
			instanceScheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
			instanceTeamSpecificNotes:
				scheduledWorkoutInstancesTable.teamSpecificNotes,
			instanceScalingGuidanceForDay:
				scheduledWorkoutInstancesTable.scalingGuidanceForDay,
			instanceClassTimes: scheduledWorkoutInstancesTable.classTimes,
			instanceCreatedAt: scheduledWorkoutInstancesTable.createdAt,
			instanceUpdatedAt: scheduledWorkoutInstancesTable.updatedAt,
			instanceUpdateCounter: scheduledWorkoutInstancesTable.updateCounter,

			// Track workout fields
			trackWorkoutId: trackWorkoutsTable.id,
			trackWorkoutTrackId: trackWorkoutsTable.trackId,
			trackWorkoutWorkoutId: trackWorkoutsTable.workoutId,
			trackWorkoutDayNumber: trackWorkoutsTable.dayNumber,
			trackWorkoutWeekNumber: trackWorkoutsTable.weekNumber,
			trackWorkoutNotes: trackWorkoutsTable.notes,
			trackWorkoutCreatedAt: trackWorkoutsTable.createdAt,
			trackWorkoutUpdatedAt: trackWorkoutsTable.updatedAt,
			trackWorkoutUpdateCounter: trackWorkoutsTable.updateCounter,

			// Workout fields
			workoutId: workouts.id,
			workoutName: workouts.name,
			workoutDescription: workouts.description,
			workoutScheme: workouts.scheme,
			workoutScope: workouts.scope,
			workoutTeamId: workouts.teamId,
			workoutScalingGroupId: workouts.scalingGroupId,
			workoutCreatedAt: workouts.createdAt,
			workoutUpdatedAt: workouts.updatedAt,
			workoutUpdateCounter: workouts.updateCounter,
			workoutSourceWorkoutId: workouts.sourceWorkoutId,
			workoutSourceTrackId: workouts.sourceTrackId,

			// Programming track fields
			trackId: programmingTracksTable.id,
			trackName: programmingTracksTable.name,
			trackDescription: programmingTracksTable.description,
			trackType: programmingTracksTable.type,
			trackOwnerTeamId: programmingTracksTable.ownerTeamId,
			trackIsPublic: programmingTracksTable.isPublic,
			trackCreatedAt: programmingTracksTable.createdAt,
			trackUpdatedAt: programmingTracksTable.updatedAt,
			trackUpdateCounter: programmingTracksTable.updateCounter,
		})
		.from(scheduledWorkoutInstancesTable)
		.leftJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.id, scheduledWorkoutInstancesTable.trackWorkoutId),
		)
		.leftJoin(workouts, eq(workouts.id, trackWorkoutsTable.workoutId))
		.leftJoin(
			programmingTracksTable,
			eq(programmingTracksTable.id, trackWorkoutsTable.trackId),
		)
		.where(
			and(
				inArray(scheduledWorkoutInstancesTable.id, scheduledWorkoutIds),
				eq(scheduledWorkoutInstancesTable.teamId, teamId),
			),
		)

	return rows.map((row) => {
		// Build scheduled workout instance
		const scheduledWorkout: ScheduledWorkoutInstanceWithDetails = {
			id: row.instanceId,
			teamId: row.instanceTeamId,
			workoutId: row.workoutId,
			trackWorkoutId: row.instanceTrackWorkoutId,
			scheduledDate: row.instanceScheduledDate,
			teamSpecificNotes: row.instanceTeamSpecificNotes,
			scalingGuidanceForDay: row.instanceScalingGuidanceForDay,
			classTimes: row.instanceClassTimes,
			createdAt: row.instanceCreatedAt,
			updatedAt: row.instanceUpdatedAt,
			updateCounter: row.instanceUpdateCounter,
			trackWorkout: row.trackWorkoutId
				? {
						id: row.trackWorkoutId,
						trackId: row.trackWorkoutTrackId as string,
						workoutId: row.trackWorkoutWorkoutId as string,
						dayNumber: (row.trackWorkoutDayNumber ?? 0) as number,
						weekNumber: row.trackWorkoutWeekNumber,
						notes: row.trackWorkoutNotes,
						createdAt: (row.trackWorkoutCreatedAt ?? new Date()) as Date,
						updatedAt: (row.trackWorkoutUpdatedAt ?? new Date()) as Date,
						updateCounter: row.trackWorkoutUpdateCounter,
						workout: row.workoutId
							? {
									id: row.workoutId,
									name: (row.workoutName ?? "") as string,
									description: (row.workoutDescription ?? "") as string,
									scheme: (row.workoutScheme ?? "reps") as any,
									scoreType: null,
									scope: (row.workoutScope ?? "public") as any,
									teamId: row.workoutTeamId,
									scalingGroupId: row.workoutScalingGroupId,
									createdAt: (row.workoutCreatedAt ?? new Date()) as Date,
									updatedAt: (row.workoutUpdatedAt ?? new Date()) as Date,
									updateCounter: row.workoutUpdateCounter,
									sourceWorkoutId: row.workoutSourceWorkoutId,
									sourceTrackId: row.workoutSourceTrackId,
									// Satisfy Workout shape with safe defaults
									repsPerRound: null,
									roundsToScore: null,
									sugarId: null,
									tiebreakScheme: null,
									secondaryScheme: null,
								}
							: undefined,
					}
				: null,
		}

		// Determine if this is external
		let isExternal = false
		let trackOwnership: ExternalWorkoutDetectionResult["trackOwnership"] = null

		if (row.trackId) {
			const isOwnedByTeam = row.trackOwnerTeamId === teamId
			isExternal = !isOwnedByTeam

			trackOwnership = {
				trackId: row.trackId,
				trackOwnerTeamId: row.trackOwnerTeamId,
				isOwnedByTeam,
			}
		}

		return {
			scheduledWorkout,
			isExternal,
			trackOwnership,
		}
	})
}

export async function isTeamSubscribedToProgrammingTrack(
	teamId: string,
	trackId: string,
): Promise<boolean> {
	console.log("🔍 Checking team subscription:", { teamId, trackId })

	const db = getDd()
	const result = await db
		.select({ trackId: teamProgrammingTracksTable.trackId })
		.from(teamProgrammingTracksTable)
		.where(
			and(
				eq(teamProgrammingTracksTable.teamId, teamId),
				eq(teamProgrammingTracksTable.trackId, trackId),
				eq(teamProgrammingTracksTable.isActive, 1),
			),
		)
		.limit(1)

	console.log("🔍 Subscription query result:", {
		result,
		isSubscribed: result.length > 0,
	})
	return result.length > 0
}

export async function isWorkoutInTeamSubscribedTrack(
	teamId: string,
	workoutId: string,
): Promise<boolean> {
	console.log("🔍 Checking if workout is in team subscribed track:", {
		teamId,
		workoutId,
	})

	const db = getDd()

	// Find track workouts that contain this workout and check if team is subscribed to those tracks
	const result = await db
		.select({ trackId: trackWorkoutsTable.trackId })
		.from(trackWorkoutsTable)
		.innerJoin(
			teamProgrammingTracksTable,
			eq(trackWorkoutsTable.trackId, teamProgrammingTracksTable.trackId),
		)
		.where(
			and(
				eq(trackWorkoutsTable.workoutId, workoutId),
				eq(teamProgrammingTracksTable.teamId, teamId),
				eq(teamProgrammingTracksTable.isActive, 1),
			),
		)
		.limit(1)

	console.log("🔍 Workout in subscribed track query result:", {
		result,
		isInSubscribedTrack: result.length > 0,
	})
	return result.length > 0
}

export async function getUserProgrammingTracks(userTeamIds: string[]): Promise<
	{
		trackId: string
		trackName: string
		trackDescription: string | null
		subscribedTeamId: string
		subscribedTeamName: string
	}[]
> {
	console.info("INFO: Fetching programming tracks for user teams", {
		teamCount: userTeamIds.length,
	})

	if (userTeamIds.length === 0) {
		return []
	}

	const db = getDd()
	const tracks = await db
		.select({
			trackId: programmingTracksTable.id,
			trackName: programmingTracksTable.name,
			trackDescription: programmingTracksTable.description,
			subscribedTeamId: teamTable.id,
			subscribedTeamName: teamTable.name,
		})
		.from(teamProgrammingTracksTable)
		.innerJoin(
			programmingTracksTable,
			eq(teamProgrammingTracksTable.trackId, programmingTracksTable.id),
		)
		.innerJoin(teamTable, eq(teamProgrammingTracksTable.teamId, teamTable.id))
		.where(
			and(
				inArray(teamProgrammingTracksTable.teamId, userTeamIds),
				eq(teamProgrammingTracksTable.isActive, 1),
			),
		)
		.orderBy(programmingTracksTable.name)

	// Deduplicate tracks by ID while preserving team info
	const uniqueTracks = new Map<
		string,
		{
			trackId: string
			trackName: string
			trackDescription: string | null
			subscribedTeamId: string
			subscribedTeamName: string
		}
	>()

	for (const track of tracks) {
		if (!uniqueTracks.has(track.trackId)) {
			uniqueTracks.set(track.trackId, track)
		}
	}

	return Array.from(uniqueTracks.values())
}
