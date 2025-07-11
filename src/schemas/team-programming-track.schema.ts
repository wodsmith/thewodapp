import { z } from "zod"
import { teamProgrammingTracksTable } from "@/db/schemas/programming"

export const subscribeTeamToTrackSchema = z.object({
	teamId: z.string(),
	trackId: z.string(),
})

export const unsubscribeTeamFromTrackSchema = z.object({
	teamId: z.string(),
	trackId: z.string(),
})

export const teamProgrammingTrackSchema = z.object({
	teamId: z.string(),
	trackId: z.string(),
	startDayOffset: z.number().int().default(0),
	isActive: z.boolean().default(true),
})
