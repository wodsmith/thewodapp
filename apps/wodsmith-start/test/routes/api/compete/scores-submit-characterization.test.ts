import type { SQL } from "drizzle-orm"
import { MySqlDialect } from "drizzle-orm/mysql-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import { scoresTable } from "@/db/schemas/scores"

const mockDb = new FakeDrizzleDb()
const mockGetSession = vi.hoisted(() => vi.fn())

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}))

vi.mock("@/server/benchmark-submissions", () => ({
  isBenchmarkCompetition: vi.fn(async () => false),
}))

vi.mock("@/utils/bearer-auth", () => ({
  corsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
  getSessionFromBearerOrCookie: (...args: unknown[]) =>
    mockGetSession(...args),
}))

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
}))

vi.mock("@tanstack/react-start", () => ({
  json: (data: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: new Headers(init?.headers),
    }),
}))

import { Route } from "@/routes/api/compete/scores/submit"

const post = (
  Route as unknown as {
    server: {
      handlers: {
        POST: (args: { request: Request }) => Promise<Response>
      }
    }
  }
).server.handlers.POST

function request(body: unknown) {
  return new Request("https://mobile.wodsmith.test/api/compete/scores/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://mobile.wodsmith.test",
    },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    competitionId: "competition-1",
    trackWorkoutId: "track-workout-1",
    divisionId: "rx",
    score: "9:59",
    status: "scored",
    ...overrides,
  }
}

function arrangeSuccessfulWrite(options: {
  divisionId?: string | null
  workout?: {
    scheme: string
    scoreType: string | null
    tiebreakScheme: string | null
    timeCap: number | null
  }
} = {}) {
  const limit = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
  const now = Date.now()
  limit
    .mockResolvedValueOnce([
      {
        id: "registration-1",
        divisionId:
          options.divisionId === undefined ? "rx" : options.divisionId,
      },
    ])
    .mockResolvedValueOnce([{ competitionType: "online" }])
    .mockResolvedValueOnce([
      {
        submissionOpensAt: new Date(now - 60_000).toISOString(),
        submissionClosesAt: new Date(now + 60_000).toISOString(),
      },
    ])
    .mockResolvedValueOnce([{ workoutId: "workout-1", trackId: "track-1" }])
    .mockResolvedValueOnce([
      options.workout ?? {
        scheme: "time",
        scoreType: "min",
        tiebreakScheme: null,
        timeCap: null,
      },
    ])
    .mockResolvedValueOnce([{ ownerTeamId: "owner-team" }])
    .mockResolvedValueOnce([{ id: "score-1" }])
}

function renderCondition(condition: unknown) {
  return new MySqlDialect().sqlToQuery(condition as SQL).sql
}

function insertedScore() {
  const chain = mockDb.getChainMock()
  const scoreInsertIndex = chain.insert.mock.calls.findIndex(
    ([table]) => table === scoresTable,
  )
  return chain.values.mock.calls[scoreInsertIndex]?.[0] as Record<
    string,
    unknown
  >
}

describe("mobile score submit route characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    mockGetSession.mockResolvedValue({ userId: "athlete-1" })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Mobile score HTTP auth and validation]]
  it("preserves authentication, JSON, and schema error shapes", async () => {
    mockGetSession.mockResolvedValueOnce(null)
    const unauthorized = await post({ request: request(validBody()) })
    expect(unauthorized.status).toBe(401)
    await expect(unauthorized.json()).resolves.toEqual({ error: "Unauthorized" })

    mockGetSession.mockResolvedValueOnce({ userId: "athlete-1" })
    const invalidJson = await post({
      request: new Request(
        "https://mobile.wodsmith.test/api/compete/scores/submit",
        { method: "POST", body: "{" },
      ),
    })
    expect(invalidJson.status).toBe(400)
    await expect(invalidJson.json()).resolves.toEqual({
      error: "Invalid JSON body",
    })

    const invalidRequest = await post({ request: request({ score: "5:00" }) })
    expect(invalidRequest.status).toBe(400)
    await expect(invalidRequest.json()).resolves.toMatchObject({
      error: "Invalid request",
      details: expect.any(Object),
    })
  })

  it("rejects missing and ambiguous registrations with their existing statuses", async () => {
    const limit = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
    limit.mockResolvedValueOnce([])
    const missing = await post({ request: request(validBody()) })
    expect(missing.status).toBe(403)
    await expect(missing.json()).resolves.toEqual({
      error: "You are not registered for this competition",
    })

    mockDb.reset()
    ;(mockDb.getChainMock().limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "registration-1", divisionId: "rx" },
      { id: "registration-2", divisionId: "scaled" },
    ])
    const ambiguous = await post({
      request: request(validBody({ divisionId: undefined })),
    })
    expect(ambiguous.status).toBe(422)
    await expect(ambiguous.json()).resolves.toEqual({
      error:
        "You are registered in multiple divisions for this competition. Please specify divisionId.",
    })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Mobile score nullable-division readback]]
  it("writes a null division but leaves the legacy final-score readback unscoped", async () => {
    arrangeSuccessfulWrite({ divisionId: null })

    const response = await post({
      request: request(validBody({ divisionId: undefined })),
    })

    expect(response.status).toBe(200)
    expect(insertedScore()).toMatchObject({ scalingLevelId: null })

    const where = mockDb.getChainMock().where as ReturnType<typeof vi.fn>
    const finalScoreSql = renderCondition(where.mock.calls.at(-1)?.[0])
    expect(finalScoreSql).toContain("competitionEventId")
    expect(finalScoreSql).toContain("userId")
    expect(finalScoreSql).not.toContain("scalingLevelId")
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Mobile score explicit CAP and tiebreak]]
  it("clamps explicit CAP and silently persists an invalid tiebreak as null", async () => {
    arrangeSuccessfulWrite({
      workout: {
        scheme: "time-with-cap",
        scoreType: "min",
        tiebreakScheme: "time",
        timeCap: 600,
      },
    })

    const response = await post({
      request: request(
        validBody({
          score: "9:59",
          status: "cap",
          secondaryScore: "123",
          tiebreakScore: "not-a-time",
        }),
      ),
    })

    expect(response.status).toBe(200)
    expect(insertedScore()).toMatchObject({
      scoreValue: 600_000,
      status: "cap",
      statusOrder: 1,
      secondaryValue: 123,
      tiebreakScheme: "time",
      tiebreakValue: null,
    })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Mobile score non-transactional response]]
  it("upserts before readback without a transaction and preserves the response envelope", async () => {
    arrangeSuccessfulWrite()

    const response = await post({ request: request(validBody()) })
    const chain = mockDb.getChainMock()

    expect(chain.transaction).not.toHaveBeenCalled()
    expect(chain.onDuplicateKeyUpdate).toHaveBeenCalledTimes(1)
    expect(
      chain.onDuplicateKeyUpdate.mock.invocationCallOrder[0],
    ).toBeLessThan(chain.limit.mock.invocationCallOrder.at(-1) ?? 0)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    await expect(response.json()).resolves.toEqual({
      success: true,
      scoreId: "score-1",
      message: "Score submitted successfully",
    })
  })
})
