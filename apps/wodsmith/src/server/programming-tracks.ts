import "server-only"

import { createId } from "@paralleldrive/cuid2"
import { and, eq, max, notExists, or } from "drizzle-orm"
import { getDb } from "@/db"
import { logError, logInfo } from "@/lib/logging/posthog-otel-logger"
import {
	type ProgrammingTrack,
	programmingTracksTable,
	scheduledWorkoutInstancesTable,
	type Team,
	type TeamProgrammingTrack,
	type TrackWorkout,
	teamProgrammingTracksTable,
	teamTable,
	trackWorkoutsTable,
	type Workout,
	workouts,
} from "@/db/schema"
import { requireFeature, requireLimit } from "./entitlements"
import { FEATURES } from "@/config/features"
import { LIMITS } from "@/config/limits"

/* -------------------------------------------------------------------------- */
/*                                Data Types                                  */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                              Core Functions                                 */
/* -------------------------------------------------------------------------- */

export async function createProgrammingTrack(
	data: CreateTrackInput,
): Promise<ProgrammingTrack> {
	const db = getDb()

	// If the track is owned by a team, check entitlements
	if (data.ownerTeamId) {
		// Check if team has programming tracks feature
		await requireFeature(data.ownerTeamId, FEATURES.PROGRAMMING_TRACKS)

		// Check if team has reached programming track limit
		await requireLimit(data.ownerTeamId, LIMITS.MAX_PROGRAMMING_TRACKS)
	}

	const result = await db
		.insert(programmingTracksTable)
		.values({
			id: `ptrk_${createId()}`,
			name: data.name,
			description: data.description,
			type: data.type,
			ownerTeamId: data.ownerTeamId,
			isPublic: data.isPublic ? 1 : 0,
			scalingGroupId: data.scalingGroupId,
			// Let database defaults handle timestamps
		})
		.returning()

	const [track] = Array.isArray(result) ? result : []
	if (!track) {
		throw new Error("Failed to create programming track")
	}
	return track
}

export async function updateProgrammingTrack(
	trackId: string,
	data: {
		name?: string
		description?: string | null
		type?: ProgrammingTrack["type"]
		isPublic?: boolean
		scalingGroupId?: string | null
	},
): Promise<ProgrammingTrack> {
	const db = getDb()

	const updateData: Partial<typeof programmingTracksTable.$inferInsert> = {
		updatedAt: new Date(),
	}

	if (data.name !== undefined) updateData.name = data.name
	if (data.description !== undefined) updateData.description = data.description
	if (data.type !== undefined) updateData.type = data.type
	if (data.isPublic !== undefined) updateData.isPublic = data.isPublic ? 1 : 0
	if (data.scalingGroupId !== undefined)
		updateData.scalingGroupId = data.scalingGroupId

	const result = await db
		.update(programmingTracksTable)
		.set(updateData)
		.where(eq(programmingTracksTable.id, trackId))
		.returning()

	const [track] = Array.isArray(result) ? result : []
	if (!track) {
		throw new Error("Failed to update programming track")
	}
	return track
}

export async function getProgrammingTrackById(
	trackId: string,
): Promise<ProgrammingTrack | null> {
	const db = getDb()
	const [track] = await db
		.select()
		.from(programmingTracksTable)
		.where(eq(programmingTracksTable.id, trackId))
	return track ?? null
}

/**
 * Check if a team owns a programming track
 */
export async function isTrackOwner(
	teamId: string,
	trackId: string,
): Promise<boolean> {
	const track = await getProgrammingTrackById(trackId)
	if (!track) {
		return false
	}
	return track.ownerTeamId === teamId
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
	const db = getDb()

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

export async function getNextTrackOrderForTrack(
	trackId: string,
): Promise<number> {
	const db = getDb()

	const result = await db
		.select({ maxOrder: max(trackWorkoutsTable.trackOrder) })
		.from(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.trackId, trackId))

	const maxOrder = result[0]?.maxOrder ?? 0
	return maxOrder + 1
}

export async function addWorkoutToTrack(
	data: AddWorkoutToTrackInput,
): Promise<TrackWorkout> {
	const db = getDb()

	// If no track order provided, get the next available one
	const trackOrder =
		data.trackOrder ?? (await getNextTrackOrderForTrack(data.trackId))

	const [trackWorkout] = await db
		.insert(trackWorkoutsTable)
		.values({
			id: `trwk_${createId()}`,
			trackId: data.trackId,
			workoutId: data.workoutId,
			trackOrder: trackOrder,
			notes: data.notes,
			pointsMultiplier: data.pointsMultiplier,
			// Let database defaults handle timestamps
		})
		.returning()

	if (!trackWorkout) {
		throw new Error("Failed to add workout to track")
	}
	return trackWorkout
}

export async function getWorkoutsForTrack(
	trackId: string,
	teamId?: string,
): Promise<
	(TrackWorkout & {
		workout: Workout
		isScheduled?: boolean
		lastScheduledAt?: Date | null
	})[]
> {
	const db = getDb()
	const workoutsResult = await db
		.select({
			trackWorkout: trackWorkoutsTable,
			workout: workouts,
		})
		.from(trackWorkoutsTable)
		.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
		.where(eq(trackWorkoutsTable.trackId, trackId))

	if (!teamId) {
		return workoutsResult.map((w) => ({
			...w.trackWorkout,
			workout: w.workout,
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

	const workoutsWithScheduledInfo = workoutsResult.map((w) => ({
		...w.trackWorkout,
		workout: w.workout,
		isScheduled: scheduledDatesMap.has(w.trackWorkout.id),
		lastScheduledAt: scheduledDatesMap.get(w.trackWorkout.id) ?? null,
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
	const db = getDb()

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
		if (!updated) {
			throw new Error("Failed to update team programming track")
		}
		return updated
	}

	const [created] = await db
		.insert(teamProgrammingTracksTable)
		.values({
			teamId,
			trackId,
			isActive: isActive ? 1 : 0,
			// Let database defaults handle timestamps
		})
		.returning()
	if (!created) {
		throw new Error("Failed to assign track to team")
	}
	return created
}

export async function getTracksOwnedByTeam(
	teamId: string,
): Promise<ProgrammingTrack[]> {
	const db = getDb()

	const ownedTracks = await db
		.select()
		.from(programmingTracksTable)
		.where(eq(programmingTracksTable.ownerTeamId, teamId))

	return ownedTracks
}

export async function getTeamTracks(
	teamId: string,
	activeOnly = true,
): Promise<ProgrammingTrack[]> {
	const db = getDb()

	logInfo({
		message: "[programming-tracks] Fetching team tracks",
		attributes: { teamId, activeOnly },
	})

	// Get tracks owned by the team
	const ownedTracks = await db
		.select()
		.from(programmingTracksTable)
		.where(eq(programmingTracksTable.ownerTeamId, teamId))

	logInfo({
		message: "[programming-tracks] Owned tracks fetched",
		attributes: { teamId, count: ownedTracks.length },
	})

	// Get tracks assigned to the team via team_programming_tracks table
	const assignedTracksQuery = db
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

	const assignedRecords = await assignedTracksQuery
	const assignedTracks = assignedRecords.map((r) => r.track)

	logInfo({
		message: "[programming-tracks] Assigned tracks fetched",
		attributes: { teamId, count: assignedTracks.length },
	})

	// Combine and deduplicate tracks (in case a team owns a track and is also assigned to it)
	const allTracks = [...ownedTracks, ...assignedTracks]
	const uniqueTracks = allTracks.filter(
		(track, index, array) =>
			array.findIndex((t) => t.id === track.id) === index,
	)

	logInfo({
		message: "[programming-tracks] Returning unique tracks",
		attributes: { teamId, count: uniqueTracks.length },
	})

	return uniqueTracks
}

/**
 * Get workouts that are not in any programming track
 * These are "standalone" workouts that can be scheduled independently
 */
export async function getWorkoutsNotInTracks(
	teamId: string,
): Promise<
	(Workout & { isScheduled?: boolean; lastScheduledAt?: Date | null })[]
> {
	const db = getDb()
	const allWorkouts = await db
		.select()
		.from(workouts)
		.where(
			and(
				eq(workouts.teamId, teamId),
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
	const db = getDb()
	const result = await db
		.update(teamTable)
		.set({ defaultTrackId: trackId, updatedAt: new Date() })
		.where(eq(teamTable.id, teamId))
		.returning()
	const [team] = Array.isArray(result) ? result : []
	if (!team) {
		throw new Error("Failed to update team default track")
	}
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
	scalingGuidanceForDay: _scalingGuidanceForDay,
	classTimes: _classTimes,
}: {
	teamId: string
	workoutId: string
	scheduledDate: Date
	teamSpecificNotes?: string | null
	scalingGuidanceForDay?: string | null
	classTimes?: string | null
}): Promise<TrackWorkout> {
	const _db = getDb()
	// 1. Create a temporary programming track for this standalone workout
	const track = await createProgrammingTrack({
		name: `Standalone - ${workoutId} - ${scheduledDate
			.toISOString()
			.slice(0, 10)}`,
		description: "Standalone scheduled workout (auto-generated)",
		type: "self_programmed",
		ownerTeamId: teamId,
		isPublic: false,
	})

	// 2. Add the workout to the track as order 1
	const trackWorkout = await addWorkoutToTrack({
		trackId: track.id,
		workoutId,
		trackOrder: 1,
		notes: teamSpecificNotes || null,
	})

	// 3. Optionally, assign the track to the team (not strictly required for scheduling)
	await assignTrackToTeam(teamId, track.id, false)

	return trackWorkout
}

export async function deleteProgrammingTrack(trackId: string): Promise<void> {
	const db = getDb()

	// Delete associated track workouts first (foreign key constraint)
	await db
		.delete(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.trackId, trackId))

	// Delete team programming track associations
	await db
		.delete(teamProgrammingTracksTable)
		.where(eq(teamProgrammingTracksTable.trackId, trackId))

	// Delete the programming track
	await db
		.delete(programmingTracksTable)
		.where(eq(programmingTracksTable.id, trackId))

	logInfo({
		message: "[programming-tracks] Deleted programming track",
		attributes: { trackId },
	})
}

export async function removeWorkoutFromTrack(
	trackWorkoutId: string,
): Promise<void> {
	const db = getDb()

	await db
		.delete(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.id, trackWorkoutId))

	logInfo({
		message: "[programming-tracks] Removed workout from track",
		attributes: { trackWorkoutId },
	})
}

export async function updateTrackWorkout({
	trackWorkoutId,
	trackOrder,
	notes,
	pointsMultiplier,
}: {
	trackWorkoutId: string
	trackOrder?: number
	notes?: string | null
	pointsMultiplier?: number | null
}): Promise<TrackWorkout> {
	const db = getDb()

	const updateData: Partial<TrackWorkout> = {
		updatedAt: new Date(),
	}

	if (trackOrder !== undefined) updateData.trackOrder = trackOrder
	if (notes !== undefined) updateData.notes = notes
	if (pointsMultiplier !== undefined)
		updateData.pointsMultiplier = pointsMultiplier

	const [trackWorkout] = await db
		.update(trackWorkoutsTable)
		.set(updateData)
		.where(eq(trackWorkoutsTable.id, trackWorkoutId))
		.returning()

	if (!trackWorkout) {
		throw new Error("Failed to update track workout")
	}
	logInfo({
		message: "[programming-tracks] Updated track workout",
		attributes: { trackWorkoutId },
	})
	return trackWorkout
}

/**
 * Reorder track workouts by updating their track order in bulk.
 *
 * @param trackId - The ID of the track containing the workouts.
 * @param updates - An array of objects containing track workout IDs and their new track orders.
 * @returns The number of updated records.
 */
export async function reorderTrackWorkouts(
	trackId: string,
	updates: { trackWorkoutId: string; trackOrder: number }[],
): Promise<number> {
	const db = getDb()

	logInfo({
		message: "[programming-tracks] Reorder start",
		attributes: { trackId, updatesCount: updates.length },
	})

	try {
		// First, validate all track workouts exist and belong to this track
		const existingWorkouts = await db
			.select({
				id: trackWorkoutsTable.id,
				trackOrder: trackWorkoutsTable.trackOrder,
			})
			.from(trackWorkoutsTable)
			.where(eq(trackWorkoutsTable.trackId, trackId))

		logInfo({
			message: "[programming-tracks] Found existing track workouts",
			attributes: { trackId, existingCount: existingWorkouts.length },
		})

		const trackWorkoutIds = existingWorkouts.map((w) => w.id)

		// Validate all updates refer to valid track workouts
		for (const { trackWorkoutId } of updates) {
			if (!trackWorkoutIds.includes(trackWorkoutId)) {
				logError({
					message: "[programming-tracks] Invalid track workout ID",
					attributes: { trackWorkoutId, trackId, validIds: trackWorkoutIds },
				})
				throw new Error(
					`Track workout ${trackWorkoutId} does not belong to track ${trackId}`,
				)
			}
		}

		// Perform the updates without using a transaction for Cloudflare D1 compatibility
		let updateCount = 0
		for (const { trackWorkoutId, trackOrder } of updates) {
			logInfo({
				message: "[programming-tracks] Updating track workout",
				attributes: { trackWorkoutId, trackOrder },
			})

			try {
				await db
					.update(trackWorkoutsTable)
					.set({ trackOrder, updatedAt: new Date() })
					.where(eq(trackWorkoutsTable.id, trackWorkoutId))
					.returning({
						id: trackWorkoutsTable.id,
						trackOrder: trackWorkoutsTable.trackOrder,
					})

				logInfo({
					message: "[programming-tracks] Track workout update success",
					attributes: { trackWorkoutId },
				})
				updateCount += 1
			} catch (updateError) {
				logError({
					message:
						"[programming-tracks] Failed to update individual track workout",
					error: updateError,
					attributes: { trackWorkoutId, trackOrder },
				})
				throw updateError
			}
		}

		logInfo({
			message: "[programming-tracks] Reorder completed",
			attributes: { trackId, updateCount },
		})
		return updateCount
	} catch (error) {
		logError({
			message: "[programming-tracks] Reorder operation failed",
			error,
			attributes: {
				trackId,
				updatesCount: updates.length,
			},
		})
		throw error
	}
}
