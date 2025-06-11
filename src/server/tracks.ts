import "server-only"

import { getDB } from "@/db"
import { type ProgrammingTrack, programmingTracksTable } from "@/db/schema"
import { eq } from "drizzle-orm"

/* -------------------------------------------------------------------------- */
/*                               Data helpers                                 */
/* -------------------------------------------------------------------------- */

export interface CreateTrackData {
	name: string
	description?: string | null
	type: (typeof programmingTracksTable._.columns.type)["data"]
	ownerTeamId?: string | null
	isPublic?: boolean
}

/* -------------------------------------------------------------------------- */
/*                             Core operations                                 */
/* -------------------------------------------------------------------------- */

export async function getAllTracks(): Promise<ProgrammingTrack[]> {
	const db = getDB()
	const rows = await db.select().from(programmingTracksTable)
	return rows
}

export async function getTrackById(
	trackId: string,
): Promise<ProgrammingTrack | null> {
	const db = getDB()
	const [track] = await db
		.select()
		.from(programmingTracksTable)
		.where(eq(programmingTracksTable.id, trackId))
	return track ?? null
}

export async function createTrack(
	data: CreateTrackData,
): Promise<ProgrammingTrack> {
	const db = getDB()
	const track = await db
		.insert(programmingTracksTable)
		.values({
			name: data.name,
			description: data.description,
			type: data.type,
			ownerTeamId: data.ownerTeamId,
			isPublic: data.isPublic ? 1 : 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning({
			id: programmingTracksTable.id,
		})

	console.log("[Tracks] Created track", track)

	return track[0]
}
