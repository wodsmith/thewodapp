import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const queryQueue: unknown[][] = []
  const whereCalls: unknown[] = []
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn((condition: unknown) => {
      whereCalls.push(condition)
      return chain
    }),
    then(resolve: (value: unknown[]) => void) {
      const value = queryQueue.shift() ?? []
      resolve(value)
      return Promise.resolve(value)
    },
  }

  return {
    chain,
    queryQueue,
    whereCalls,
    getDb: vi.fn(() => chain),
    getSessionFromCookie: vi.fn(),
  }
})

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (parser: (data: unknown) => unknown) => ({
      handler:
        (fn: (ctx: { data: unknown }) => Promise<unknown>) =>
        async (ctx: { data: unknown }) =>
          fn({ data: parser(ctx.data) }),
    }),
    handler:
      (fn: (...args: unknown[]) => Promise<unknown>) =>
      async (...args: unknown[]) =>
        fn(...args),
  }),
  createServerOnlyFn: <T>(fn: T): T => fn,
}))

vi.mock("@/db", () => ({
  getDb: mocks.getDb,
}))

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: mocks.getSessionFromCookie,
  requireVerifiedEmail: vi.fn(),
}))

import { getPendingTeamInvitesFn } from "@/server-fns/competition-detail-fns"

describe("getPendingTeamInvitesFn", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryQueue.length = 0
    mocks.whereCalls.length = 0
  })

  it("returns no invitations without a signed-in email and does not query the db", async () => {
    mocks.getSessionFromCookie.mockResolvedValueOnce(null)

    const result = await getPendingTeamInvitesFn({
      data: { competitionId: "comp_1" },
    })

    expect(result).toEqual({ invitations: [] })
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it("short-circuits when the competition has no athlete teams", async () => {
    mocks.getSessionFromCookie.mockResolvedValueOnce({
      user: { email: "athlete@example.com" },
    })
    mocks.queryQueue.push([])

    const result = await getPendingTeamInvitesFn({
      data: { competitionId: "comp_1" },
    })

    expect(result).toEqual({ invitations: [] })
    expect(mocks.chain.select).toHaveBeenCalledTimes(1)
  })

  it("returns pending invites from the scoped invitation query", async () => {
    const invitation = {
      id: "invite_1",
      teamId: "team_1",
      email: "athlete@example.com",
      roleId: "member",
      isSystemRole: true,
      token: "token_abc",
      expiresAt: new Date("2026-06-01"),
      createdAt: new Date("2026-01-01"),
      metadata: null,
    }
    mocks.getSessionFromCookie.mockResolvedValueOnce({
      user: { email: "Athlete@Example.com" },
    })
    mocks.queryQueue.push([{ athleteTeamId: "team_1" }], [invitation])

    const result = await getPendingTeamInvitesFn({
      data: { competitionId: "comp_1" },
    })

    expect(result).toEqual({ invitations: [invitation] })
    expect(mocks.chain.select).toHaveBeenCalledTimes(2)
    expect(mocks.whereCalls).toHaveLength(2)
  })
})
