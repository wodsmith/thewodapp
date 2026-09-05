import { FakeDrizzleDb } from "@repo/test-utils"
import { describe, expect, it, type vi } from "vitest"
import type { Database } from "@/db"
import {
  type CompetitionResultError,
  decideCompetitionResult,
  recordCompetitionResult,
} from "@/server/competition-results"
import { persistCompetitionResult } from "@/server/competition-results/repository"

function workout() {
  return {
    workoutId: "workout-1",
    scheme: "time-with-cap",
    scoreType: "sum",
    roundsToScore: 2,
    timeCap: 600,
    tiebreakScheme: null,
  }
}

describe("competition-result decision", () => {
  // @lat: [[competition-results#Competition Result Commands#Explicit per-round CAP state above threshold]]
  it("uses explicit round status instead of inferring CAP from the encoded time", () => {
    const result = decideCompetitionResult(
      {
        status: "scored",
        roundScores: [{ score: "4:00" }, { score: "10:02" }],
      },
      workout(),
    )

    expect(result).toMatchObject({
      scoreValue: 842_000,
      status: "scored",
      rounds: [
        { roundNumber: 1, value: 240_000, status: "scored" },
        { roundNumber: 2, value: 602_000, status: "scored" },
      ],
    })
  })

  // @lat: [[competition-results#Competition Result Commands#Explicit capped round secondary value]]
  it("clamps an explicitly capped round and retains its secondary value", () => {
    const result = decideCompetitionResult(
      {
        status: "scored",
        roundScores: [
          { score: "4:00" },
          { score: "9:15", status: "cap", secondaryScore: "127" },
        ],
      },
      workout(),
    )

    expect(result).toMatchObject({
      scoreValue: 840_000,
      status: "cap",
      rounds: [
        { roundNumber: 1, status: "scored", secondaryValue: null },
        {
          roundNumber: 2,
          value: 600_000,
          status: "cap",
          secondaryValue: 127,
        },
      ],
    })
  })

  it("rejects partially numeric secondary scores", () => {
    expect(() =>
      decideCompetitionResult(
        {
          status: "scored",
          roundScores: [
            { score: "4:00" },
            { score: "9:15", status: "cap", secondaryScore: "127abc" },
          ],
        },
        workout(),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<CompetitionResultError>>({
        code: "invalid_cap",
      }),
    )
  })

  // @lat: [[competition-results#Competition Result Commands#Complete round claims]]
  it("rejects partial multi-round claims", () => {
    expect(() =>
      decideCompetitionResult(
        { status: "scored", roundScores: [{ score: "4:00" }] },
        workout(),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<CompetitionResultError>>({
        code: "incomplete_rounds",
      }),
    )
  })
})

describe("competition-result persistence", () => {
  // @lat: [[competition-results#Competition Result Commands#Atomic total replacement]]
  it("clears old round rows even when the replacement has no rounds", async () => {
    const db = new FakeDrizzleDb()
    const chain = db.getChainMock()
    const limit = chain.limit as ReturnType<typeof vi.fn>
    limit
      .mockResolvedValueOnce([{ id: "score-1" }])
      .mockResolvedValueOnce([{ id: "score-1" }])

    const revision = decideCompetitionResult(
      { score: "8:00", status: "scored" },
      { ...workout(), roundsToScore: null },
    )
    const receipt = await persistCompetitionResult({
      db: db as unknown as Database,
      target: {
        athleteUserId: "athlete-1",
        ownerTeamId: "team-1",
        workoutId: "workout-1",
        trackWorkoutId: "event-1",
        divisionId: null,
      },
      revision,
      recordedAt: new Date("2026-09-01T12:00:00Z"),
    })

    expect(receipt).toEqual({ scoreId: "score-1", isNew: false })
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(chain.delete).toHaveBeenCalledTimes(1)
    expect(chain.insert).toHaveBeenCalledTimes(1)
  })

  // @lat: [[competition-results#Competition Result Commands#Authoritative programmed workout]]
  it("loads workout and ownership from the programmed event", async () => {
    const db = new FakeDrizzleDb()
    const chain = db.getChainMock()
    const limit = chain.limit as ReturnType<typeof vi.fn>
    limit
      .mockResolvedValueOnce([
        {
          workoutId: "authoritative-workout",
          trackId: "track-1",
          scheme: "reps",
          scoreType: "max",
          roundsToScore: null,
          timeCap: null,
          tiebreakScheme: null,
        },
      ])
      .mockResolvedValueOnce([{ ownerTeamId: "authoritative-team" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "score-2" }])

    const receipt = await recordCompetitionResult({
      db: db as unknown as Database,
      command: {
        athleteUserId: "athlete-1",
        trackWorkoutId: "event-1",
        divisionScope: { kind: "division", divisionId: "rx" },
        claim: { score: "42", status: "scored" },
      },
    })

    expect(receipt).toEqual({ scoreId: "score-2", isNew: true })
    expect(chain.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workoutId: "authoritative-workout",
        teamId: "authoritative-team",
        competitionEventId: "event-1",
        scalingLevelId: "rx",
      }),
    )
  })
})
