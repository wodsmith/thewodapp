import { beforeEach, describe, expect, it, vi } from "vitest"

const mockSession = vi.hoisted(() => vi.fn())
const mockLimit = vi.hoisted(() => vi.fn())

const mockDb = vi.hoisted(() => {
  const chain: Record<string, unknown> = {}
  const passthrough = () => chain

  chain.select = vi.fn(passthrough)
  chain.from = vi.fn(passthrough)
  chain.where = vi.fn(passthrough)
  chain.insert = vi.fn(passthrough)
  chain.values = vi.fn(passthrough)
  chain.limit = (...args: unknown[]) => mockLimit(...args)
  chain.onDuplicateKeyUpdate = vi.fn(() => Promise.resolve())
  chain.then = <T>(resolve: (value: T) => void) => {
    resolve(undefined as T)
    return Promise.resolve(undefined as T)
  }

  return chain
})

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}))

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: mockSession,
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
      handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) => {
        return async (ctx: { data: unknown }) => {
          const data = validator(ctx.data)
          return fn({ data })
        }
      },
    }),
  }),
}))

import { submitAthleteScoreFn } from "@/server-fns/athlete-score-fns"

describe("athlete score submission capability gates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLimit.mockReset()
    mockSession.mockResolvedValue({ userId: "user-1" })
  })

  it("allows benchmark score submission without submission-window rows", async () => {
    mockLimit
      .mockResolvedValueOnce([{ id: "reg-1", divisionId: "open" }])
      .mockResolvedValueOnce([{ competitionType: "benchmark" }])
      .mockResolvedValueOnce([{ workoutId: "workout-1", trackId: "track-1" }])
      .mockResolvedValueOnce([
        {
          scheme: "time",
          scoreType: "min",
          tiebreakScheme: null,
          timeCap: null,
        },
      ])
      .mockResolvedValueOnce([{ ownerTeamId: "team-1" }])
      .mockResolvedValueOnce([{ id: "score-1" }])

    const result = await submitAthleteScoreFn({
      data: {
        competitionId: "comp-1",
        trackWorkoutId: "tw-1",
        score: "10:00",
        status: "scored",
      },
    })

    expect(result).toEqual({
      success: true,
      scoreId: "score-1",
      message: "Score submitted successfully",
    })
  })
})
