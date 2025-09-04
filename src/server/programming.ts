import "server-only"
import { eq, and } from "drizzle-orm"
import { getDd } from "@/db"
import {
	programmingTracksTable,
	teamProgrammingTracksTable,
	type ProgrammingTrack,
} from "@/db/schemas/programming"
import { teamTable } from "@/db/schemas/teams"

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
