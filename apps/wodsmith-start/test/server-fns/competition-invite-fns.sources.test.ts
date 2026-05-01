/**
 * Permission-gating + behavior tests for competition-invite-fns source
 * endpoints (createInviteSourceFn, updateInviteSourceFn, deleteInviteSourceFn).
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
        async (ctx: { data: unknown }) =>
          fn({ data: parser(ctx.data) }),
    }),
    // Some fns skip `inputValidator` and call `.handler` directly.
    handler:
      (fn: (...args: unknown[]) => Promise<unknown>) =>
      async (...args: unknown[]) =>
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

  it("creates the source on the happy path and forwards every field to the helper", async () => {
    // championship lookup → team_a; source lookup → team_a (same-org).
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { createInviteSourceFn } = await import(
      "@/server-fns/competition-invite-fns"
    )
    const sourcesMod = await import("@/server/competition-invites/sources")

    const result = (await (
      createInviteSourceFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ source: { id: string } }>
    )({
      data: {
        championshipCompetitionId: "comp_champ",
        kind: "competition",
        sourceCompetitionId: "comp_src",
        directSpotsPerComp: 3,
        divisionMappings: [
          {
            sourceDivisionId: "div_src_rx",
            championshipDivisionId: "div_chmp_rx",
            spots: 2,
          },
        ],
        notes: "Top 3 from RX",
      },
    })) as { source: { id: string } }

    expect(result.source.id).toBe("cisrc_new")
    expect(sourcesMod.createSource).toHaveBeenCalledWith(
      expect.objectContaining({
        championshipCompetitionId: "comp_champ",
        kind: "competition",
        sourceCompetitionId: "comp_src",
        directSpotsPerComp: 3,
        notes: "Top 3 from RX",
      }),
    )
  })

  it('rejects kind="competition" with no sourceCompetitionId', async () => {
    lookupQueue.push([{ organizingTeamId: "team_a" }])

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
          // sourceCompetitionId omitted on purpose
        },
      }),
    ).rejects.toThrow(/requires sourceCompetitionId/i)
  })

  it('rejects kind="series" with no sourceGroupId, even when a benign sourceCompetitionId is present', async () => {
    // The reference target is resolved via `kind` — not by guessing
    // "whichever id is set" — so a series request can't be tricked into
    // taking the competition-side permission lookup. Asserts the
    // attacker-controlled-id bypass is closed.
    lookupQueue.push([{ organizingTeamId: "team_a" }])

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
          kind: "series",
          sourceCompetitionId: "comp_friendly",
          // sourceGroupId omitted: the handler should still reject.
        },
      }),
    ).rejects.toThrow(/requires sourceGroupId/i)
  })
})

describe("updateInviteSourceFn", () => {
  beforeEach(() => {
    lookupQueue.length = 0
  })

  it("rejects unauthenticated callers", async () => {
    const auth = await import("@/utils/auth")
    vi.mocked(auth.getSessionFromCookie).mockResolvedValueOnce(null)

    const { updateInviteSourceFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        updateInviteSourceFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { id: "cisrc_a", championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/not authenticated/i)
  })

  it("throws Source not found when getSourceById returns null", async () => {
    const sourcesMod = await import("@/server/competition-invites/sources")
    vi.mocked(sourcesMod.getSourceById).mockResolvedValueOnce(null)

    const { updateInviteSourceFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        updateInviteSourceFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { id: "cisrc_missing", championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/Source not found/)
  })

  it("rejects when the existing source belongs to a different championship", async () => {
    // Anti-tampering: a caller with manage_competitions on championship A
    // must not be able to mutate sources owned by championship B by
    // pasting the source id into a request scoped to A.
    const sourcesMod = await import("@/server/competition-invites/sources")
    vi.mocked(sourcesMod.getSourceById).mockResolvedValueOnce({
      id: "cisrc_a",
      championshipCompetitionId: "comp_other",
      kind: "competition",
      sourceCompetitionId: "comp_src",
      sourceGroupId: null,
    } as unknown as Awaited<ReturnType<typeof sourcesMod.getSourceById>>)

    const { updateInviteSourceFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        updateInviteSourceFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { id: "cisrc_a", championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/does not belong/i)
  })

  it("re-checks the *new* reference target when the caller changes the source link", async () => {
    // Caller asks to flip kind/sourceCompetitionId on an existing source.
    // The handler must re-derive the source-side permission lookup against
    // the new id, not the old one — otherwise a permitted edit could swap
    // in a competition the caller can't manage.
    const sourcesMod = await import("@/server/competition-invites/sources")
    vi.mocked(sourcesMod.getSourceById).mockResolvedValueOnce({
      id: "cisrc_a",
      championshipCompetitionId: "comp_champ",
      kind: "competition",
      sourceCompetitionId: "comp_old",
      sourceGroupId: null,
    } as unknown as Awaited<ReturnType<typeof sourcesMod.getSourceById>>)
    // championship lookup → team_a (caller can manage)
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    // NEW source lookup → team_c (caller cannot manage)
    lookupQueue.push([{ organizingTeamId: "team_c" }])

    const { updateInviteSourceFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        updateInviteSourceFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          id: "cisrc_a",
          championshipCompetitionId: "comp_champ",
          kind: "competition",
          sourceCompetitionId: "comp_new", // attempts to swap in a foreign competition
        },
      }),
    ).rejects.toThrow(/permission/i)
  })

  it("calls updateSource with the resolved field set on the happy path", async () => {
    const sourcesMod = await import("@/server/competition-invites/sources")
    vi.mocked(sourcesMod.getSourceById).mockResolvedValueOnce({
      id: "cisrc_a",
      championshipCompetitionId: "comp_champ",
      kind: "competition",
      sourceCompetitionId: "comp_src",
      sourceGroupId: null,
    } as unknown as Awaited<ReturnType<typeof sourcesMod.getSourceById>>)
    // championship lookup, then source lookup — both same-org.
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { updateInviteSourceFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await (
      updateInviteSourceFn as unknown as (ctx: {
        data: unknown
      }) => Promise<unknown>
    )({
      data: {
        id: "cisrc_a",
        championshipCompetitionId: "comp_champ",
        kind: "competition",
        sourceCompetitionId: "comp_src",
        directSpotsPerComp: 5,
        notes: "updated",
      },
    })

    expect(sourcesMod.updateSource).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cisrc_a",
        kind: "competition",
        sourceCompetitionId: "comp_src",
        directSpotsPerComp: 5,
        notes: "updated",
      }),
    )
  })
})

describe("deleteInviteSourceFn", () => {
  beforeEach(() => {
    lookupQueue.length = 0
  })

  it("rejects callers without MANAGE_COMPETITIONS on the championship", async () => {
    lookupQueue.push([{ organizingTeamId: "team_c" }])

    const { deleteInviteSourceFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        deleteInviteSourceFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { id: "cisrc_a", championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/permission/i)
  })

  it("delegates to the deleteSource helper and returns ok on the happy path", async () => {
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const sourcesMod = await import("@/server/competition-invites/sources")
    vi.mocked(sourcesMod.deleteSource).mockResolvedValueOnce(true)

    const { deleteInviteSourceFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = (await (
      deleteInviteSourceFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ ok: true }>
    )({
      data: { id: "cisrc_a", championshipCompetitionId: "comp_champ" },
    })) as { ok: true }

    expect(result).toEqual({ ok: true })
    expect(sourcesMod.deleteSource).toHaveBeenCalledWith({
      id: "cisrc_a",
      championshipCompetitionId: "comp_champ",
    })
  })

  it("returns ok:true even when the row was already deleted (helper returns false)", async () => {
    // Idempotent delete: a second click shouldn't surface as an error.
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const sourcesMod = await import("@/server/competition-invites/sources")
    vi.mocked(sourcesMod.deleteSource).mockResolvedValueOnce(false)

    const { deleteInviteSourceFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = (await (
      deleteInviteSourceFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ ok: true }>
    )({
      data: { id: "cisrc_a", championshipCompetitionId: "comp_champ" },
    })) as { ok: true }

    expect(result).toEqual({ ok: true })
  })
})
