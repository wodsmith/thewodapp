"use server"

import { createServerAction } from "@repo/zsa"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getDb } from "@/db"
import { scalingGroupsTable, TEAM_PERMISSIONS } from "@/db/schema"
import { logDebug, logError, logInfo } from "@/lib/logging/posthog-otel-logger"
import {
	addWorkoutToTrackSchema,
	createProgrammingTrackSchema,
	deleteProgrammingTrackSchema,
	getTeamTracksSchema,
	getTrackWorkoutsSchema,
	removeWorkoutFromTrackSchema,
	reorderTrackWorkoutsSchema,
	updateProgrammingTrackSchema,
	updateTrackWorkoutSchema,
} from "@/schemas/programming-track.schema"
import {
	addWorkoutToTrack,
	createProgrammingTrack,
	deleteProgrammingTrack,
	getTeamTracks,
	getWorkoutsForTrack,
	hasTrackAccess,
	isTrackOwner,
	removeWorkoutFromTrack,
	reorderTrackWorkouts,
	updateProgrammingTrack,
	updateTrackWorkout,
} from "@/server/programming-tracks"
import { requireTeamPermission } from "@/utils/team-auth"

/**
 * Create a new programming track
 */
export const createProgrammingTrackAction = createServerAction()
	.input(createProgrammingTrackSchema)
	.handler(async ({ input }) => {
		const { teamId, name, description, type, isPublic, scalingGroupId } = input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			const track = await createProgrammingTrack({
				name,
				description,
				type,
				ownerTeamId: teamId,
				isPublic,
				scalingGroupId,
			})

			logInfo({
				message: "[ProgrammingTrack] Created track",
				attributes: { trackName: name, teamId, trackId: track.id },
			})

			// Revalidate the programming page
			revalidatePath("/admin/teams/programming")

			return { success: true, data: track }
		} catch (error) {
			logError({
				message:
					"[createProgrammingTrackAction] Failed to create programming track",
				error,
				attributes: { teamId, name },
			})
			if (error instanceof Error) {
				throw new Error(`Failed to create programming track: ${error.message}`)
			}
			throw new Error("Failed to create programming track")
		}
	})

/**
 * Delete a programming track
 */
export const deleteProgrammingTrackAction = createServerAction()
	.input(deleteProgrammingTrackSchema)
	.handler(async ({ input }) => {
		const { teamId, trackId } = input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			// Check if team owns the track (only owners can delete)
			const isOwner = await isTrackOwner(teamId, trackId)
			if (!isOwner) {
				throw new Error("Only track owners can delete tracks")
			}

			await deleteProgrammingTrack(trackId)

			logInfo({
				message: "[ProgrammingTrack] Deleted track",
				attributes: { trackId, teamId },
			})

			// Revalidate the programming page
			revalidatePath("/admin/teams/programming")

			return { success: true }
		} catch (error) {
			logError({
				message:
					"[deleteProgrammingTrackAction] Failed to delete programming track",
				error,
				attributes: { trackId, teamId },
			})
			if (error instanceof Error) {
				throw new Error(`Failed to delete programming track: ${error.message}`)
			}
			throw new Error("Failed to delete programming track")
		}
	})

/**
 * Update a programming track
 */
export const updateProgrammingTrackAction = createServerAction()
	.input(updateProgrammingTrackSchema)
	.handler(async ({ input }) => {
		const {
			teamId,
			trackId,
			name,
			description,
			type,
			isPublic,
			scalingGroupId,
		} = input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			// Check if team owns the track (only owners can edit)
			const isOwner = await isTrackOwner(teamId, trackId)
			if (!isOwner) {
				throw new Error("Only track owners can modify track settings")
			}

			const updateData: Parameters<typeof updateProgrammingTrack>[1] = {}

			if (name !== undefined) updateData.name = name
			if (description !== undefined) updateData.description = description
			if (type !== undefined) updateData.type = type
			if (isPublic !== undefined) updateData.isPublic = isPublic
			if (scalingGroupId !== undefined) {
				// Verify scaling group ownership
				if (scalingGroupId !== "none" && scalingGroupId !== null) {
					const db = getDb()
					const scalingGroup = await db.query.scalingGroupsTable.findFirst({
						where: and(
							eq(scalingGroupsTable.id, scalingGroupId),
							eq(scalingGroupsTable.teamId, teamId),
						),
					})

					if (!scalingGroup) {
						throw new Error(
							"Scaling group does not exist or does not belong to this team",
						)
					}
				}

				updateData.scalingGroupId =
					scalingGroupId === "none" ? null : scalingGroupId
			}

			const track = await updateProgrammingTrack(trackId, updateData)

			logInfo({
				message: "[ProgrammingTrack] Updated track",
				attributes: {
					trackId,
					teamId,
					fieldsUpdated: Object.keys(updateData).join(", "),
				},
			})

			// Revalidate the programming page and track page
			revalidatePath("/admin/teams/programming")
			revalidatePath(`/admin/teams/programming/${trackId}`)

			return { success: true, data: track }
		} catch (error) {
			logError({
				message:
					"[updateProgrammingTrackAction] Failed to update programming track",
				error,
				attributes: { trackId, teamId },
			})
			if (error instanceof Error) {
				throw new Error(`Failed to update programming track: ${error.message}`)
			}
			throw new Error("Failed to update programming track")
		}
	})

/**
 * Get programming tracks for a team
 */
export const getTeamTracksAction = createServerAction()
	.input(getTeamTracksSchema)
	.handler(async ({ input }) => {
		const { teamId } = input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			const tracks = await getTeamTracks(teamId)

			logDebug({
				message: "[ProgrammingTrack] Retrieved tracks",
				attributes: { teamId, trackCount: tracks.length },
			})

			return { success: true, data: tracks }
		} catch (error) {
			logError({
				message: "[getTeamTracksAction] Failed to get team tracks",
				error,
				attributes: { teamId },
			})
			if (error instanceof Error) {
				throw new Error(`Failed to get team tracks: ${error.message}`)
			}
			throw new Error("Failed to get team tracks")
		}
	})

/**
 * Add a workout to a programming track
 */
export const addWorkoutToTrackAction = createServerAction()
	.input(addWorkoutToTrackSchema)
	.handler(async ({ input }) => {
		const { teamId, trackId, workoutId, trackOrder, notes, pointsMultiplier } =
			input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			// Check if team owns the track (only owners can add workouts)
			const isOwner = await isTrackOwner(teamId, trackId)
			if (!isOwner) {
				throw new Error("Only track owners can add workouts to the track")
			}

			const trackWorkout = await addWorkoutToTrack({
				trackId,
				workoutId,
				trackOrder,
				notes,
				pointsMultiplier,
			})

			logInfo({
				message: "[TrackWorkout] Added workout to track",
				attributes: { workoutId, trackId, trackOrder: trackOrder ?? 0 },
			})

			// Revalidate the track workout page
			revalidatePath("/admin/teams/programming")

			return { success: true, data: trackWorkout }
		} catch (error) {
			logError({
				message: "[addWorkoutToTrackAction] Failed to add workout to track",
				error,
				attributes: { trackId, workoutId, teamId },
			})
			if (error instanceof Error) {
				throw new Error(`Failed to add workout to track: ${error.message}`)
			}
			throw new Error("Failed to add workout to track")
		}
	})

/**
 * Remove a workout from a programming track
 */
export const removeWorkoutFromTrackAction = createServerAction()
	.input(removeWorkoutFromTrackSchema)
	.handler(async ({ input }) => {
		const { teamId, trackId, trackWorkoutId } = input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			// Check if team owns the track (only owners can remove workouts)
			const isOwner = await isTrackOwner(teamId, trackId)
			if (!isOwner) {
				throw new Error("Only track owners can remove workouts from the track")
			}

			await removeWorkoutFromTrack(trackWorkoutId)

			logInfo({
				message: "[TrackWorkout] Removed workout from track",
				attributes: { trackId, trackWorkoutId },
			})

			// Revalidate the track workout page
			revalidatePath("/admin/teams/programming")

			return { success: true }
		} catch (error) {
			logError({
				message:
					"[removeWorkoutFromTrackAction] Failed to remove workout from track",
				error,
				attributes: { trackId, trackWorkoutId, teamId },
			})
			if (error instanceof Error) {
				throw new Error(`Failed to remove workout from track: ${error.message}`)
			}
			throw new Error("Failed to remove workout from track")
		}
	})

/**
 * Update a track workout
 */
export const updateTrackWorkoutAction = createServerAction()
	.input(updateTrackWorkoutSchema)
	.handler(async ({ input }) => {
		const {
			teamId,
			trackId,
			trackWorkoutId,
			trackOrder,
			notes,
			pointsMultiplier,
		} = input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			// Check if team owns the track (only owners can update workouts)
			const isOwner = await isTrackOwner(teamId, trackId)
			if (!isOwner) {
				throw new Error("Only track owners can update track workouts")
			}

			const trackWorkout = await updateTrackWorkout({
				trackWorkoutId,
				trackOrder,
				notes,
				pointsMultiplier,
			})

			logInfo({
				message: "[TrackWorkout] Updated track workout",
				attributes: { trackWorkoutId, trackId },
			})

			// Revalidate the track workout page
			revalidatePath("/admin/teams/programming")

			return { success: true, data: trackWorkout }
		} catch (error) {
			logError({
				message: "[updateTrackWorkoutAction] Failed to update track workout",
				error,
				attributes: { trackWorkoutId, trackId, teamId },
			})
			if (error instanceof Error) {
				throw new Error(`Failed to update track workout: ${error.message}`)
			}
			throw new Error("Failed to update track workout")
		}
	})

/**
 * Get workouts for a programming track
 */
export const getTrackWorkoutsAction = createServerAction()
	.input(getTrackWorkoutsSchema)
	.handler(async ({ input }) => {
		const { teamId, trackId } = input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			// Check track access
			const trackAccess = await hasTrackAccess(teamId, trackId)
			if (!trackAccess) {
				throw new Error("Team does not have access to this track")
			}

			const trackWorkouts = await getWorkoutsForTrack(trackId, teamId)

			logDebug({
				message: "[TrackWorkout] Retrieved workouts for track",
				attributes: { trackId, teamId, workoutCount: trackWorkouts.length },
			})

			return { success: true, data: trackWorkouts }
		} catch (error) {
			logError({
				message: "[getTrackWorkoutsAction] Failed to get track workouts",
				error,
				attributes: { trackId, teamId },
			})
			if (error instanceof Error) {
				throw new Error(`Failed to get track workouts: ${error.message}`)
			}
			throw new Error("Failed to get track workouts")
		}
	})

/**
 * Reorder track workouts by updating their track order in bulk.
 */
export const reorderTrackWorkoutsAction = createServerAction()
	.input(reorderTrackWorkoutsSchema)
	.handler(async ({ input }) => {
		const { teamId, trackId, updates } = input

		logDebug({
			message: "[ReorderAction] Starting",
			attributes: { teamId, trackId, updatesCount: updates.length },
		})

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			// Check if team owns the track (only owners can reorder)
			const isOwner = await isTrackOwner(teamId, trackId)
			if (!isOwner) {
				throw new Error("Only track owners can reorder track workouts")
			}

			// Perform the reorder operation
			const updateCount = await reorderTrackWorkouts(trackId, updates)

			logInfo({
				message: "[ProgrammingTracks] Successfully reordered track workouts",
				attributes: { trackId, updateCount },
			})

			// Revalidate the track page to reflect the new order
			revalidatePath(`/admin/teams/programming/${trackId}`)

			return { success: true, updateCount }
		} catch (error) {
			logError({
				message:
					"[reorderTrackWorkoutsAction] Failed to reorder track workouts",
				error,
				attributes: { trackId, teamId, updatesCount: updates.length },
			})

			// Preserve the original error message when possible
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to reorder track workouts"
			throw new Error(`Failed to reorder track workouts: ${errorMessage}`)
		}
	})
