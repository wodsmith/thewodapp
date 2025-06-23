"use server"

import { TEAM_PERMISSIONS } from "@/db/schema"
import {
	createProgrammingTrackSchema,
	deleteProgrammingTrackSchema,
	getTeamTracksSchema,
} from "@/schemas/programming-track.schema"
import {
	createProgrammingTrack,
	deleteProgrammingTrack,
	getTeamTracks,
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
