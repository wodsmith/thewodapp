import "server-only"

import { and, eq } from "drizzle-orm"
import { getDB } from "@/db"
import {
	type ProgrammingTrack,
	programmingTracksTable,
	type ScheduledWorkoutInstance,
	scheduledWorkoutInstancesTable,
	teamProgrammingTracksTable,
	type TrackWorkout,
	trackWorkoutsTable,
	type Workout,
	workouts,
} from "@/db/schema"
import { teamTable } from "@/db/schemas/teams"
import { tryCatch } from "@/lib/try-catch"
import {
	subscribeTeamToTrackSchema,
	unsubscribeTeamFromTrackSchema,
} from "@/schemas/team-programming-track.schema"
import { getUserTeams } from "@/utils/team-auth"

/* -------------------------------------------------------------------------- */
/*                             Data Type Helpers                               */
/* -------------------------------------------------------------------------- */

export interface TeamWithScheduledWorkouts {
	id: string
	name: string
	slug: string
	scheduledWorkouts: ScheduledWorkoutWithTrackDetails[]
}

export interface ScheduledWorkoutWithTrackDetails {
	id: string
	scheduledDate: Date
	teamSpecificNotes?: string | null
	scalingGuidanceForDay?: string | null
	classTimes?: string | null
	trackWorkout: TrackWorkout & {
		workout: Workout
		track: ProgrammingTrack
	}
}

/* -------------------------------------------------------------------------- */
/*                                Operations                                   */
/* -------------------------------------------------------------------------- */

export async function getTeamsWithScheduledWorkouts(
	userId: string,
): Promise<TeamWithScheduledWorkouts[]> {
	if (process.env.LOG_LEVEL === "info") {
		console.log(
			`INFO: [getTeamsWithScheduledWorkouts] Fetching teams for user: ${userId}`,
		)
	}

	const db = getDB()

	// Get user's teams from session
	const userTeams = await getUserTeams()

	if (!userTeams || userTeams.length === 0) {
		if (process.env.LOG_LEVEL === "info") {
			console.log(
				`INFO: [getTeamsWithScheduledWorkouts] No teams found for user: ${userId}`,
			)
		}
		return []
	}

	const teamIds = userTeams.map((team) => team.id)

	// Get all scheduled workouts for user's teams with full details
	const scheduledWorkoutsData = await db
		.select({
			// Scheduled workout instance fields
			instanceId: scheduledWorkoutInstancesTable.id,
			scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
			teamSpecificNotes: scheduledWorkoutInstancesTable.teamSpecificNotes,
			scalingGuidanceForDay:
				scheduledWorkoutInstancesTable.scalingGuidanceForDay,
			classTimes: scheduledWorkoutInstancesTable.classTimes,
			// Team fields
			teamId: teamTable.id,
			teamName: teamTable.name,
			teamSlug: teamTable.slug,
			// Track workout fields
			trackWorkoutId: trackWorkoutsTable.id,
			dayNumber: trackWorkoutsTable.dayNumber,
			weekNumber: trackWorkoutsTable.weekNumber,
			trackWorkoutNotes: trackWorkoutsTable.notes,
			// Workout fields
			workoutId: workouts.id,
			workoutName: workouts.name,
			workoutDescription: workouts.description,
			workoutScheme: workouts.scheme,
			workoutRepsPerRound: workouts.repsPerRound,
			workoutScope: workouts.scope,
			// Programming track fields
			trackId: programmingTracksTable.id,
			trackName: programmingTracksTable.name,
			trackDescription: programmingTracksTable.description,
			trackType: programmingTracksTable.type,
		})
		.from(scheduledWorkoutInstancesTable)
		.innerJoin(
			teamTable,
			eq(teamTable.id, scheduledWorkoutInstancesTable.teamId),
		)
		.innerJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.id, scheduledWorkoutInstancesTable.trackWorkoutId),
		)
		.innerJoin(workouts, eq(workouts.id, trackWorkoutsTable.workoutId))
		.innerJoin(
			programmingTracksTable,
			eq(programmingTracksTable.id, trackWorkoutsTable.trackId),
		)
		.where(
			and(
				eq(scheduledWorkoutInstancesTable.teamId, teamIds[0]), // Start with first team, we'll handle multiple teams below
			),
		)

	// If user has multiple teams, we need to query for all of them
	let allScheduledWorkouts = scheduledWorkoutsData

	if (teamIds.length > 1) {
		const additionalQueries = await Promise.all(
			teamIds.slice(1).map((teamId) =>
				db
					.select({
						// Scheduled workout instance fields
						instanceId: scheduledWorkoutInstancesTable.id,
						scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
						teamSpecificNotes: scheduledWorkoutInstancesTable.teamSpecificNotes,
						scalingGuidanceForDay:
							scheduledWorkoutInstancesTable.scalingGuidanceForDay,
						classTimes: scheduledWorkoutInstancesTable.classTimes,
						// Team fields
						teamId: teamTable.id,
						teamName: teamTable.name,
						teamSlug: teamTable.slug,
						// Track workout fields
						trackWorkoutId: trackWorkoutsTable.id,
						dayNumber: trackWorkoutsTable.dayNumber,
						weekNumber: trackWorkoutsTable.weekNumber,
						trackWorkoutNotes: trackWorkoutsTable.notes,
						// Workout fields
						workoutId: workouts.id,
						workoutName: workouts.name,
						workoutDescription: workouts.description,
						workoutScheme: workouts.scheme,
						workoutRepsPerRound: workouts.repsPerRound,
						workoutScope: workouts.scope,
						// Programming track fields
						trackId: programmingTracksTable.id,
						trackName: programmingTracksTable.name,
						trackDescription: programmingTracksTable.description,
						trackType: programmingTracksTable.type,
					})
					.from(scheduledWorkoutInstancesTable)
					.innerJoin(
						teamTable,
						eq(teamTable.id, scheduledWorkoutInstancesTable.teamId),
					)
					.innerJoin(
						trackWorkoutsTable,
						eq(
							trackWorkoutsTable.id,
							scheduledWorkoutInstancesTable.trackWorkoutId,
						),
					)
					.innerJoin(workouts, eq(workouts.id, trackWorkoutsTable.workoutId))
					.innerJoin(
						programmingTracksTable,
						eq(programmingTracksTable.id, trackWorkoutsTable.trackId),
					)
					.where(eq(scheduledWorkoutInstancesTable.teamId, teamId)),
			),
		)

		allScheduledWorkouts = [
			...scheduledWorkoutsData,
			...additionalQueries.flat(),
		]
	}

	// Group by team and transform data
	const teamsMap = new Map<string, TeamWithScheduledWorkouts>()

	for (const row of allScheduledWorkouts) {
		if (!teamsMap.has(row.teamId)) {
			teamsMap.set(row.teamId, {
				id: row.teamId,
				name: row.teamName,
				slug: row.teamSlug,
				scheduledWorkouts: [],
			})
		}

		const team = teamsMap.get(row.teamId)!
		team.scheduledWorkouts.push({
			id: row.instanceId,
			scheduledDate: row.scheduledDate,
			teamSpecificNotes: row.teamSpecificNotes,
			scalingGuidanceForDay: row.scalingGuidanceForDay,
			classTimes: row.classTimes,
			trackWorkout: {
				id: row.trackWorkoutId,
				trackId: row.trackId,
				workoutId: row.workoutId,
				dayNumber: row.dayNumber,
				weekNumber: row.weekNumber,
				notes: row.trackWorkoutNotes,
				createdAt: new Date(), // These will be properly populated from DB
				updatedAt: new Date(),
				updateCounter: 0,
				workout: {
					id: row.workoutId,
					name: row.workoutName,
					description: row.workoutDescription,
					scheme: row.workoutScheme,
					repsPerRound: row.workoutRepsPerRound,
					scope: row.workoutScope,
					createdAt: new Date(), // These will be properly populated from DB
					updatedAt: new Date(),
					updateCounter: 0,
					roundsToScore: 1, // Default value
					teamId: row.teamId,
					sugarId: null,
					tiebreakScheme: null,
					secondaryScheme: null,
					sourceTrackId: null,
				},
				track: {
					id: row.trackId,
					name: row.trackName,
					description: row.trackDescription,
					type: row.trackType,
					ownerTeamId: row.teamId, // This should come from actual track data
					isPublic: 0, // This should come from actual track data
					createdAt: new Date(), // These will be properly populated from DB
					updatedAt: new Date(),
					updateCounter: 0,
				},
			},
		})
	}

	const result = Array.from(teamsMap.values())

	if (process.env.LOG_LEVEL === "info") {
		const totalWorkouts = result.reduce(
			(sum, team) => sum + team.scheduledWorkouts.length,
			0,
		)
		console.log(
			`INFO: [getTeamsWithScheduledWorkouts] Fetched ${result.length} teams with ${totalWorkouts} scheduled workouts for user: ${userId}`,
		)
	}

	return result
}

export async function getTeamScheduledWorkouts(
	teamId: string,
): Promise<ScheduledWorkoutWithTrackDetails[]> {
	if (process.env.LOG_LEVEL === "info") {
		console.log(
			`INFO: [getTeamScheduledWorkouts] Fetching scheduled workouts for team: ${teamId}`,
		)
	}

	const db = getDB()

	// Get scheduled workouts for the specific team with full details
	const scheduledWorkoutsData = await db
		.select({
			// Scheduled workout instance fields
			instanceId: scheduledWorkoutInstancesTable.id,
			scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
			teamSpecificNotes: scheduledWorkoutInstancesTable.teamSpecificNotes,
			scalingGuidanceForDay:
				scheduledWorkoutInstancesTable.scalingGuidanceForDay,
			classTimes: scheduledWorkoutInstancesTable.classTimes,
			// Track workout fields
			trackWorkoutId: trackWorkoutsTable.id,
			dayNumber: trackWorkoutsTable.dayNumber,
			weekNumber: trackWorkoutsTable.weekNumber,
			trackWorkoutNotes: trackWorkoutsTable.notes,
			// Workout fields
			workoutId: workouts.id,
			workoutName: workouts.name,
			workoutDescription: workouts.description,
			workoutScheme: workouts.scheme,
			workoutRepsPerRound: workouts.repsPerRound,
			workoutScope: workouts.scope,
			// Programming track fields
			trackId: programmingTracksTable.id,
			trackName: programmingTracksTable.name,
			trackDescription: programmingTracksTable.description,
			trackType: programmingTracksTable.type,
		})
		.from(scheduledWorkoutInstancesTable)
		.innerJoin(
			trackWorkoutsTable,
			eq(trackWorkoutsTable.id, scheduledWorkoutInstancesTable.trackWorkoutId),
		)
		.innerJoin(workouts, eq(workouts.id, trackWorkoutsTable.workoutId))
		.innerJoin(
			programmingTracksTable,
			eq(programmingTracksTable.id, trackWorkoutsTable.trackId),
		)
		.where(eq(scheduledWorkoutInstancesTable.teamId, teamId))
		.orderBy(scheduledWorkoutInstancesTable.scheduledDate)

	// Transform data to match the expected interface
	const result = scheduledWorkoutsData.map((row) => ({
		id: row.instanceId,
		scheduledDate: row.scheduledDate,
		teamSpecificNotes: row.teamSpecificNotes,
		scalingGuidanceForDay: row.scalingGuidanceForDay,
		classTimes: row.classTimes,
		trackWorkout: {
			id: row.trackWorkoutId,
			trackId: row.trackId,
			workoutId: row.workoutId,
			dayNumber: row.dayNumber,
			weekNumber: row.weekNumber,
			notes: row.trackWorkoutNotes,
			createdAt: new Date(), // These will be properly populated from DB
			updatedAt: new Date(),
			updateCounter: 0,
			workout: {
				id: row.workoutId,
				name: row.workoutName,
				description: row.workoutDescription,
				scheme: row.workoutScheme,
				repsPerRound: row.workoutRepsPerRound,
				scope: row.workoutScope,
				createdAt: new Date(), // These will be properly populated from DB
				updatedAt: new Date(),
				updateCounter: 0,
				roundsToScore: 1, // Default value
				teamId: teamId,
				sugarId: null,
				tiebreakScheme: null,
				secondaryScheme: null,
				sourceTrackId: null,
			},
			track: {
				id: row.trackId,
				name: row.trackName,
				description: row.trackDescription,
				type: row.trackType,
				ownerTeamId: teamId, // This should come from actual track data
				isPublic: 0, // This should come from actual track data
				createdAt: new Date(), // These will be properly populated from DB
				updatedAt: new Date(),
				updateCounter: 0,
			},
		},
	}))

	if (process.env.LOG_LEVEL === "info") {
		console.log(
			`INFO: [getTeamScheduledWorkouts] Fetched ${result.length} scheduled workouts for team: ${teamId}`,
		)
	}

	return result
}

export const TeamProgrammingTrackService = {
	subscribeTeamToTrack: async (input: { teamId: string; trackId: string }) => {
		return await tryCatch(
			(async () => {
				const db = getDB()
				const { teamId, trackId } = subscribeTeamToTrackSchema.parse(input)

				console.log(
					`INFO: [TeamProgrammingTrackService] teamId="${teamId}" trackId="${trackId}" action="subscribe"`,
				)

				const existing = await db.query.teamProgrammingTracksTable.findFirst({
					where: and(
						eq(teamProgrammingTracksTable.teamId, teamId),
						eq(teamProgrammingTracksTable.trackId, trackId),
					),
				})

				if (existing) {
					return await db
						.update(teamProgrammingTracksTable)
						.set({ isActive: 1 })
						.where(
							and(
								eq(teamProgrammingTracksTable.teamId, teamId),
								eq(teamProgrammingTracksTable.trackId, trackId),
							),
						)
						.returning()
				} else {
					return await db
						.insert(teamProgrammingTracksTable)
						.values({
							teamId,
							trackId,
							isActive: 1,
							startDayOffset: 0,
						})
						.returning()
				}
			})(),
		)
	},

	unsubscribeTeamFromTrack: async (input: {
		teamId: string
		trackId: string
	}) => {
		return await tryCatch(
			(async () => {
				const db = getDB()
				const { teamId, trackId } = unsubscribeTeamFromTrackSchema.parse(input)

				console.log(
					`INFO: [TeamProgrammingTrackService] teamId="${teamId}" trackId="${trackId}" action="unsubscribe"`,
				)

				return await db
					.update(teamProgrammingTracksTable)
					.set({ isActive: 0 })
					.where(
						and(
							eq(teamProgrammingTracksTable.teamId, teamId),
							eq(teamProgrammingTracksTable.trackId, trackId),
						),
					)
					.returning()
			})(),
		)
	},
}
