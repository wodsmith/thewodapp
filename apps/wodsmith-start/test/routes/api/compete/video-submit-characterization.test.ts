import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import { scoresTable } from "@/db/schemas/scores"
import { videoSubmissionsTable } from "@/db/schemas/video-submissions"

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

import { Route } from "@/routes/api/compete/video/submit"

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
  return new Request("https://mobile.wodsmith.test/api/compete/video/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    trackWorkoutId: "track-workout-1",
    competitionId: "competition-1",
    divisionId: "rx",
    videoUrl: "https://video.example/submission.mp4",
    ...overrides,
  }
}

function arrangeVideoWrite(options: {
  divisionId?: string | null
  existingSubmissionId?: string
  workout?: {
    workoutId: string
    scheme: string
    scoreType: string | null
    timeCap: number | null
    tiebreakScheme: string | null
    trackId: string
  }
} = {}) {
  const limit = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
  limit
    .mockResolvedValueOnce([
      {
        id: "registration-1",
        divisionId:
          options.divisionId === undefined ? "rx" : options.divisionId,
      },
    ])
    .mockResolvedValueOnce([{ competitionType: "online" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(
      options.existingSubmissionId
        ? [{ id: options.existingSubmissionId }]
        : [],
    )

  if (options.workout) {
    limit
      .mockResolvedValueOnce([options.workout])
      .mockResolvedValueOnce([{ ownerTeamId: "owner-team" }])
  }
}

function valuesFor(table: unknown) {
  const chain = mockDb.getChainMock()
  const indexes = chain.insert.mock.calls.flatMap(([insertedTable], index) =>
    insertedTable === table ? [index] : [],
  )
  return indexes.map(
    (index) => chain.values.mock.calls[index]?.[0] as Record<string, unknown>,
  )
}

describe("mobile video submit route characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    mockGetSession.mockResolvedValue({ userId: "athlete-1" })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Mobile video HTTP auth validation and registration]]
  it("preserves auth, request validation, and registration error contracts", async () => {
    mockGetSession.mockResolvedValueOnce(null)
    const unauthorized = await post({ request: request(validBody()) })
    expect(unauthorized.status).toBe(401)
    await expect(unauthorized.json()).resolves.toEqual({ error: "Unauthorized" })

    mockGetSession.mockResolvedValueOnce({ userId: "athlete-1" })
    const invalid = await post({
      request: request(validBody({ videoUrl: "not-a-url" })),
    })
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toMatchObject({
      error: "Invalid request",
      details: expect.any(Object),
    })

    ;(mockDb.getChainMock().limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      [],
    )
    const unregistered = await post({ request: request(validBody()) })
    expect(unregistered.status).toBe(403)
    await expect(unregistered.json()).resolves.toEqual({
      error: "You must be registered for this competition to submit a video",
    })
  })

  it("rejects an ambiguous registration when divisionId is omitted", async () => {
    ;(mockDb.getChainMock().limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "registration-1", divisionId: "rx" },
      { id: "registration-2", divisionId: "scaled" },
    ])

    const response = await post({
      request: request(validBody({ divisionId: undefined })),
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error:
        "You are registered in multiple divisions for this competition. Please specify divisionId.",
    })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Mobile video score compatibility]]
  it("keeps explicit below-threshold CAP, null invalid tiebreak, and null division", async () => {
    arrangeVideoWrite({
      divisionId: null,
      workout: {
        workoutId: "workout-1",
        scheme: "time-with-cap",
        scoreType: "min",
        timeCap: 600,
        tiebreakScheme: "time",
        trackId: "track-1",
      },
    })

    const response = await post({
      request: request(
        validBody({
          divisionId: undefined,
          score: "9:59",
          scoreStatus: "cap",
          secondaryScore: "120",
          tiebreakScore: "not-a-time",
        }),
      ),
    })

    expect(response.status).toBe(200)
    expect(valuesFor(scoresTable)[0]).toMatchObject({
      userId: "athlete-1",
      competitionEventId: "track-workout-1",
      scalingLevelId: null,
      scoreValue: 599_000,
      status: "cap",
      secondaryValue: null,
      tiebreakScheme: "time",
      tiebreakValue: null,
    })
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Mobile video lifecycle precedes score validation]]
  it("persists the video before returning a score-validation error", async () => {
    arrangeVideoWrite({
      workout: {
        workoutId: "workout-1",
        scheme: "time",
        scoreType: "min",
        timeCap: null,
        tiebreakScheme: null,
        trackId: "track-1",
      },
    })

    const response = await post({
      request: request(validBody({ score: "not-a-time" })),
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("Invalid score format:"),
    })
    expect(valuesFor(videoSubmissionsTable)).toHaveLength(1)
    expect(valuesFor(scoresTable)).toHaveLength(0)
    expect(mockDb.getChainMock().transaction).not.toHaveBeenCalled()
  })

  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Mobile video non-atomic response]]
  it("writes video then score without a transaction and preserves success shape", async () => {
    arrangeVideoWrite({
      workout: {
        workoutId: "workout-1",
        scheme: "reps",
        scoreType: "max",
        timeCap: null,
        tiebreakScheme: null,
        trackId: "track-1",
      },
    })

    const response = await post({
      request: request(validBody({ score: "123" })),
    })
    const chain = mockDb.getChainMock()

    expect(chain.transaction).not.toHaveBeenCalled()
    expect(chain.insert.mock.calls.map(([table]) => table)).toEqual([
      videoSubmissionsTable,
      scoresTable,
    ])
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      submissionId: expect.any(String),
      isUpdate: false,
    })
  })
})
