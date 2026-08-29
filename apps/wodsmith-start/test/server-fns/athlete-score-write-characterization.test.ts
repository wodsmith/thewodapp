import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import { submitAthleteScoreFn } from "@/server-fns/athlete-score-fns"

const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}))

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: vi.fn(async () => ({ userId: "athlete-1" })),
}))

vi.mock("@/lib/logging", () => ({
  addRequestContextAttribute: vi.fn(),
  logEntityUpdated: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  updateRequestContext: vi.fn(),
}))

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validator: (data: unknown) => unknown) => ({
      handler:
        (handler: (context: { data: never }) => Promise<unknown>) =>
        async ({ data }: { data: unknown }) =>
          handler({ data: validator(data) as never }),
    }),
  }),
}))

function arrangeSuccessfulWrite(workout: {
  scheme: string
  scoreType: string | null
  timeCap: number | null
  tiebreakScheme: string | null
}) {
  const limit = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
  const now = Date.now()
  limit
    .mockResolvedValueOnce([{ id: "registration-1", divisionId: "rx" }])
    .mockResolvedValueOnce([{ competitionType: "online" }])
    .mockResolvedValueOnce([
      {
        submissionOpensAt: new Date(now - 60_000).toISOString(),
        submissionClosesAt: new Date(now + 60_000).toISOString(),
      },
    ])
    .mockResolvedValueOnce([{ workoutId: "workout-1", trackId: "track-1" }])
    .mockResolvedValueOnce([workout])
    .mockResolvedValueOnce([{ ownerTeamId: "owner-team" }])
    .mockResolvedValueOnce([{ id: "score-1" }])
}

function insertedScore() {
  const values = mockDb.getChainMock().values as ReturnType<typeof vi.fn>
  return values.mock.calls[0]?.[0] as Record<string, unknown>
}

describe("submitAthleteScoreFn write characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Athlete explicit CAP contract]]
  it("trusts explicit CAP, clamps to the cap, and stores secondary and tiebreak values", async () => {
    arrangeSuccessfulWrite({
      scheme: "time-with-cap",
      scoreType: "min",
      timeCap: 600,
      tiebreakScheme: "time",
    })

    await submitAthleteScoreFn({
      data: {
        competitionId: "competition-1",
        trackWorkoutId: "track-workout-1",
        divisionId: "rx",
        score: "9:59",
        status: "cap",
        secondaryScore: "150",
        tiebreakScore: "1:23",
      },
    })

    expect(insertedScore()).toMatchObject({
      scoreValue: 600_000,
      status: "cap",
      statusOrder: 1,
      secondaryValue: 150,
      tiebreakValue: 83_000,
      scalingLevelId: "rx",
    })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Athlete invalid tiebreak compatibility]]
  it("silently stores a null encoding for an invalid tiebreak", async () => {
    arrangeSuccessfulWrite({
      scheme: "time",
      scoreType: "min",
      timeCap: null,
      tiebreakScheme: "time",
    })

    await expect(
      submitAthleteScoreFn({
        data: {
          competitionId: "competition-1",
          trackWorkoutId: "track-workout-1",
          divisionId: "rx",
          score: "5:00",
          status: "scored",
          tiebreakScore: "not-a-time",
        },
      }),
    ).resolves.toMatchObject({ success: true, scoreId: "score-1" })

    expect(insertedScore()).toMatchObject({ tiebreakValue: null })
  })
})
