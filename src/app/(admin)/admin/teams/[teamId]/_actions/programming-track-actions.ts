"use server"

import { TEAM_PERMISSIONS } from "@/db/schema"
import {
	addWorkoutToTrackSchema,
	createProgrammingTrackSchema,
	deleteProgrammingTrackSchema,
	getTeamTracksSchema,
	getTrackWorkoutsSchema,
	removeWorkoutFromTrackSchema,
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
	removeWorkoutFromTrack,
	updateProgrammingTrack,
	updateTrackWorkout,
} from "@/server/programming-tracks"
import { requireTeamPermission } from "@/utils/team-auth"
import { revalidatePath } from "next/cache"
import { createServerAction } from "zsa"

/**
 * Create a new programming track
 */
export const createProgrammingTrackAction = createServerAction()
	.input(createProgrammingTrackSchema)
	.handler(async ({ input }) => {
		const { teamId, name, description, type, isPublic } = input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			const track = await createProgrammingTrack({
				name,
				description,
				type,
				ownerTeamId: teamId,
				isPublic,
			})

			console.log(
				`INFO: [ProgrammingTrack] Created track: ${name} for team: ${teamId} by user: creating-user`,
			)

			// Revalidate the programming page
			revalidatePath("/admin/teams/*/programming")

			return { success: true, data: track }
		} catch (error) {
			console.error("Failed to create programming track:", error)
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

			await deleteProgrammingTrack(trackId)

			console.log(
				`INFO: [ProgrammingTrack] Deleted track: ${trackId} for team: ${teamId}`,
			)

			// Revalidate the programming page
			revalidatePath("/admin/teams/*/programming")

			return { success: true }
		} catch (error) {
			console.error("Failed to delete programming track:", error)
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
		const { teamId, trackId, isPublic } = input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			// Check track access
			const trackAccess = await hasTrackAccess(teamId, trackId)
			if (!trackAccess) {
				throw new Error("Team does not have access to this track")
			}

			const track = await updateProgrammingTrack(trackId, { isPublic })

			console.log(
				`INFO: [ProgrammingTrack] Updated track: ${trackId} for team: ${teamId} - isPublic: ${isPublic}`,
			)

			// Revalidate the programming page and track page
			revalidatePath("/admin/teams/*/programming")
			revalidatePath(`/admin/teams/${teamId}/programming/${trackId}`)

			return { success: true, data: track }
		} catch (error) {
			console.error("Failed to update programming track:", error)
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

			console.log(
				`INFO: [ProgrammingTrack] Retrieved ${tracks.length} programming tracks for teamId '${teamId}'`,
			)

			return { success: true, data: tracks }
		} catch (error) {
			console.error("Failed to get team tracks:", error)
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
		const { teamId, trackId, workoutId, dayNumber, weekNumber, notes } = input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			// Check track access
			const trackAccess = await hasTrackAccess(teamId, trackId)
			if (!trackAccess) {
				throw new Error("Team does not have access to this track")
			}

			const trackWorkout = await addWorkoutToTrack({
				trackId,
				workoutId,
				dayNumber,
				weekNumber,
				notes,
			})

			console.log(
				`INFO: [TrackWorkout] Added workout: ${workoutId} to track: ${trackId} at day: ${dayNumber}`,
			)

			// Revalidate the track workout page
			revalidatePath("/admin/teams/*/programming/*")

			return { success: true, data: trackWorkout }
		} catch (error) {
			console.error("Failed to add workout to track:", error)
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

			// Check track access
			const trackAccess = await hasTrackAccess(teamId, trackId)
			if (!trackAccess) {
				throw new Error("Team does not have access to this track")
			}

			await removeWorkoutFromTrack(trackWorkoutId)

			console.log(
				`INFO: [TrackWorkout] Removed workout from track: ${trackId}, trackWorkoutId: ${trackWorkoutId}`,
			)

			// Revalidate the track workout page
			revalidatePath("/admin/teams/*/programming/*")

			return { success: true }
		} catch (error) {
			console.error("Failed to remove workout from track:", error)
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
		const { teamId, trackId, trackWorkoutId, dayNumber, weekNumber, notes } =
			input

		try {
			// Check permissions
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

			// Check track access
			const trackAccess = await hasTrackAccess(teamId, trackId)
			if (!trackAccess) {
				throw new Error("Team does not have access to this track")
			}

			const trackWorkout = await updateTrackWorkout({
				trackWorkoutId,
				dayNumber,
				weekNumber,
				notes,
			})

			console.log(
				`INFO: [TrackWorkout] Updated track workout: ${trackWorkoutId} in track: ${trackId}`,
			)

			// Revalidate the track workout page
			revalidatePath("/admin/teams/*/programming/*")

			return { success: true, data: trackWorkout }
		} catch (error) {
			console.error("Failed to update track workout:", error)
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

			console.log(
				`INFO: [TrackWorkout] Retrieved ${trackWorkouts.length} workouts for track: ${trackId} team: ${teamId}`,
			)

			return { success: true, data: trackWorkouts }
		} catch (error) {
			console.error("Failed to get track workouts:", error)
			if (error instanceof Error) {
				throw new Error(`Failed to get track workouts: ${error.message}`)
			}
			throw new Error("Failed to get track workouts")
		}
	})
