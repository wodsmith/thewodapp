import { z } from "zod"
import {
  SCORE_TYPE_VALUES,
  TIEBREAK_SCHEME_VALUES,
  WORKOUT_SCHEME_VALUES,
} from "@/db/schemas/workouts"

export const WORKOUT_IMPORT_SCHEMA_VERSION = 1 as const
export const WORKOUT_IMPORT_MAX_TEXT = 20_000
export const WORKOUT_IMPORT_MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const WORKOUT_IMPORT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
const id = z.string().min(1).max(255)
const positiveInt = z.number().int().positive().max(2_147_483_647)

export const workoutImportDestinationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("personal") }).strict(),
  z.object({ kind: z.literal("track"), trackId: id }).strict(),
])
export type WorkoutImportDestination = z.infer<typeof workoutImportDestinationSchema>

/** Browser/model data has no ownership, visibility, or persistence IDs. */
export const workoutImportWorkoutSchema = z.object({
  name: z.string().max(255).nullable(),
  description: z.string().max(WORKOUT_IMPORT_MAX_TEXT).nullable(),
  scheme: z.enum(WORKOUT_SCHEME_VALUES).nullable(),
  scoreType: z.enum(SCORE_TYPE_VALUES).nullable(),
  timeCapSeconds: positiveInt.nullable(),
  roundsToScore: positiveInt.max(1000).nullable(),
  repsPerRound: positiveInt.nullable(),
  tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable(),
  scalingGroupId: id.nullable(),
  movementIds: z.array(id).max(100),
}).strict()
export type WorkoutImportWorkout = z.infer<typeof workoutImportWorkoutSchema>

export const workoutImportQuestionSchema = z.object({
  id,
  field: z.enum(["name", "description", "scheme", "scoreType", "timeCapSeconds", "roundsToScore", "repsPerRound", "tiebreakScheme", "scalingGroupId", "movementIds", "prescription", "selectedPart"]),
  reason: z.string().min(1).max(2000),
  sourceExcerpt: z.string().max(2000),
  choices: z.array(z.string().min(1).max(500)).max(20),
}).strict()
export type WorkoutImportQuestion = z.infer<typeof workoutImportQuestionSchema>
export const workoutImportProposalSchema = z.object({
  workout: workoutImportWorkoutSchema,
  extractedText: z.string().max(WORKOUT_IMPORT_MAX_TEXT),
  unresolved: z.array(workoutImportQuestionSchema).max(50),
  warnings: z.array(z.object({ message: z.string().min(1).max(2000), sourceExcerpt: z.string().max(2000) }).strict()).max(50),
}).strict()
export type WorkoutImportProposal = z.infer<typeof workoutImportProposalSchema>

export const workoutImportSourceSchema = z.object({
  text: z.string().max(WORKOUT_IMPORT_MAX_TEXT).default(""),
  imageId: id.optional(),
}).strict().refine(v => v.text.trim().length > 0 || !!v.imageId, "Paste text or upload an image")
export type WorkoutImportSource = z.infer<typeof workoutImportSourceSchema>
export const workoutImportInputSchema = z.object({
  importId: id,
  requestId: id,
  expectedRevision: z.number().int().min(0),
  source: workoutImportSourceSchema,
}).strict()
export type WorkoutImportInput = z.infer<typeof workoutImportInputSchema>
export const workoutImportRevisionInputSchema = z.object({
  importId: id,
  requestId: id,
  expectedRevision: z.number().int().min(1),
  workout: workoutImportWorkoutSchema,
  instruction: z.string().trim().min(1).max(4000),
}).strict()
export type WorkoutImportRevisionInput = z.infer<typeof workoutImportRevisionInputSchema>
export const workoutImportDraftSchema = workoutImportProposalSchema.extend({
  schemaVersion: z.literal(WORKOUT_IMPORT_SCHEMA_VERSION),
  importId: id,
  revision: z.number().int().min(1),
  requestId: id,
  status: z.enum(["ready", "needs_input"]),
  source: workoutImportSourceSchema,
  changedFields: z.array(z.keyof(workoutImportWorkoutSchema)),
})
export type WorkoutImportDraft = z.infer<typeof workoutImportDraftSchema>

/** Normalized persistence data: timeCap remains WORKOUT SECONDS. */
export const normalizedWorkoutSaveSchema = workoutImportWorkoutSchema.extend({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(WORKOUT_IMPORT_MAX_TEXT),
  scheme: z.enum(WORKOUT_SCHEME_VALUES),
  roundsToScore: positiveInt.max(1000),
  scope: z.enum(["private", "public"]).default("private"),
}).superRefine((v, ctx) => {
  if (v.scheme === "time-with-cap" && v.timeCapSeconds === null)
    ctx.addIssue({code: "custom", path: ["timeCapSeconds"], message: "Capped time requires a cap in seconds"})
  if (v.scheme !== "time-with-cap" && v.timeCapSeconds !== null)
    ctx.addIssue({code: "custom", path: ["timeCapSeconds"], message: "Duration belongs in the prescription; only capped time has a time cap"})
  if (v.roundsToScore > 1 && v.scoreType === null)
    ctx.addIssue({code: "custom", path: ["scoreType"], message: "Choose how separately recorded scores are combined"})
  if (new Set(v.movementIds).size !== v.movementIds.length)
    ctx.addIssue({code: "custom", path: ["movementIds"], message: "Movement IDs must be unique"})
})
export type NormalizedWorkoutSave = z.infer<typeof normalizedWorkoutSaveSchema>
export const workoutImportSaveInputSchema = z.object({
  importId: id,
  revision: z.number().int().min(1),
  idempotencyKey: id,
  workout: normalizedWorkoutSaveSchema,
  resolutions: z.array(z.object({questionId: id, answer: z.string().trim().min(1).max(2000)}).strict()).max(50).default([]),
  track: z.object({ trackOrder: z.number().min(0).max(9999.99), notes: z.string().max(10000).optional() }).strict().optional(),
}).strict()
export type WorkoutImportSaveInput = z.infer<typeof workoutImportSaveInputSchema>
export interface WorkoutImportSaveResult { workoutId: string; trackWorkoutId: string | null; importId: string; revision: number }
export interface WorkoutImportAccess { userId: string; teamId: string; destination: WorkoutImportDestination }

export function workoutSecondsToScoreMilliseconds(seconds: number): number {
  return positiveInt.parse(seconds) * 1000
}
