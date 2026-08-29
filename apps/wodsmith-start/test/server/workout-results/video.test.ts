import { describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import type { Database } from "@/db"
import {
  normalizeSubmittedVideoWorkoutResult,
  persistSubmittedVideoWorkoutResult,
} from "@/server/workout-results"

function workout(
  overrides: Partial<{
    scheme: string
    scoreType: string | null
    timeCap: number | null
    tiebreakScheme: string | null
  }> = {},
) {
  return {
    scheme: "time-with-cap",
    scoreType: "min",
    timeCap: 600,
    tiebreakScheme: null,
    ...overrides,
  }
}

describe("video workout-result normalization", () => {
  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Video ignores declared CAP below threshold]]
  it("ignores a client CAP declaration when the entered time is below the cap", () => {
    const result = normalizeSubmittedVideoWorkoutResult({
      score: "9:59",
      scoreStatus: "cap",
      secondaryScore: "150",
      workout: workout(),
    })

    expect(result).toMatchObject({
      scoreValue: 599_000,
      status: "scored",
      statusOrder: 0,
      secondaryValue: null,
      timeCapMs: 600_000,
    })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Video single-round CAP clamp]]
  it("clamps a single round at the cap and retains non-negative reps", () => {
    const result = normalizeSubmittedVideoWorkoutResult({
      score: "10:02",
      scoreStatus: "scored",
      secondaryScore: "150",
      workout: workout(),
    })

    expect(result).toMatchObject({
      scoreValue: 600_000,
      status: "cap",
      statusOrder: 1,
      secondaryValue: 150,
    })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Video multi-round CAP inference]]
  it("preserves the multi-round total while deriving parent and round CAP state", () => {
    const result = normalizeSubmittedVideoWorkoutResult({
      scoreStatus: "scored",
      roundScores: [{ score: "4:00" }, { score: "10:02" }],
      workout: workout({ scoreType: "sum" }),
    })

    expect(result).toMatchObject({
      scoreValue: 842_000,
      status: "cap",
      secondaryValue: null,
      rounds: [
        { roundNumber: 1, value: 240_000, status: "scored" },
        { roundNumber: 2, value: 602_000, status: "cap" },
      ],
    })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Video strict score validation]]
  it("retains context-specific score and tiebreak validation errors", () => {
    expect(() =>
      normalizeSubmittedVideoWorkoutResult({
        score: "not-a-time",
        workout: workout({ scheme: "time", timeCap: null }),
      }),
    ).toThrow(/Invalid score format/)

    expect(() =>
      normalizeSubmittedVideoWorkoutResult({
        score: "5:00",
        tiebreakScore: "not-a-time",
        workout: workout({
          scheme: "time",
          timeCap: null,
          tiebreakScheme: "time",
        }),
      }),
    ).toThrow('Invalid tiebreak score format: "not-a-time"')
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Video persistence stays non-transactional]]
  it("upserts and replaces rounds without introducing a transaction", async () => {
    const db = new FakeDrizzleDb()
    const chain = db.getChainMock()
    const limit = chain.limit as ReturnType<typeof vi.fn>
    limit.mockResolvedValueOnce([{ id: "score-1" }])
    const result = normalizeSubmittedVideoWorkoutResult({
      roundScores: [{ score: "4:00" }, { score: "10:02" }],
      workout: workout({ scoreType: "sum" }),
    })

    await persistSubmittedVideoWorkoutResult({
      db: db as unknown as Database,
      target: {
        userId: "athlete-1",
        teamId: "owner-team",
        workoutId: "workout-1",
        trackWorkoutId: "track-workout-1",
        divisionId: null,
      },
      result,
      recordedAt: new Date("2026-08-29T12:00:00Z"),
    })

    expect(db.transaction).not.toHaveBeenCalled()
    expect(chain.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        competitionEventId: "track-workout-1",
        scalingLevelId: null,
        scoreValue: 842_000,
      }),
    )
    expect(chain.delete).toHaveBeenCalledTimes(1)
    expect(chain.values).toHaveBeenNthCalledWith(2, [
      { scoreId: "score-1", roundNumber: 1, value: 240_000, status: "scored" },
      { scoreId: "score-1", roundNumber: 2, value: 602_000, status: "cap" },
    ])
  })
})
