import { z } from "zod"
import { workoutFieldsSchema } from "@/schemas/workout.schema"

/**
 * Schema for creating a new workout - extends base workout fields with create-specific fields
 */
export const createWorkoutSchema = workoutFieldsSchema
	.omit({
		// Create form requires description, so we'll re-add it with stricter validation
		description: true,
	})
	.extend({
		description: z.string().min(1, "Description is required"),
		scope: z.enum(["private", "public"]).default("private"),
		selectedTags: z.array(z.string()).default([]),
		trackId: z.string().optional(),
		scheduledDate: z.date().optional(),
		scalingGroupId: z.string().optional(),
	})

export type CreateWorkoutSchema = z.output<typeof createWorkoutSchema>
export type CreateWorkoutInput = z.input<typeof createWorkoutSchema>
