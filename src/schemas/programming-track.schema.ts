import { PROGRAMMING_TRACK_TYPE } from "@/db/schemas/programming"
import { z } from "zod"

export const createProgrammingTrackSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	name: z
		.string()
		.min(1, "Track name is required")
		.max(255, "Name is too long"),
	description: z.string().max(1000, "Description is too long").optional(),
	type: z.enum([
		PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED,
		PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
		PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY,
	]),
	isPublic: z.boolean().optional().default(false),
})

export const deleteProgrammingTrackSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().min(1, "Track ID is required"),
})

export const updateProgrammingTrackSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().min(1, "Track ID is required"),
	isPublic: z.boolean(),
})

export const getTeamTracksSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

// Track workout management schemas
export const addWorkoutToTrackSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().min(1, "Track ID is required"),
	workoutId: z.string().min(1, "Workout ID is required"),
	dayNumber: z.number().int().min(1, "Day number must be at least 1"),
	weekNumber: z.number().int().min(1).optional(),
	notes: z.string().max(1000, "Notes are too long").optional(),
})

export const removeWorkoutFromTrackSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().min(1, "Track ID is required"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
})

export const updateTrackWorkoutSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().min(1, "Track ID is required"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	dayNumber: z
		.number()
		.int()
		.min(1, "Day number must be at least 1")
		.optional(),
	weekNumber: z.number().int().min(1).optional(),
	notes: z.string().max(1000, "Notes are too long").optional(),
})

export const getTrackWorkoutsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().min(1, "Track ID is required"),
})

export const reorderTrackWorkoutsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().min(1, "Track ID is required"),
	updates: z
		.array(
			z.object({
				trackWorkoutId: z.string().min(1, "Track Workout ID is required"),
				dayNumber: z.number().int().min(1, "Day number must be at least 1"),
			}),
		)
		.min(1, "At least one update is required"),
})

export type CreateProgrammingTrackInput = z.infer<
	typeof createProgrammingTrackSchema
>
export type DeleteProgrammingTrackInput = z.infer<
	typeof deleteProgrammingTrackSchema
>
export type UpdateProgrammingTrackInput = z.infer<
	typeof updateProgrammingTrackSchema
>
export type GetTeamTracksInput = z.infer<typeof getTeamTracksSchema>

// Track workout management types
export type AddWorkoutToTrackInput = z.infer<typeof addWorkoutToTrackSchema>
export type RemoveWorkoutFromTrackInput = z.infer<
	typeof removeWorkoutFromTrackSchema
>
export type UpdateTrackWorkoutInput = z.infer<typeof updateTrackWorkoutSchema>
export type GetTrackWorkoutsInput = z.infer<typeof getTrackWorkoutsSchema>
