import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthSession = vi.hoisted(() => vi.fn())
const mockLimit = vi.hoisted(() => vi.fn())

const mockDb = vi.hoisted(() => {
  const chain: Record<string, unknown> = {}
  const passthrough = () => chain

  chain.select = vi.fn(passthrough)
  chain.from = vi.fn(passthrough)
  chain.where = vi.fn(passthrough)
  chain.innerJoin = vi.fn(passthrough)
  chain.insert = vi.fn(passthrough)
  chain.values = vi.fn(passthrough)
  chain.update = vi.fn(passthrough)
  chain.set = vi.fn(passthrough)
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

vi.mock("@/utils/bearer-auth", () => ({
  corsHeaders: () => ({}),
  getSessionFromBearerOrCookie: mockAuthSession,
}))

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
}))

vi.mock("@tanstack/react-start", () => ({
  json: (data: unknown, init?: { status?: number; headers?: HeadersInit }) =>
    new Response(JSON.stringify(data), {
      status: init?.status ?? 200,
      headers: { "Content-Type": "application/json", ...init?.headers },
    }),
}))

import { Route as ScoreSubmitRoute } from "@/routes/api/compete/scores/submit"
import { Route as VideoSubmitRoute } from "@/routes/api/compete/video/submit"

const scoreSubmitRoute = ScoreSubmitRoute as unknown as {
  server: {
    handlers: {
      POST: (args: { request: Request }) => Promise<Response>
    }
  }
}

const videoSubmitRoute = VideoSubmitRoute as unknown as {
  server: {
    handlers: {
      POST: (args: { request: Request }) => Promise<Response>
    }
  }
}

function postRequest(path: string, body: Record<string, unknown>) {
  return new Request(`https://wodsmith.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("submission API capability gates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLimit.mockReset()
    mockAuthSession.mockResolvedValue({ userId: "user-1" })
  })

  it("rejects direct benchmark score API writes so they cannot bypass benchmark rules", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "benchmark-battery-1" }])

    const response = await scoreSubmitRoute.server.handlers.POST({
      request: postRequest("/api/compete/scores/submit", {
        competitionId: "comp-1",
        trackWorkoutId: "tw-1",
        score: "10:00",
        status: "scored",
      }),
    })
    const data = (await response.json()) as {
      success?: boolean
      scoreId?: string
      error?: string
    }

    expect(response.status).toBe(422)
    expect(data.success).not.toBe(true)
    expect(data.scoreId).toBeUndefined()
    expect(data.error).toEqual(expect.any(String))
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it("rejects direct score API writes for malformed benchmark competitions without a battery", async () => {
    mockLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ competitionType: "benchmark" }])

    const response = await scoreSubmitRoute.server.handlers.POST({
      request: postRequest("/api/compete/scores/submit", {
        competitionId: "comp-1",
        trackWorkoutId: "tw-1",
        score: "10:00",
        status: "scored",
      }),
    })
    const data = (await response.json()) as {
      success?: boolean
      scoreId?: string
      error?: string
    }

    expect(response.status).toBe(422)
    expect(data.success).not.toBe(true)
    expect(data.scoreId).toBeUndefined()
    expect(data.error).toEqual(expect.any(String))
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it("rejects direct benchmark video API writes so they cannot bypass benchmark rules", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "benchmark-battery-1" }])

    const response = await videoSubmitRoute.server.handlers.POST({
      request: postRequest("/api/compete/video/submit", {
        competitionId: "comp-1",
        trackWorkoutId: "tw-1",
        videoUrl: "https://example.com/video",
      }),
    })
    const data = (await response.json()) as {
      success?: boolean
      submissionId?: string
      error?: string
    }

    expect(response.status).toBe(422)
    expect(data.success).not.toBe(true)
    expect(data.submissionId).toBeUndefined()
    expect(data.error).toEqual(expect.any(String))
    expect(mockDb.insert).not.toHaveBeenCalled()
  })
})
