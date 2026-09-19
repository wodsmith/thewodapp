import { z } from "zod"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"

export interface InferredCompetitionEventGroup {
  kind: "multi-part"
  name: string
  description: string
  subEvents: NormalizedWorkoutSave[]
}

export type InferredCompetitionEvent =
  | NormalizedWorkoutSave
  | InferredCompetitionEventGroup

export const workoutAuthoringContextSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("library"), teamId: z.string().min(1) }),
  z.object({ kind: z.literal("programming"), teamId: z.string().min(1) }),
  z.object({ kind: z.literal("personal"), teamId: z.string().min(1) }),
  z.object({
    kind: z.literal("competition"),
    competitionId: z.string().min(1),
  }),
  z.object({ kind: z.literal("series"), groupId: z.string().min(1) }),
])
export type WorkoutAuthoringContext = z.infer<
  typeof workoutAuthoringContextSchema
>

export const workoutScalingDescriptionsSchema = z
  .array(
    z.object({
      scalingLevelId: z.string().min(1).max(255),
      description: z.string().trim().min(1).max(5000),
    }),
  )
  .max(40)
  .refine(
    (items) =>
      new Set(items.map((item) => item.scalingLevelId)).size === items.length,
    "Each scaling level can have only one prescription",
  )

export const describeWorkoutInputSchema = z.object({
  context: workoutAuthoringContextSchema,
  description: z
    .string()
    .trim()
    .min(1, "Describe your workout first")
    .max(5000),
})
