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
  score: crossFitScoreSchema,
})

export const crossFitConversionSchema = z.union([
  z.object({
    kind: z.literal("rest"),
  }),
  z.object({
    kind: z.literal("workout"),
    structure: z.literal("single"),
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
    return [{ label: null, score: conversion.score }]
  return conversion.subEvents
}

const scoreNouns = {
  time: "times?",
  "time-with-cap": "times?",
  "rounds-reps": "rounds?(?: and reps)?",
  reps: "(?:reps?|rep counts?)",
  load: "(?:loads?|weights?|lifts?)",
  calories: "calories?",
  meters: "(?:meters?|metres?|distances?)",
}

export function requestedScoreSchemes(prescription: string) {
  const requests = new Set<string>()
  for (const [scheme, noun] of Object.entries(scoreNouns)) {
    if (scheme === "time-with-cap") continue
    if (
      new RegExp(
        `(?:post|record|log)\\s+(?:(?:your|the|all|best|top|heaviest|total|sum|average|mean|combined|separate|of|\\d+)\\s+)*${noun}\\b`,
        "i",
      ).test(prescription)
    )
      requests.add(scheme)
  }
  for (const instruction of prescription.matchAll(
    /(?:post|record|log)\b[^.\n]*/gi,
  ))
    for (const [scheme, noun] of Object.entries(scoreNouns))
      if (
        scheme !== "time-with-cap" &&
        !(
          scheme === "reps" &&
          /\brounds?(?: and reps?)?\b/i.test(instruction[0])
        ) &&
        new RegExp(`\\b${noun}\\b`, "i").test(instruction[0])
      )
        requests.add(scheme)
  if (/for (?:load and time|time(?: and load)?)/i.test(prescription))
    requests.add("time")
  if (/for (?:load and time|time and load)/i.test(prescription))
    requests.add("load")
  if (!requests.has("reps") && /as many rounds|\bamrap\b/i.test(prescription))
    requests.add("rounds-reps")
  return requests
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
  const prescription = crossFitPrescription(source.markdown)
  const loadSets = prescription.match(
    /^[^\n\d]+(\d+(?:-\d+)+) reps\s*(?:\n|$)/i,
  )
  if (
    loadSets &&
    /Post loads to comments\.?/i.test(prescription) &&
    [...requestedScoreSchemes(prescription)].every(
      (scheme) => scheme === "load",
    ) &&
    !/for time|metcon|as many|\bamrap\b|\bthen\b|post (?:your )?(?:time|reps|rounds|calories|meters)/i.test(
      prescription,
    )
  ) {
    return {
      kind: "workout",
      structure: "single",
      score: {
        scheme: "load",
        scoreType: "max",
        evidence: loadSets[0].trim(),
        timeCap: null,
        roundsToScore: loadSets[1].split("-").length,
      },
    }
  }
  const repInstruction = prescription.match(
    /Post (?:your )?reps to (?:the )?comments\.?/i,
  )
  if (
    repInstruction &&
    /Your score is the number of [^.\n]+ completed/i.test(prescription) &&
    !/for time|\b(?:each|every|interval|rounds|loads?)\b/i.test(prescription)
  ) {
    return {
      kind: "workout",
      structure: "single",
      score: {
        scheme: "reps",
        scoreType: "max",
        evidence: repInstruction[0],
        timeCap: null,
        roundsToScore: 1,
      },
    }
  }
  // Only classify the narrow, single-score format. Composite days go through validation of AI output.
  if (
    /for time/i.test(prescription) &&
    /Post (?:your )?time to comments\.?/i.test(prescription) &&
    !/\b(?:then|cap|each|every|rest|interval|load|heaviest)\b/i.test(
      prescription,
    )
  ) {
    return {
      kind: "workout",
      structure: "single",
      score: {
        scheme: "time",
        scoreType: "min",
        evidence: "for time",
        timeCap: null,
        roundsToScore: 1,
      },
    }
  }
  return null
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
  if (result.structure === "multi-part") {
    const labels = result.subEvents.map((event) => event.label.toLowerCase())
    if (new Set(labels).size !== labels.length)
      throw new Error("Multi-part sub-event labels must be unique")
  }
  const prescription = crossFitPrescription(source.markdown)
  const lower = prescription.toLowerCase()
  const loadSets = prescription.match(
    /^[^\n\d]+(\d+(?:-\d+)+) reps\s*(?:\n|$)/i,
  )
  if (loadSets && /Post loads to comments\.?/i.test(prescription)) {
    const loads = scores.filter((component) => component.scheme === "load")
    if (
      loads.length !== 1 ||
      loads[0].roundsToScore !== loadSets[1].split("-").length
    )
      throw new Error(
        "Load prescription requires one score for each prescribed set",
      )
    const requested = requestedScoreSchemes(prescription)
    const actual = new Set<string>(
      scores.map((component) =>
        component.scheme === "time-with-cap" ? "time" : component.scheme,
      ),
    )
    for (const scheme of requested)
      if (!actual.has(scheme))
        throw new Error("Source requires both load and metcon scores")
    for (const scheme of actual)
      if (!requested.has(scheme))
        throw new Error(
          "Additional components require an explicit source scoring instruction",
        )
  }
  for (const component of scores) {
    if (!lower.includes(component.evidence.toLowerCase()))
      throw new Error("Scoring evidence is not in the source prescription")
    const evidencePatterns = {
      time: /for (?:load and time|time(?: and load)?)|(?:post|record|log)\b[^.\n]{0,120}\btime/i,
      "time-with-cap": /cap/i,
      "rounds-reps": /as many rounds|amrap|rounds and reps/i,
      reps: /as many reps|total reps|post (?:your )?reps|score is the number of (?![^.\n]*(?:rounds|meters|metres|calories))[^.\n]+ completed/i,
      load: /load|heavy|heaviest|challenging|\d+(?:-\d+)+\s*reps/i,
      calories: /calories/i,
      meters: /meters|metres|distance/i,
    }
    if (!evidencePatterns[component.scheme].test(component.evidence))
      throw new Error(
        `Evidence does not support the score scheme (${component.scheme}): ${component.evidence}`,
      )
    const timed =
      component.scheme === "time" || component.scheme === "time-with-cap"
    const scoreNoun = scoreNouns[component.scheme]
    const countRequest = prescription.match(
      new RegExp(
        `(?:post|record|log) (?:(?:your|the|all|best|top) )*(\\d+) (?:(?:separate|best|top) )*${scoreNoun}\\b`,
        "i",
      ),
    )
    const expectedCount =
      component.scheme === "load" &&
      loadSets &&
      /Post loads to comments\.?/i.test(prescription)
        ? loadSets[1].split("-").length
        : countRequest
          ? Number(countRequest[1])
          : 1
    if (component.roundsToScore !== expectedCount)
      throw new Error("Score count must match an explicit source request")
    if (!timed && component.scoreType === "min")
      throw new Error("Non-timed components must maximize their score")
    if (component.scoreType === "sum" || component.scoreType === "average") {
      const aggregation =
        component.scoreType === "sum"
          ? "(?:sum|total|combined)"
          : "(?:average|mean)"
      const instruction = new RegExp(
        `(?:post|record|log|score (?:is|as)) (?:your |the )?${aggregation} (?:of (?:your |the )?)?${scoreNoun}\\b`,
        "i",
      )
      if (!instruction.test(prescription))
        throw new Error(
          "Score aggregation must be explicitly requested by the source",
        )
    }
    if (
      (component.scheme === "time" || component.scheme === "time-with-cap") &&
      component.scoreType !== "min"
    )
      throw new Error("Timed components must minimize time")
    if (component.scheme === "time-with-cap") {
      const cap = prescription.match(
        /(?:time\s*)?cap\s*:?\s*(\d+)\s*(minutes?|seconds?)/i,
      )
      if (
        !cap ||
        Number(cap[1]) *
          (cap[2].toLowerCase().startsWith("minute") ? 60 : 1) !==
          component.timeCap
      )
        throw new Error("Time cap must be explicitly prescribed")
    } else if (component.timeCap !== null)
      throw new Error("Only capped workouts may have a time cap")
  }
  const required = requestedScoreSchemes(prescription)
  const actual = new Set<string>(
    scores.map((component) =>
      component.scheme === "time-with-cap" ? "time" : component.scheme,
    ),
  )
  for (const scheme of required) {
    if (actual.has(scheme)) continue
    if (required.has("time") && required.has("load"))
      throw new Error("Source requires both time and load scores")
    throw new Error(`Source requires a ${scheme} score`)
  }
  return result
}
