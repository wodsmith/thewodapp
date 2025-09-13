import { z } from "zod"

export const createWorkoutSchema = z.object({
	name: z.string().min(1, "Workout name is required"),
	description: z.string().min(1, "Description is required"),
	scheme: z.enum(
		[
			"time",
			"time-with-cap",
			"rounds-reps",
			"reps",
			"emom",
			"load",
			"calories",
			"meters",
			"pass-fail",
		],
		{
			required_error: "Scheme is required",
		},
	),
	scope: z.enum(["private", "public"]).default("private"),
	roundsToScore: z.number().optional(),
	repsPerRound: z.number().optional(),
	selectedMovements: z.array(z.string()).default([]),
	selectedTags: z.array(z.string()).default([]),
	trackId: z.string().optional(),
	scheduledDate: z.date().optional(),
	selectedTeamId: z.string().optional(),
})

export type CreateWorkoutSchema = z.infer<typeof createWorkoutSchema>
