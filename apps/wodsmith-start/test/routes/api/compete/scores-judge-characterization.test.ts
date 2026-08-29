import type { SQL } from "drizzle-orm"
import { MySqlDialect } from "drizzle-orm/mysql-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"

const mockDb = new FakeDrizzleDb()
const mockGetSession = vi.hoisted(() => vi.fn())

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
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

import { Route } from "@/routes/api/compete/scores/judge"

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
  return new Request("https://mobile.wodsmith.test/api/compete/scores/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    competitionId: "competition-1",
    organizingTeamId: "organizer-team",
    trackWorkoutId: "track-workout-1",
    workoutId: "workout-1",
    registrationId: "registration-1",
    userId: "athlete-1",
    divisionId: "rx",
    score: "5:00",
    scoreStatus: "scored",
    workout: {
      scheme: "time",
      scoreType: "min",
      repsPerRound: null,
      roundsToScore: 1,
      timeCap: null,
      tiebreakScheme: null,
    },
    ...overrides,
  }
}

function arrangeInPersonWrite(finalScoreId = "score-1") {
  const limit = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
  limit
    .mockResolvedValueOnce([{ competitionType: "in-person" }])
    .mockResolvedValueOnce([{ id: finalScoreId }])
}

function valuesFor(table: unknown) {
  const chain = mockDb.getChainMock()
  const indexes = chain.insert.mock.calls.flatMap(([insertedTable], index) =>
    insertedTable === table ? [index] : [],
  )
  return indexes.map((index) => chain.values.mock.calls[index]?.[0])
}

function renderedWhereClauses() {
  const where = mockDb.getChainMock().where as ReturnType<typeof vi.fn>
  return where.mock.calls.map(([condition]) =>
    new MySqlDialect().sqlToQuery(condition as SQL).sql,
  )
}

describe("judge score route characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    mockGetSession.mockResolvedValue({
      userId: "judge-1",
      user: { role: "user" },
      teams: [{ id: "organizer-team" }],
    })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Judge HTTP auth authorization and validation]]
  it("preserves authentication, team authorization, and validation shapes", async () => {
    mockGetSession.mockResolvedValueOnce(null)
    const unauthorized = await post({ request: request(validBody()) })
    expect(unauthorized.status).toBe(401)
    await expect(unauthorized.json()).resolves.toEqual({ error: "Unauthorized" })

    mockGetSession.mockResolvedValueOnce({
      userId: "judge-1",
      user: { role: "user" },
      teams: [],
    })
    const forbidden = await post({ request: request(validBody()) })
    expect(forbidden.status).toBe(403)
    await expect(forbidden.json()).resolves.toEqual({
      error: "Not authorized for this team",
    })

    mockGetSession.mockResolvedValueOnce({
      userId: "judge-1",
      user: { role: "user" },
      teams: [{ id: "organizer-team" }],
    })
    const invalid = await post({ request: request({ scoreStatus: "scored" }) })
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toMatchObject({
      error: "Invalid request",
      details: expect.any(Object),
    })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Judge trusts workout and athlete targets]]
  it("trusts the supplied workout metadata and athlete target, including exact null division", async () => {
    arrangeInPersonWrite()

    const response = await post({
      request: request(
        validBody({
          userId: "client-selected-athlete",
          divisionId: null,
          scoreStatus: "dns",
        }),
      ),
    })

    expect(response.status).toBe(200)
    expect(mockDb.getChainMock().select).toHaveBeenCalledTimes(2)
    expect(valuesFor(scoresTable)[0]).toMatchObject({
      userId: "client-selected-athlete",
      workoutId: "workout-1",
      competitionEventId: "track-workout-1",
      scalingLevelId: null,
      status: "withdrawn",
    })
    expect(
      renderedWhereClauses().some((sql) =>
        /scalingLevelId.*is null/i.test(sql),
      ),
    ).toBe(true)
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Judge multi-round CAP and tiebreak]]
  it("derives parent and round CAP status while preserving aggregate and tiebreak", async () => {
    arrangeInPersonWrite()

    const response = await post({
      request: request(
        validBody({
          score: "",
          scoreStatus: "scored",
          tieBreakScore: "1:23",
          roundScores: [{ score: "5:00" }, { score: "10:00" }],
          workout: {
            scheme: "time-with-cap",
            scoreType: "sum",
            repsPerRound: null,
            roundsToScore: 2,
            timeCap: 600,
            tiebreakScheme: "time",
          },
        }),
      ),
    })

    expect(response.status).toBe(200)
    expect(valuesFor(scoresTable)[0]).toMatchObject({
      scoreValue: 900_000,
      status: "cap",
      statusOrder: 1,
      tiebreakScheme: "time",
      tiebreakValue: 83_000,
      timeCapMs: 600_000,
    })
    expect(valuesFor(scoreRoundsTable)[0]).toEqual([
      { scoreId: "score-1", roundNumber: 1, value: 300_000, status: "scored" },
      { scoreId: "score-1", roundNumber: 2, value: 600_000, status: "cap" },
    ])
  })

  it("rejects a partial invalid round encoding before starting a transaction", async () => {
    ;(mockDb.getChainMock().limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { competitionType: "in-person" },
    ])

    const response = await post({
      request: request(
        validBody({
          roundScores: [{ score: "5:00" }, { score: "not-a-time" }],
        }),
      ),
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: "Every round must be a valid score",
    })
    expect(mockDb.getChainMock().transaction).not.toHaveBeenCalled()
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Judge score-round transaction and stale rounds]]
  it("atomically upserts, reads, replaces rounds, and preserves the success envelope", async () => {
    arrangeInPersonWrite()

    const response = await post({
      request: request(
        validBody({ roundScores: [{ score: "5:00" }] }),
      ),
    })
    const chain = mockDb.getChainMock()

    expect(chain.transaction).toHaveBeenCalledTimes(1)
    expect(chain.onDuplicateKeyUpdate).toHaveBeenCalledTimes(1)
    expect(chain.delete).toHaveBeenCalledWith(scoreRoundsTable)
    expect(valuesFor(scoreRoundsTable)).toHaveLength(1)
    expect(
      chain.onDuplicateKeyUpdate.mock.invocationCallOrder[0],
    ).toBeLessThan(chain.delete.mock.invocationCallOrder[0] ?? 0)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { resultId: "score-1", isNew: true },
    })

    mockDb.reset()
    arrangeInPersonWrite("score-2")
    await post({ request: request(validBody()) })
    expect(mockDb.getChainMock().delete).not.toHaveBeenCalled()
  })

  it("rolls back score and round work into the existing 500 error shape", async () => {
    arrangeInPersonWrite()
    const chain = mockDb.getChainMock()
    chain.delete.mockImplementationOnce(() => ({
      where: vi.fn(async () => {
        throw new Error("round delete failed")
      }),
    }) as never)

    const response = await post({
      request: request(
        validBody({ roundScores: [{ score: "5:00" }] }),
      ),
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    })
  })
})
