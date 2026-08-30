import { describe, expect, it } from "vitest"
import { normalizeCompetitionWorkoutResult } from "@/server/workout-results"
import {
  InvalidJudgeRoundScoreError,
  type JudgeWorkoutResultInput,
  normalizeJudgeWorkoutResult,
} from "@/server/workout-results/judge"

function judgeInput(): JudgeWorkoutResultInput {
  return {
    score: "",
    scoreStatus: "scored" as const,
    roundScores: [
      { score: "1+1", parts: ["2", "3"] },
      { score: "3+4", parts: ["4", "5"] },
    ],
    workout: {
      scheme: "rounds-reps",
      scoreType: "max",
      repsPerRound: null,
      roundsToScore: 2,
      timeCap: null,
      tiebreakScheme: null,
    },
  }
}

describe("judge workout-result normalization", () => {
  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Judge rounds-reps parts consistency]]
  it("uses rounds-reps parts consistently for the aggregate and round rows", () => {
    const result = normalizeJudgeWorkoutResult(judgeInput())

    expect(result).toMatchObject({
      scoreValue: 400_005,
      rounds: [
        { roundNumber: 1, value: 200_003 },
        { roundNumber: 2, value: 400_005 },
      ],
    })
  })

  it("retains the judge-specific invalid-round error contract", () => {
    const input = judgeInput()
    input.roundScores = [{ score: "1+1" }, { score: "not-a-score" }]

    expect(() => normalizeJudgeWorkoutResult(input)).toThrow(
      InvalidJudgeRoundScoreError,
    )
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Judge shared competition normalization]]
  it("delegates valid scoring semantics to the shared competition normalizer", () => {
    const input = judgeInput()

    expect(normalizeJudgeWorkoutResult(input)).toEqual(
      normalizeCompetitionWorkoutResult(input),
    )
  })
})
