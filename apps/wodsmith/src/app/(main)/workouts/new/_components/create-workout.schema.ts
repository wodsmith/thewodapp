import { z } from "zod"
import {
	WORKOUT_SCHEME_VALUES,
	SCORE_TYPE_VALUES,
} from "@/db/schemas/workouts"

export const createWorkoutSchema = z.object({
	name: z.string().min(1, "Workout name is required"),
	description: z.string().min(1, "Description is required"),
	scheme: z.enum(WORKOUT_SCHEME_VALUES, {
		required_error: "Scheme is required",
	}),
	scoreType: z.enum(SCORE_TYPE_VALUES).optional(),
	scope: z.enum(["private", "public"]).default("private"),
	roundsToScore: z.number().optional(),
	repsPerRound: z.number().optional(),
	selectedMovements: z.array(z.string()).default([]),
	selectedTags: z.array(z.string()).default([]),
	trackId: z.string().optional(),
	scheduledDate: z.date().optional(),
	scalingGroupId: z.string().optional(),
})

export type CreateWorkoutSchema = z.infer<typeof createWorkoutSchema>
