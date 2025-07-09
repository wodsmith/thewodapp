import { and, eq } from "drizzle-orm"
import { getDB } from "@/db"
import { teamProgrammingTracksTable } from "@/db/schema"
import { tryCatch } from "@/lib/try-catch"
import {
	subscribeTeamToTrackSchema,
	unsubscribeTeamFromTrackSchema,
} from "@/schemas/team-programming-track.schema"

export const TeamProgrammingTrackService = {
	subscribeTeamToTrack: async (input: { teamId: string; trackId: string }) => {
		return await tryCatch(async () => {
			const db = getDB()
			const { teamId, trackId } = subscribeTeamToTrackSchema.parse(input)

			console.log(
				`INFO: [TeamProgrammingTrackService] teamId="${teamId}" trackId="${trackId}" action="subscribe"`,
			)

			const existing = await db.query.teamProgrammingTracksTable.findFirst({
				where: and(
					eq(teamProgrammingTracksTable.teamId, teamId),
					eq(teamProgrammingTracksTable.trackId, trackId),
				),
			})

			if (existing) {
				return await db
					.update(teamProgrammingTracksTable)
					.set({ isActive: true })
					.where(
						and(
							eq(teamProgrammingTracksTable.teamId, teamId),
							eq(teamProgrammingTracksTable.trackId, trackId),
						),
					)
					.returning()
			} else {
				return await db
					.insert(teamProgrammingTracksTable)
					.values({
						teamId,
						trackId,
						isActive: true,
						startDayOffset: 0,
					})
					.returning()
			}
		})
	},

	unsubscribeTeamFromTrack: async (input: {
		teamId: string
		trackId: string
	}) => {
		return await tryCatch(async () => {
			const db = getDB()
			const { teamId, trackId } = unsubscribeTeamFromTrackSchema.parse(input)

			console.log(
				`INFO: [TeamProgrammingTrackService] teamId="${teamId}" trackId="${trackId}" action="unsubscribe"`,
			)

			return await db
				.update(teamProgrammingTracksTable)
				.set({ isActive: false })
				.where(
					and(
						eq(teamProgrammingTracksTable.teamId, teamId),
						eq(teamProgrammingTracksTable.trackId, trackId),
					),
				)
				.returning()
		})
	},
}
