import "server-only"

import { getDB } from "@/db"
import {
	type TeamProgrammingTrack,
	teamProgrammingTracksTable,
} from "@/db/schema"

/* -------------------------------------------------------------------------- */
/*                               Data helpers                                 */
/* -------------------------------------------------------------------------- */

export interface CreateTeamProgrammingTrackInput {
	teamId: string
	trackId: string
	isActive?: boolean
}

/* -------------------------------------------------------------------------- */
/*                             Core operation                                  */
/* -------------------------------------------------------------------------- */

export async function createTeamProgrammingTrack({
	teamId,
	trackId,
	isActive = true,
}: CreateTeamProgrammingTrackInput): Promise<TeamProgrammingTrack> {
	const db = getDB()

	console.log("[TeamProgrammingTracks] Creating team programming track", {
		teamId,
		trackId,
		isActive,
	})

	const [row] = await db
		.insert(teamProgrammingTracksTable)
		.values({
			teamId,
			trackId,
			isActive: isActive ? 1 : 0,
			addedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning()

	return row
}
