import { describe, expect, it } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import type { Database } from "@/db"
import {
  normalizeSubmittedPersonalWorkoutResult,
  updatePersonalWorkoutResult,
} from "@/server/training-logs"

describe("personal workout-result normalization", () => {
  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Personal padded sort-key storage]]
  it("stores sortable keys in the padded database representation", () => {
    const result = normalizeSubmittedPersonalWorkoutResult({
      workout: { scheme: "reps", scoreType: "max", timeCap: null },
      score: "42",
    })

    expect(result.sortKey).toMatch(/^\d{38}$/)
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Personal strict round validation]]
  it("rejects a submission when any round score is invalid", () => {
    expect(() =>
      normalizeSubmittedPersonalWorkoutResult({
        workout: { scheme: "reps", scoreType: "sum", timeCap: null },
        score: "",
        roundScores: [{ score: "10" }, { score: "not-a-score" }],
      }),
    ).toThrow("Every round must be a valid score")
  })

  it("rejects an update before writing when any round score is invalid", async () => {
    const db = new FakeDrizzleDb()

    await expect(
      updatePersonalWorkoutResult({
        db: db as unknown as Database,
        scoreId: "score-1",
        existing: { scheme: "reps", scoreType: "sum" },
        roundScores: [{ score: "10" }, { score: "not-a-score" }],
      }),
    ).rejects.toThrow("Every round must be a valid score")

    expect(db.update).not.toHaveBeenCalled()
  })
})
