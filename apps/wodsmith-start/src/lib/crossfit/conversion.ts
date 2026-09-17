import { z } from "zod"
import type { CrossFitSource } from "./source"

export const crossFitScoreSchema = z.object({
  scheme: z.enum([
    "time",
    "time-with-cap",
    "rounds-reps",
    "reps",
    "load",
    "calories",
    "meters",
  ]),
  scoreType: z.enum(["min", "max", "sum", "average"]),
  evidence: z.string().min(3).max(2000),
  timeCap: z.number().int().positive().max(86400).nullable(),
  roundsToScore: z.number().int().min(1).max(100),
})

const scoredEventSchema = z.object({
  label: z.string().trim().min(1).max(120),
  movementIds: z.array(z.string().min(1).max(255)).max(100).default([]),
  score: crossFitScoreSchema,
})

export const crossFitConversionSchema = z.union([
  z.object({
    kind: z.literal("rest"),
  }),
  z.object({
    kind: z.literal("workout"),
    structure: z.literal("single"),
    movementIds: z.array(z.string().min(1).max(255)).max(100).default([]),
    score: crossFitScoreSchema,
  }),
  z.object({
    kind: z.literal("workout"),
    structure: z.literal("multi-part"),
    subEvents: z.array(scoredEventSchema).min(2).max(6),
  }),
])
export type CrossFitConversion = z.infer<typeof crossFitConversionSchema>
export type CrossFitScore = z.infer<typeof crossFitScoreSchema>

export function crossFitScoredEvents(conversion: CrossFitConversion) {
  if (conversion.kind === "rest") return []
  if (conversion.structure === "single")
    return [
      {
        label: null,
        movementIds: conversion.movementIds,
        score: conversion.score,
      },
    ]
  return conversion.subEvents
}

export function crossFitPrescription(markdown: string) {
  return markdown
    .split(
      /\n\s*\*\*(?:Stimulus and Strategy|Scaling|Intermediate option|Beginner option|Resources)\s*:?\*\*/i,
    )[0]
    .trim()
}

export function isCrossFitRestDay(markdown: string) {
  return /^(?:\*\*)?Rest Day(?:\*\*)?\s*(?:\n|$)/i.test(markdown)
}

export function deterministicCrossFitConversion(
  source: CrossFitSource,
): CrossFitConversion | null {
  if (isCrossFitRestDay(source.markdown)) return { kind: "rest" }
  return null
}

export function crossFitDurationCandidates(prescription: string) {
  const candidates: Array<{
    evidence: string
    index: number
    seconds: number
  }> = []
  for (const match of prescription.matchAll(
    /\b(?:time\s+cap\s*:?\s*)?(\d+)\s*-?\s*(minutes?|seconds?)\b/gi,
  )) {
    const seconds =
      Number(match[1]) * (match[2].toLowerCase().startsWith("minute") ? 60 : 1)
    candidates.push({
      evidence: match[0],
      index: match.index ?? 0,
      seconds,
    })
  }
  for (const match of prescription.matchAll(
    /\b(\d+):(\d{2})\s*[-–]\s*(\d+):(\d{2})\b/g,
  )) {
    const start = Number(match[1]) * 60 + Number(match[2])
    const end = Number(match[3]) * 60 + Number(match[4])
    if (end > start)
      candidates.push({
        evidence: match[0],
        index: match.index ?? 0,
        seconds: end - start,
      })
  }
  return candidates
}

// @lat: [[crossfit-import#CrossFit Daily Import#Scoring Conversion]]
export function validateCrossFitConversion(
  value: unknown,
  source: CrossFitSource,
): CrossFitConversion {
  const result = crossFitConversionSchema.parse(value)
  const rest = isCrossFitRestDay(source.markdown)
  if (rest !== (result.kind === "rest"))
    throw new Error(
      "Rest classification must match the explicit source heading",
    )
  if (result.kind === "rest") return result
  const scores = crossFitScoredEvents(result).map((event) => event.score)
  for (const event of crossFitScoredEvents(result))
    if (new Set(event.movementIds).size !== event.movementIds.length)
      throw new Error("Workout movement IDs must be unique")
  if (result.structure === "multi-part") {
    const labels = result.subEvents.map((event) => event.label.toLowerCase())
    if (new Set(labels).size !== labels.length)
      throw new Error("Multi-part sub-event labels must be unique")
  }
  const prescription = crossFitPrescription(source.markdown)
  const durationCandidates = crossFitDurationCandidates(prescription)
  const explicitlyNotForTime =
    /\b(?:not|never)(?:\s+\w+){0,4}\s+for\s+time\b/i.test(prescription)
  if (
    /\bfor\s+time\b/i.test(prescription) &&
    !explicitlyNotForTime &&
    !scores.some(
      (score) => score.scheme === "time" || score.scheme === "time-with-cap",
    )
  )
    throw new Error("An explicit for-time prescription requires a time score")
  for (const component of scores) {
    if (!prescription.includes(component.evidence))
      throw new Error("Scoring evidence is not in the source prescription")
    const timed =
      component.scheme === "time" || component.scheme === "time-with-cap"
    if (!timed && component.scoreType === "min")
      throw new Error("Non-timed components must maximize their score")
    if (
      (component.scheme === "time" || component.scheme === "time-with-cap") &&
      component.scoreType !== "min"
    )
      throw new Error("Timed components must minimize time")
    if (component.scheme === "time-with-cap") {
      if (
        component.timeCap === null ||
        !durationCandidates.some(
          (candidate) => candidate.seconds === component.timeCap,
        )
      )
        throw new Error("Time cap must use a duration from the source")
    } else if (component.timeCap !== null)
      throw new Error("Only capped workouts may have a time cap")
  }
  return result
}
