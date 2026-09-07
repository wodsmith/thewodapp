import { z } from "zod"
import {
  trainingBlockSchema,
  trainingDateSchema,
  trainingRichScoreFields,
} from "./training-validation"

const id = z.string().min(1).max(255)
const itemId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/)
export const trainingSourceSchema = z.object({
  sourceSessionId: itemId,
  sourceBlockId: itemId,
  sourcePublishedVersion: z.number().int().positive(),
})
const personalBlock = trainingBlockSchema.refine(
  (block) =>
    block.title.trim().length > 0 && block.prescription.trim().length > 0,
  "Give the workout a title and prescription",
)
export const personalTrainingItemSchema = z.discriminatedUnion("kind", [
  trainingSourceSchema.extend({ id: itemId, kind: z.literal("source") }),
  z.object({
    id: itemId,
    kind: z.literal("personal"),
    block: personalBlock,
    remixedFrom: trainingSourceSchema.optional(),
  }),
  z.object({ id: itemId, kind: z.literal("library"), workoutId: id }),
])
export const personalTrainingDaySchema = z.object({
  teamId: id,
  trainingDate: trainingDateSchema,
  trackId: id.optional(),
})
export const trainingPreferenceSchema = z.object({
  teamId: id,
  defaultTrackId: id,
})
export const personalTrainingSaveSchema = personalTrainingDaySchema
  .omit({ trackId: true })
  .extend({
    expectedRevision: z.number().int().nonnegative(),
    items: z.array(personalTrainingItemSchema).max(40),
  })
  .refine(
    (value) =>
      new Set(value.items.map((item) => item.id.toLowerCase())).size ===
      value.items.length,
    "Each item needs a unique ID",
  )
export const personalTrainingResultSchema = z.object({
  ...trainingRichScoreFields,
  personalSessionId: itemId,
  itemId,
  expectedRevision: z.number().int().positive(),
  score: z.string().max(100),
  notes: z.string().max(4000),
  unit: z.enum(["lb", "kg"]),
  completed: z.boolean(),
})
export const trainingLibraryWorkoutSchema = z.object({
  teamId: id,
  workoutId: id,
})
export const trainingLibraryListSchema = z.object({
  teamId: id,
  search: z.string().max(160).optional(),
})
export const personalTrainingScoreLinkSchema = personalTrainingResultSchema
  .pick({ personalSessionId: true, itemId: true, expectedRevision: true })
  .extend({ scoreId: id })

export const personalLibraryResultSchema = personalTrainingScoreLinkSchema
  .omit({ scoreId: true })
  .extend({
    score: z.string().max(100),
    notes: z.string().max(4000).optional(),
    asRx: z.boolean(),
    replaceExisting: z.boolean().optional(),
    scalingLevelId: id.optional(),
    roundScores: z
      .array(z.object({ score: z.string().max(100) }))
      .max(100)
      .optional(),
  })
