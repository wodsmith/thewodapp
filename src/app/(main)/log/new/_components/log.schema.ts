import { z } from "zod";

export const logFormSchema = z.object({
  selectedWorkoutId: z.string().min(1, "Please select a workout"),
  date: z.string().min(1, "Date is required"),
  scale: z.enum(["rx", "scaled", "rx+"], {
    required_error: "Please select a scale",
  }),
  scores: z.array(z.array(z.string())).optional(),
  notes: z.string().optional(),
  redirectUrl: z.string().optional(),
});

export type LogFormSchema = z.infer<typeof logFormSchema>;
