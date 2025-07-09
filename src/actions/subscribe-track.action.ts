import "server-only"

import { z } from "zod"
import { createServerAction } from "zsa"
import { getSessionFromCookie } from "@/utils/auth"
import { TeamProgrammingTrackService } from "@/server/team-programming-tracks"
import { getUserPersonalTeam } from "@/server/teams"

const subscribeTrackSchema = z.object({
	trackId: z.string(),
	teamId: z.string().optional(),
})

export const subscribeTrackAction = createServerAction()
	.input(subscribeTrackSchema)
	.handler(async ({ input }) => {
		const session = await getSessionFromCookie()
		if (!session?.user) {
			throw new Error("Not authenticated")
		}

		const { trackId, teamId } = input

		console.log(
			`ACTION: subscribeTrack user="${session.user.id}" teamId="${teamId || "personal"}" trackId="${trackId}"`,
		)

		// If teamId is not provided, use the user's personal team
		let finalTeamId = teamId
		if (!finalTeamId) {
			const personalTeam = await getUserPersonalTeam(session.user.id)
			if (!personalTeam) {
				throw new Error("User has no personal team")
			}
			finalTeamId = personalTeam.id
		}

		// Subscribe the team to the track
		const result = await TeamProgrammingTrackService.subscribeTeamToTrack({
			teamId: finalTeamId,
			trackId,
		})

		if (!result.success) {
			throw new Error(`Failed to subscribe to track: ${result.error}`)
		}

		return { success: true }
	})

export const unsubscribeTrackAction = createServerAction()
	.input(subscribeTrackSchema)
	.handler(async ({ input }) => {
		const session = await getSessionFromCookie()
		if (!session?.user) {
			throw new Error("Not authenticated")
		}

		const { trackId, teamId } = input

		console.log(
			`ACTION: unsubscribeTrack user="${session.user.id}" teamId="${teamId || "personal"}" trackId="${trackId}"`,
		)

		// If teamId is not provided, use the user's personal team
		let finalTeamId = teamId
		if (!finalTeamId) {
			const personalTeam = await getUserPersonalTeam(session.user.id)
			if (!personalTeam) {
				throw new Error("User has no personal team")
			}
			finalTeamId = personalTeam.id
		}

		// Unsubscribe the team from the track
		const result = await TeamProgrammingTrackService.unsubscribeTeamFromTrack({
			teamId: finalTeamId,
			trackId,
		})

		if (!result.success) {
			throw new Error(`Failed to unsubscribe from track: ${result.error}`)
		}

		return { success: true }
	})
