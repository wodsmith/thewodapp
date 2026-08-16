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

  // @lat: [[competition-type-capabilities#Perpetual Submission Gate Test#Rejects Generic Athlete Benchmark Scores]]
  it("rejects benchmark scores outside the benchmark flow", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "battery-1" }])

    await expect(
      submitAthleteScoreFn({
        data: {
          competitionId: "comp-1",
          trackWorkoutId: "tw-1",
          score: "10:00",
          status: "scored",
        },
      }),
    ).rejects.toThrow(
      "Benchmark scores must be submitted through the benchmark submission flow",
    )
  })
})
