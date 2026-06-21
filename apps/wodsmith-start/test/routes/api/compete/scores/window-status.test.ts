import { beforeEach, describe, expect, it, vi } from "vitest"

const mockLimit = vi.hoisted(() => vi.fn())

const mockDb = vi.hoisted(() => {
  const chain: Record<string, unknown> = {}

  chain.select = vi.fn(() => chain)
  chain.from = vi.fn(() => chain)
  chain.where = vi.fn(() => chain)
  chain.limit = (...args: unknown[]) => mockLimit(...args)

  return chain
})

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
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

import { Route } from "@/routes/api/compete/scores/window-status"

const routeConfig = Route as unknown as {
  server: {
    handlers: {
      GET: (args: { request: Request }) => Promise<Response>
    }
  }
}

function windowStatusRequest() {
  return new Request(
    "https://wodsmith.test/api/compete/scores/window-status?competitionId=comp-1&trackWorkoutId=tw-1",
  )
}

describe("score window-status API route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLimit.mockReset()
  })

  it("keeps online competitions closed when no submission window row exists", async () => {
    mockLimit
      .mockResolvedValueOnce([{ competitionType: "online" }])
      .mockResolvedValueOnce([])

    const response = await routeConfig.server.handlers.GET({
      request: windowStatusRequest(),
    })
    const data = (await response.json()) as {
      isOpen: boolean
      reason: string
    }

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      isOpen: false,
      reason: "Submission window not configured",
    })
  })

  it("treats benchmark perpetual status as open without window rows", async () => {
    // @lat: [[competition-type-capabilities#Perpetual Window Status Test]]
    mockLimit.mockResolvedValueOnce([{ competitionType: "benchmark" }])

    const response = await routeConfig.server.handlers.GET({
      request: windowStatusRequest(),
    })
    const data = (await response.json()) as {
      isOpen: boolean
      opensAt: string | null
      closesAt: string | null
    }

    expect(response.status).toBe(200)
    expect(data).toEqual({
      isOpen: true,
      opensAt: null,
      closesAt: null,
    })
    expect(mockLimit).toHaveBeenCalledTimes(1)
  })
})
