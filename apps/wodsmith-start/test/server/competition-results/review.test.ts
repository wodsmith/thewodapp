import { describe, expect, it } from "vitest"
import { computeSortKeyWithDirection, sortKeyToString } from "@/lib/scoring"
import {
  normalizeInvalidatedSubmissionWorkoutResult,
  normalizeManualSubmissionWorkoutResult,
  normalizeSubmissionScoreAdjustment,
} from "@/server/competition-results/review"

describe("reviewed workout result normalization", () => {
  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Review invalidation ordering]]
  it("keeps invalidated scores at the worst position in the scored bucket", () => {
    const result = normalizeInvalidatedSubmissionWorkoutResult()

    expect(result.sortKey).toBe(
      sortKeyToString(computeSortKeyWithDirection(null, "scored", "asc")),
    )
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Review complete round replacement]]
  it("rejects a partial replacement of an existing round breakdown", () => {
    expect(() =>
      normalizeSubmissionScoreAdjustment({
        status: "scored",
        roundScores: [
          { roundNumber: 1, score: "10" },
          { roundNumber: 2, score: "20" },
        ],
        workout: {
          scheme: "reps",
          scoreType: "sum",
          timeCapMs: null,
          tiebreakScheme: null,
        },
        existingRounds: ["scored", "scored", "scored"].map((status, index) => ({
          roundNumber: index + 1,
          status,
          secondaryValue: null,
        })),
      }),
    ).toThrow("Expected exactly 3 adjusted round scores")
  })

  it("rejects a non-contiguous replacement round breakdown", () => {
    expect(() =>
      normalizeSubmissionScoreAdjustment({
        status: "scored",
        roundScores: [
          { roundNumber: 1, score: "10" },
          { roundNumber: 3, score: "20" },
        ],
        workout: {
          scheme: "reps",
          scoreType: "sum",
          timeCapMs: null,
          tiebreakScheme: null,
        },
        existingRounds: ["scored", "scored"].map((status, index) => ({
          roundNumber: index + 1,
          status,
          secondaryValue: null,
        })),
      }),
    ).toThrow(
      "adjustedRoundScores must contain contiguous roundNumber values starting at 1",
    )
  })

  it("accepts a complete replacement of an existing round breakdown", () => {
    const result = normalizeSubmissionScoreAdjustment({
      status: "scored",
      roundScores: [
        { roundNumber: 1, score: "10" },
        { roundNumber: 2, score: "20" },
        { roundNumber: 3, score: "30" },
      ],
      workout: {
        scheme: "reps",
        scoreType: "sum",
        timeCapMs: null,
        tiebreakScheme: null,
      },
      existingRounds: ["scored", "scored", "scored"].map((status, index) => ({
        roundNumber: index + 1,
        status,
        secondaryValue: null,
      })),
    })

    expect(result).toMatchObject({
      scoreValue: 60,
      replaceRounds: true,
      rounds: [
        { roundNumber: 1, value: 10 },
        { roundNumber: 2, value: 20 },
        { roundNumber: 3, value: 30 },
      ],
    })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Manual review strict score validation]]
  it("rejects a malformed non-empty manual score", () => {
    expect(() =>
      normalizeManualSubmissionWorkoutResult({
        score: "not-a-time",
        workout: {
          scheme: "time",
          scoreType: "min",
          timeCapMs: null,
          roundsToScore: 1,
          tiebreakScheme: null,
        },
      }),
    ).toThrow("score must be a valid score")
  })

  it("rejects a malformed manual score even when CAP is explicit", () => {
    expect(() =>
      normalizeManualSubmissionWorkoutResult({
        score: "not-a-time",
        status: "cap",
        workout: {
          scheme: "time-with-cap",
          scoreType: "min",
          timeCapMs: 600_000,
          roundsToScore: 1,
          tiebreakScheme: null,
        },
      }),
    ).toThrow("score must be a valid score")
  })
})
