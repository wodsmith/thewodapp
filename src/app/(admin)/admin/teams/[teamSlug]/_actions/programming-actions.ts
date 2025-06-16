"use server"

import { TEAM_PERMISSIONS } from "@/db/schema"
import { getTeamTracks, getWorkoutsForTrack } from "@/server/programming-tracks"
import { requireTeamPermission } from "@/utils/team-auth"
import { z } from "zod"
import { createServerAction } from "zsa"

const getTeamTracksSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const getWorkoutsForTrackSchema = z.object({
	trackId: z.string().min(1, "Track ID is required"),
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
		const { trackId } = input

		// Note: We might want to add team permission check here based on track ownership
		const workouts = await getWorkoutsForTrack(trackId)

		console.log(
			`INFO: [ProgrammingTracks] Retrieved ${workouts.length} workouts for trackId '${trackId}'`,
		)

		return { success: true, data: workouts }
	})
