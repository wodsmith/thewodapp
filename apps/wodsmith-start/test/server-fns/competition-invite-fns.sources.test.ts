/**
 * Permission-gating tests for competition-invite-fns source endpoints.
 *
 * Per ADR OQ6 (same-org only for MVP), the source's organizing team must
 * currently match the championship's. `MANAGE_COMPETITIONS` is required on
 * both teams, and cross-org references are rejected.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

// Direct-handler passthrough so we can call the fns without the framework.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (parser: (d: unknown) => unknown) => ({
      handler:
        (fn: (ctx: { data: unknown }) => Promise<unknown>) =>
        (ctx: { data: unknown }) =>
          fn({ data: parser(ctx.data) }),
    }),
    // Some fns skip `inputValidator` and call `.handler` directly.
    handler:
      (fn: (...args: unknown[]) => Promise<unknown>) =>
      (...args: unknown[]) =>
        fn(...args),
  }),
  // `createServerOnlyFn` wraps a zero-arg function and returns it as-is on
  // the server. Tests run in a node env without the TanStack runtime, so
  // this stub just returns the factory unchanged.
  createServerOnlyFn: <T>(fn: T): T => fn,
}))

// Ordered list of organizing-team lookup responses. Each call to
// db.select(...).from(...).where(...).limit(1) awaited here returns the next
// entry. This lets each test script the sequence of (championship-team,
// source-team) lookups explicitly.
const lookupQueue: Array<Array<{ organizingTeamId: string }>> = []

vi.mock("@/db", () => ({
  getDb: () => {
    const chain = {
      select: vi.fn(() => chain),
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      async limit() {
        const next = lookupQueue.shift() ?? []
        return next
      },
    } as Record<string, unknown>
    return chain
  },
}))

// Stub the sources helper so no real DB path runs after auth passes.
vi.mock("@/server/competition-invites/sources", () => ({
  createSource: vi.fn(async () => ({ id: "cisrc_new" })),
  updateSource: vi.fn(async () => ({ id: "cisrc_new" })),
  deleteSource: vi.fn(async () => undefined),
  getSourceById: vi.fn(async () => null),
  listSourcesForChampionship: vi.fn(async () => []),
}))

const sessionStub = {
  userId: "user_admin",
  user: { id: "user_admin", email: "a@b.com", role: "user" },
  teams: [
    { id: "team_a", name: "A", permissions: ["manage_competitions"] },
    { id: "team_b", name: "B", permissions: ["manage_competitions"] },
    { id: "team_c", name: "C", permissions: [] },
  ],
}
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: vi.fn(async () => sessionStub),
}))

describe("createInviteSourceFn permissions", () => {
  beforeEach(() => {
    lookupQueue.length = 0
  })

  it("rejects when the caller lacks MANAGE_COMPETITIONS on the championship team", async () => {
    lookupQueue.push([{ organizingTeamId: "team_c" }])

    const { createInviteSourceFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createInviteSourceFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          kind: "competition",
          sourceCompetitionId: "comp_champ",
        },
      }),
    ).rejects.toThrow(/permission/i)
  })

  it("rejects cross-organization sources (ADR OQ6 same-org only MVP)", async () => {
    // championship lookup → team_a, source lookup → team_b
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    lookupQueue.push([{ organizingTeamId: "team_b" }])

    const { createInviteSourceFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createInviteSourceFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          kind: "competition",
          sourceCompetitionId: "comp_src",
        },
      }),
    ).rejects.toThrow(/same organization|cross-organization/i)
  })
})
