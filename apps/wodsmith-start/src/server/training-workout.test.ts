import { expect, it } from "vitest"
import { libraryWorkoutToBlock } from "@/lib/training/library-block"
import { compareTrainingResults } from "@/lib/training/score-order"
import type {
  TrainingResult,
  TrainingWorkoutScoreInput,
} from "@/lib/training/types"
import { normalizeTrainingWorkoutResult } from "@/lib/training/workout-scoring"
import {
  type NormalizedWorkoutSave,
  normalizedWorkoutSaveSchema,
} from "@/lib/workout-import/schemas"
import { trainingBlockSchema } from "./training-validation"

const definition: NormalizedWorkoutSave = {
  name: "Intervals",
  description: "Prescribed work",
  scheme: "reps",
  scoreType: "max",
  roundsToScore: 1,
  timeCapSeconds: null,
  repsPerRound: null,
  tiebreakScheme: null,
  scalingGroupId: null,
  movementIds: [],
  scope: "private",
}
const input: TrainingWorkoutScoreInput = { score: "10", unit: "lb" }
const workout = (patch: Partial<NormalizedWorkoutSave>) =>
  normalizedWorkoutSaveSchema.parse({ ...definition, ...patch })

// @lat: [[training#Rich Workout Results#Every scoring scheme retains its meaning]]
it.each([
  ["time", "12:34.567", 754567],
  ["time-with-cap", "9:00", 540000],
  ["rounds-reps", "5+12", 500012],
  ["reps", "30", 30],
  ["calories", "100", 100],
  ["points", "42", 42],
  ["load", "100", 45359],
  ["meters", "250", 250000],
  ["feet", "6", 1829],
  ["pass-fail", "pass", 1],
  ["emom", "12:00", 720000],
] as const)("preserves %s scoring", (scheme, score, value) => {
  const result = normalizeTrainingWorkoutResult(
    workout({
      scheme,
      timeCapSeconds: scheme === "time-with-cap" ? 600 : null,
    }),
    { ...input, score },
  )
  expect(result.scoreValue).toBe(value)
  expect(result.details.input.score).toBe(score)
})

// @lat: [[training#Rich Workout Results#Aggregation and input units round trip]]
it("preserves each aggregation and entered weight and distance units", () => {
  for (const [scoreType, value] of [
    ["min", 10],
    ["max", 20],
    ["sum", 30],
    ["average", 15],
    ["first", 10],
    ["last", 20],
  ] as const) {
    const result = normalizeTrainingWorkoutResult(
      workout({ roundsToScore: 2, scoreType }),
      { ...input, score: "", roundScores: [{ score: "10" }, { score: "20" }] },
    )
    expect(result.scoreValue).toBe(value)
    expect(result.details.rounds.map((round) => round.value)).toEqual([10, 20])
  }
  const load = normalizeTrainingWorkoutResult(workout({ scheme: "load" }), {
    ...input,
    score: "100",
    unit: "kg",
  })
  expect(load).toMatchObject({
    scoreValue: 100000,
    displayScore: "100 kg",
    details: { unit: "kg", input: { score: "100", unit: "kg" } },
  })
  const distance = normalizeTrainingWorkoutResult(
    workout({ scheme: "meters" }),
    { ...input, score: "2.5", distanceUnit: "km" },
  )
  expect(distance).toMatchObject({
    scoreValue: 2500000,
    details: { unit: "km", input: { distanceUnit: "km" } },
  })
})

// @lat: [[training#Rich Workout Results#Explicit caps and tiebreaks survive editing]]
it("preserves round cap facts and tiebreak values through a result edit", () => {
  const capped = workout({
    scheme: "time-with-cap",
    timeCapSeconds: 180,
    roundsToScore: 2,
    scoreType: "sum",
    tiebreakScheme: "reps",
  })
  const claim = {
    ...input,
    score: "",
    roundScores: [
      { score: "", status: "cap" as const, secondaryScore: "35" },
      { score: "2:00", status: "scored" as const },
    ],
    tiebreakScore: "7",
  }
  const result = normalizeTrainingWorkoutResult(capped, claim)
  expect(result.details).toMatchObject({
    status: "cap",
    secondaryValue: 35,
    timeCapMs: 180000,
    tiebreakValue: 7,
    rounds: [
      { value: 180000, status: "cap", secondaryValue: 35 },
      { value: 120000, status: "scored", secondaryValue: null },
    ],
  })
  expect(normalizeTrainingWorkoutResult(capped, result.details.input)).toEqual(
    result,
  )
  const uncapped = normalizeTrainingWorkoutResult(capped, {
    ...claim,
    roundScores: [{ score: "2:00" }, { score: "2:05" }],
    tiebreakScore: "",
  })
  expect(uncapped.details).toMatchObject({
    status: "scored",
    secondaryValue: null,
    tiebreakValue: null,
  })
  expect(
    uncapped.details.rounds.every((round) => round.secondaryValue === null),
  ).toBe(true)
  expect(() =>
    normalizeTrainingWorkoutResult(capped, {
      ...claim,
      roundScores: [{ score: "3:01" }, { score: "2:00" }],
    }),
  ).toThrow("exceeds the cap")
})

// @lat: [[training#Rich Workout Results#Team ranking uses the complete score]]
it("ranks finishers, capped results and tiebreaks using complete score facts", () => {
  const capped = workout({
    scheme: "time-with-cap",
    timeCapSeconds: 180,
    tiebreakScheme: "reps",
    scoreType: "min",
  })
  const toResult = (claim: TrainingWorkoutScoreInput) =>
    ({
      ...normalizeTrainingWorkoutResult(capped, claim),
      block: { kind: "workout", workout: capped },
    }) as TrainingResult
  const finished = toResult({ ...input, score: "3:00", tiebreakScore: "1" })
  const cap30 = toResult({
    ...input,
    score: "",
    status: "cap",
    secondaryScore: "30",
    tiebreakScore: "5",
  })
  const cap40 = toResult({
    ...input,
    score: "",
    status: "cap",
    secondaryScore: "40",
    tiebreakScore: "5",
  })
  expect([cap30, cap40, finished].sort(compareTrainingResults)).toEqual([
    finished,
    cap40,
    cap30,
  ])
  const fasterTiebreak = toResult({
    ...input,
    score: "3:00",
    tiebreakScore: "2",
  })
  expect(compareTrainingResults(fasterTiebreak, finished)).toBeLessThan(0)
})

// @lat: [[training#Rich Workout Results#Workout definitions use canonical validation]]
it("retains full canonical definitions and rejects inconsistent or incomplete blocks", () => {
  const full = workout({
    name: "n".repeat(255),
    description: "d".repeat(20000),
    scheme: "rounds-reps",
    roundsToScore: 3,
    scoreType: "sum",
    repsPerRound: 15,
    tiebreakScheme: "time",
    movementIds: ["movement_one"],
  })
  const block = {
    id: "rich",
    kind: "workout" as const,
    title: full.name,
    prescription: full.description,
    workout: full,
    coachGuidance: "Coach",
    scalingGuidance: "Scale",
  }
  expect(trainingBlockSchema.parse(block)).toEqual(block)
  expect(
    trainingBlockSchema.safeParse({ ...block, workout: undefined }).success,
  ).toBe(false)
  expect(
    trainingBlockSchema.safeParse({ ...block, title: "Different" }).success,
  ).toBe(false)
  expect(
    trainingBlockSchema.safeParse({
      ...block,
      kind: "reps",
      workout: undefined,
    }).success,
  ).toBe(false)
  expect(
    libraryWorkoutToBlock({ ...full, timeCap: full.timeCapSeconds }, "imported")
      .workout,
  ).toEqual(full)
})

// @lat: [[training#Rich Workout Results#Malformed scores never become partial numbers]]
it("rejects partial numeric input and incompatible cap and tiebreak claims", () => {
  for (const [scheme, score] of [
    ["reps", "30abc"],
    ["rounds-reps", "5+12abc"],
    ["load", "100kg"],
    ["meters", "5m"],
  ] as const)
    expect(() =>
      normalizeTrainingWorkoutResult(workout({ scheme }), { ...input, score }),
    ).toThrow()
  expect(() =>
    normalizeTrainingWorkoutResult(workout({}), {
      ...input,
      status: "cap",
      secondaryScore: "10",
    }),
  ).toThrow("does not support")
  expect(() =>
    normalizeTrainingWorkoutResult(workout({}), {
      ...input,
      secondaryScore: "10",
    }),
  ).toThrow("require capped")
  expect(() =>
    normalizeTrainingWorkoutResult(workout({}), {
      ...input,
      tiebreakScore: "10",
    }),
  ).toThrow("no tiebreak")
  expect(() =>
    normalizeTrainingWorkoutResult(workout({ roundsToScore: 2 }), input),
  ).toThrow("all 2")
})

// @lat: [[training#Rich Workout Results#Missing tiebreaks never win ties]]
it("ranks missing time and reps tiebreaks behind supplied values", () => {
  for (const tiebreakScheme of ["time", "reps"] as const) {
    const definition = workout({ scheme: "reps", tiebreakScheme })
    const result = (tiebreakScore?: string) =>
      ({
        ...normalizeTrainingWorkoutResult(definition, {
          ...input,
          tiebreakScore,
        }),
        block: { kind: "workout", workout: definition },
      }) as TrainingResult
    const missing = result()
    const supplied = result(tiebreakScheme === "time" ? "1:00" : "10")
    expect(compareTrainingResults(missing, supplied)).toBeGreaterThan(0)
    expect(compareTrainingResults(supplied, missing)).toBeLessThan(0)
  }
})

// @lat: [[training#Rich Workout Results#Large capped totals retain order]]
it("compares full capped totals beyond the encoded sort key segment", () => {
  const definition = workout({
    scheme: "time-with-cap",
    timeCapSeconds: 86400,
    scoreType: "sum",
    roundsToScore: 1000,
  })
  const result = (score: string) =>
    ({
      ...normalizeTrainingWorkoutResult(definition, {
        ...input,
        score: "",
        roundScores: Array.from({ length: 1000 }, (_, index) =>
          index === 0
            ? { score: "", status: "cap" as const, secondaryScore: "10" }
            : { score },
        ),
      }),
      block: { kind: "workout", workout: definition },
    }) as TrainingResult
  const faster = result("1:11:40")
  const slower = result("2:22:30")
  expect(faster.scoreValue).toBeGreaterThan(4294967295)
  expect(compareTrainingResults(faster, slower)).toBeLessThan(0)
})
