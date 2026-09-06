import { z } from "zod"
import type { CrossFitSource } from "./source"

const componentSchema = z.object({
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

export const crossFitConversionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rest"),
    components: z.array(componentSchema).length(0),
  }),
  z.object({
    kind: z.literal("workout"),
    components: z.array(componentSchema).min(1).max(6),
  }),
])
export type CrossFitConversion = z.infer<typeof crossFitConversionSchema>

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
  if (isCrossFitRestDay(source.markdown))
    return { kind: "rest", components: [] }
  const prescription = crossFitPrescription(source.markdown)
  const loadSets = prescription.match(
    /^[^\n\d]+(\d+(?:-\d+)+) reps\s*(?:\n|$)/i,
  )
  if (loadSets && /Post loads to comments\.?/i.test(prescription)) {
    return {
      kind: "workout",
      components: [
        {
          scheme: "load",
          scoreType: "max",
          evidence: loadSets[0].trim(),
          timeCap: null,
          roundsToScore: loadSets[1].split("-").length,
        },
      ],
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
      components: [
        {
          scheme: "reps",
          scoreType: "max",
          evidence: repInstruction[0],
          timeCap: null,
          roundsToScore: 1,
        },
      ],
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
      components: [
        {
          scheme: "time",
          scoreType: "min",
          evidence: "for time",
          timeCap: null,
          roundsToScore: 1,
        },
      ],
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
  const prescription = crossFitPrescription(source.markdown)
  const lower = prescription.toLowerCase()
  const loadSets = prescription.match(
    /^[^\n\d]+(\d+(?:-\d+)+) reps\s*(?:\n|$)/i,
  )
  if (loadSets && /Post loads to comments\.?/i.test(prescription)) {
    if (
      result.components.length !== 1 ||
      result.components[0].scheme !== "load" ||
      result.components[0].roundsToScore !== loadSets[1].split("-").length
    )
      throw new Error(
        "Load prescription requires one score for each prescribed set",
      )
  }
  for (const component of result.components) {
    if (!lower.includes(component.evidence.toLowerCase()))
      throw new Error("Scoring evidence is not in the source prescription")
    const evidencePatterns = {
      time: /for time|post (?:your )?time/i,
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
        Number(cap[1]) * (cap[2].startsWith("minute") ? 60 : 1) !==
          component.timeCap
      )
        throw new Error("Time cap must be explicitly prescribed")
    } else if (component.timeCap !== null)
      throw new Error("Only capped workouts may have a time cap")
  }
  // A common mainsite composite: preserve both scores, and never turn its transition time into a cap.
  if (
    /post time and load/i.test(prescription) &&
    (!result.components.some((c) => c.scheme === "time") ||
      !result.components.some((c) => c.scheme === "load"))
  ) {
    throw new Error("Source requires both time and load scores")
  }
  return result
}
