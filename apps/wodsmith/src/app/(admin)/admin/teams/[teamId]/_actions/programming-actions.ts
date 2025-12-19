"use server"

import { createServerAction } from "@repo/zsa"
import { z } from "zod"
import { TEAM_PERMISSIONS } from "@/db/schema"
import {
	getTeamTracks,
	getWorkoutsForTrack,
	getWorkoutsNotInTracks,
	hasTrackAccess,
} from "@/server/programming-tracks"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"

const getTeamTracksSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const getWorkoutsForTrackSchema = z.object({
	trackId: z.string().min(1, "Track ID is required"),
	teamId: z.string().optional(),
})

const getWorkoutsNotInTracksSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

/**
 * Get programming tracks for a team
 */
export const getTeamTracksAction = createServerAction()
	.input(getTeamTracksSchema)
	.handler(async ({ input }) => {
		const { teamId } = input

		// Check permissions
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		const tracks = await getTeamTracks(teamId)

		console.log(
			`INFO: [ProgrammingTracks] Retrieved ${tracks.length} programming tracks for teamId '${teamId}'`,
		)

		return { success: true, data: tracks }
	})

/**
 * Get workouts for a programming track
 */
export const getWorkoutsForTrackAction = createServerAction()
	.input(getWorkoutsForTrackSchema)
	.handler(async ({ input }) => {
		const { trackId, teamId } = input

		// If teamId is provided, check permissions
		if (teamId) {
			// Check team access permission first
			await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

			// Verify team has access to this specific track
			const hasAccess = await hasTrackAccess(teamId, trackId)
			if (!hasAccess) {
				throw new Error(
					"Access denied: Team does not have permission to access this programming track",
				)
			}
		}

		const workouts = await getWorkoutsForTrack(trackId, teamId)

		console.log(
			`INFO: [ProgrammingTracks] Retrieved ${workouts.length} workouts for trackId '${trackId}'${
				teamId ? ` (teamId: ${teamId})` : ""
			}`,
		)

		return { success: true, data: workouts }
	})

/**
 * Get workouts that are not in any programming track
 */
export const getWorkoutsNotInTracksAction = createServerAction()
	.input(getWorkoutsNotInTracksSchema)
	.handler(async ({ input }) => {
		const { teamId } = input

		// Check permissions
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		// Get current user
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Unauthorized")
		}

		const workouts = await getWorkoutsNotInTracks(teamId)

		console.log(
			`INFO: [ProgrammingTracks] Retrieved ${workouts.length} standalone workouts not in tracks for teamId: ${teamId}`,
		)

		return { success: true, data: workouts }
	})
