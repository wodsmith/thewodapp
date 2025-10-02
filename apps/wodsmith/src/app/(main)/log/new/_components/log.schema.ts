import { z } from "zod"

export const logFormSchema = z.object({
	selectedWorkoutId: z.string().min(1, "Please select a workout"),
	date: z.string().min(1, "Date is required"),
	// Legacy scale field for backward compatibility
	scale: z
		.enum(["rx", "scaled", "rx+"], {
			required_error: "Please select a scale",
		})
		.optional(),
	// New scaling fields
	scalingLevelId: z.string().optional(),
	asRx: z.boolean().optional(),
	scores: z.array(z.array(z.string())).optional(),
	timeCapped: z.array(z.boolean()).optional(),
	notes: z.string().optional(),
	redirectUrl: z.string().optional(),
})

export type LogFormSchema = z.infer<typeof logFormSchema>
