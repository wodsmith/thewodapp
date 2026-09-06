import { z } from "zod"
import { parseScore } from "@/lib/scoring"
import type {
  OwnTrainingResult,
  SaveTrainingResultInput,
  TrainingBlock,
  TrainingResult,
  TrainingSession,
} from "@/lib/training/types"

const id = z.string().min(1).max(255)
const blockId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/)
export const trainingDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value >= "2000-01-01" &&
      value <= "2100-12-31"
    )
  }, "Use a valid date between 2000 and 2100")

export function isTrainingTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function trainingTimezone(settings: string | null): string {
  try {
    const timezone: unknown = JSON.parse(settings ?? "{}").timezone
    return typeof timezone === "string" && isTrainingTimezone(timezone)
      ? timezone
      : "UTC"
  } catch {
    return "UTC"
  }
}

export const trainingContentSchema = z
  .object({
    title: z.string().trim().max(160),
    coachNote: z.string().max(4000),
    isRestDay: z.boolean(),
    blocks: z
      .array(
        z.object({
          id: blockId,
          kind: z.enum(["check", "load", "time", "reps", "note"]),
          title: z.string().trim().max(160),
          prescription: z.string().max(6000),
          scalingGuidance: z.string().max(3000),
          coachGuidance: z.string().max(3000),
        }),
      )
      .max(20),
  })
  .superRefine((content, ctx) => {
    if (
      new Set(content.blocks.map((b) => b.id.toLowerCase())).size !==
      content.blocks.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Each block needs a unique ID",
        path: ["blocks"],
      })
    if (content.isRestDay && content.blocks.length)
      ctx.addIssue({
        code: "custom",
        message: "Rest days cannot contain training blocks",
        path: ["blocks"],
      })
  })

export const trainingTrackInputSchema = z.object({ teamId: id, trackId: id })
export const trainingWeekInputSchema = trainingTrackInputSchema.extend({
  startDate: trainingDateSchema,
  mode: z.enum(["athlete", "coach"]),
})
export const trainingDraftInputSchema = trainingTrackInputSchema.extend({
  trainingDate: trainingDateSchema,
  timezone: z
    .string()
    .min(1)
    .max(100)
    .refine(isTrainingTimezone, "Choose a valid IANA timezone"),
  expectedRevision: z.number().int().nonnegative(),
  content: trainingContentSchema,
})
export const trainingPublishInputSchema = z.object({
  sessionId: blockId,
  expectedRevision: z.number().int().positive(),
})
export const trainingCopyInputSchema = trainingPublishInputSchema.extend({
  targetDate: trainingDateSchema,
  targetTrackId: id,
})
export const trainingResultInputSchema = z.object({
  sessionId: blockId,
  blockId,
  publishedVersion: z.number().int().positive(),
  score: z.string().max(100),
  scaling: z.enum(["rx", "scaled", "custom"]),
  modification: z.string().max(2000),
  notes: z.string().max(4000),
  audience: z.enum(["gym", "private"]),
  unit: z.enum(["lb", "kg"]),
  completed: z.boolean(),
})
export const trainingCheerInputSchema = z.object({
  resultId: blockId,
  cheered: z.boolean(),
})

export function assertTrainingRevision(actual: number, expected: number): void {
  if (actual !== expected)
    throw new Error("CONFLICT: This session changed. Reload before saving.")
}

export function publishedTrainingBlock(
  session: TrainingSession,
  input: Pick<
    SaveTrainingResultInput,
    "sessionId" | "blockId" | "publishedVersion"
  >,
): TrainingBlock {
  if (
    session.id !== input.sessionId ||
    !session.published ||
    session.publishedVersion !== input.publishedVersion
  )
    throw new Error(
      "CONFLICT: The published session changed. Reload before logging.",
    )
  const block = session.published.blocks.find((b) => b.id === input.blockId)
  if (!block)
    throw new Error("NOT_FOUND: Block is not part of this published session")
  return block
}

export function normalizeTrainingResult(
  block: TrainingBlock,
  input: SaveTrainingResultInput,
): {
  scoreValue: number | null
  displayScore: string
  audience: "gym" | "private"
} {
  if (block.kind === "check" || block.kind === "note")
    return {
      scoreValue: null,
      displayScore: input.completed ? "Complete" : "Not completed",
      audience: "private",
    }
  if (!input.completed)
    throw new Error("Enter a completed result before saving")
  if (block.kind === "reps" && !/^\d+$/.test(input.score.trim()))
    throw new Error("Reps must be a whole number")
  if (
    block.kind === "load" &&
    (!/^\d+(\.\d{1,3})?$/.test(input.score.trim()) || Number(input.score) <= 0)
  )
    throw new Error("Enter a positive load")
  const parsed = parseScore(input.score, block.kind, {
    unit: input.unit === "lb" ? "lbs" : "kg",
  })
  if (
    !parsed.isValid ||
    parsed.encoded == null ||
    !Number.isSafeInteger(parsed.encoded) ||
    parsed.encoded < 0 ||
    parsed.encoded > 1_000_000_000_000
  )
    throw new Error(parsed.error ?? "Enter a valid score")
  if (block.kind === "load" && parsed.encoded === 0)
    throw new Error("Enter a positive load")
  return {
    scoreValue: parsed.encoded,
    displayScore: parsed.formatted,
    audience: input.audience,
  }
}

export function publicTrainingResult(
  result: OwnTrainingResult,
): TrainingResult | null {
  if (
    result.audience !== "gym" ||
    result.block.kind === "check" ||
    result.block.kind === "note"
  )
    return null
  const { notes: _notes, ...publicResult } = result
  return publicResult
}
