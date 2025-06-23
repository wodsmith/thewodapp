import { z } from "zod"

export const createProgrammingTrackSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	name: z
		.string()
		.min(1, "Track name is required")
		.max(255, "Name is too long"),
	description: z.string().max(1000, "Description is too long").optional(),
	type: z.enum(["pre_built", "self_programmed", "hybrid"]),
	isPublic: z.boolean().optional().default(false),
})

export const deleteProgrammingTrackSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().min(1, "Track ID is required"),
})

export const getTeamTracksSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

export type CreateProgrammingTrackInput = z.infer<
	typeof createProgrammingTrackSchema
>
export type DeleteProgrammingTrackInput = z.infer<
	typeof deleteProgrammingTrackSchema
>
export type GetTeamTracksInput = z.infer<typeof getTeamTracksSchema>
