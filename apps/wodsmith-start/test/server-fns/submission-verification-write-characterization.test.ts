import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import {
  enterSubmissionScoreFn,
  verifySubmissionScoreFn,
} from "@/server-fns/submission-verification-fns"

const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}))

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: vi.fn(async () => ({ userId: "reviewer-1" })),
}))

vi.mock("@/utils/team-auth", () => ({
  requireSubmissionReviewAccess: vi.fn(async () => ({
    organizingTeamId: "owner-team",
  })),
}))

vi.mock("@/lib/evlog", () => ({
  getEvlog: vi.fn(() => undefined),
}))

vi.mock("@/lib/logging", () => ({
  logInfo: vi.fn(),
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

function limitQueue(...results: unknown[][]) {
  const limit = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
  for (const result of results) limit.mockResolvedValueOnce(result)
}

describe("submission verification score-write characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Verification direct override retains stale rounds]]
  it("keeps existing rounds and does not clamp an explicit CAP direct override", async () => {
    mockDb.setMockReturnValue([{ status: "cap" }, { status: "cap" }])
    limitQueue(
      [
        {
          id: "competition-event-1",
          submissionOpensAt: null,
          submissionClosesAt: null,
        },
      ],
      [
        {
          id: "score-1",
          userId: "athlete-1",
          scheme: "time-with-cap",
          scoreType: "min",
          tiebreakScheme: "time",
          timeCapMs: 600_000,
          scoreValue: 700_000,
          status: "cap",
          secondaryValue: null,
          tiebreakValue: null,
        },
      ],
      [{ id: "registration-1" }],
    )

    await verifySubmissionScoreFn({
      data: {
        competitionId: "competition-1",
        trackWorkoutId: "track-workout-1",
        scoreId: "score-1",
        action: "adjust",
        adjustedScore: "9:59",
        adjustedScoreStatus: "cap",
        secondaryScore: "150",
        tieBreakScore: "not-a-time",
      },
    })

    const chain = mockDb.getChainMock()
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        scoreValue: 599_000,
        status: "cap",
        statusOrder: 1,
        secondaryValue: 150,
        tiebreakValue: null,
        verificationStatus: "adjusted",
      }),
    )
    expect(chain.delete).not.toHaveBeenCalled()
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Manual entry explicit CAP and audit transaction]]
  it("trusts explicit CAP and writes the score, audit, and video review in one transaction", async () => {
    limitQueue(
      [
        {
          id: "competition-event-1",
          submissionOpensAt: null,
          submissionClosesAt: null,
        },
      ],
      [
        {
          id: "submission-1",
          registrationId: "registration-1",
          trackWorkoutId: "track-workout-1",
        },
      ],
      [
        {
          id: "registration-1",
          userId: "athlete-1",
          captainUserId: "captain-1",
          divisionId: "rx",
          eventId: "competition-1",
        },
      ],
      [],
      [
        {
          id: "track-workout-1",
          trackId: "track-1",
          workoutId: "workout-1",
          scheme: "time-with-cap",
          scoreType: "min",
          timeCap: 600,
          roundsToScore: 1,
          tiebreakScheme: "time",
        },
      ],
      [{ ownerTeamId: "owner-team" }],
      [],
      [{ id: "score-new" }],
    )

    await enterSubmissionScoreFn({
      data: {
        competitionId: "competition-1",
        trackWorkoutId: "track-workout-1",
        videoSubmissionId: "submission-1",
        score: "9:59",
        scoreStatus: "cap",
        secondaryScore: "150",
        tieBreakScore: "not-a-time",
      },
    })

    const chain = mockDb.getChainMock()
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    expect(chain.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: "captain-1",
        teamId: "owner-team",
        scoreValue: 600_000,
        status: "cap",
        statusOrder: 1,
        secondaryValue: 150,
        tiebreakValue: null,
        verificationStatus: "adjusted",
      }),
    )
    expect(chain.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "adjusted",
        originalScoreValue: null,
        newScoreValue: 600_000,
        newStatus: "cap",
      }),
    )
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ reviewStatus: "adjusted" }),
    )
  })
})
