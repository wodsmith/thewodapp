/**
 * Tests for the allocation server fns: listInviteSourceAllocationsFn and
 * saveInviteSourceAllocationsFn. The allocation math (default + override
 * resolution) lives in `@/server/competition-invites/allocations`; this
 * suite covers the wiring at the server-fn boundary — auth, permission,
 * championship-divisions derivation from `competitions.settings`, and
 * the transactional upsert/delete behavior of the save endpoint.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

// ----- Mocks ---------------------------------------------------------------

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (parser: (d: unknown) => unknown) => ({
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

const lookupQueue: Array<unknown[]> = []
const txOps: Array<{ kind: "delete" | "insert"; values?: Record<string, unknown> }> = []

function makeChain() {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    async limit() {
      return lookupQueue.shift() ?? []
    },
    then(resolve: (v: unknown[]) => void) {
      const v = lookupQueue.shift() ?? []
      resolve(v)
      return Promise.resolve(v)
    },
    delete: vi.fn(() => {
      txOps.push({ kind: "delete" })
      return chain
    }),
    insert: vi.fn(() => {
      txOps.push({ kind: "insert" })
      return chain
    }),
    values: vi.fn((v: Record<string, unknown>) => {
      const last = txOps[txOps.length - 1]
      if (last) last.values = v
      return chain
    }),
    onDuplicateKeyUpdate: vi.fn(() => chain),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
    transaction: vi.fn(
      async (fn: (tx: typeof chain) => Promise<unknown>) => fn(chain),
    ),
  }
  return chain
}

vi.mock("@/db", () => ({
  getDb: () => makeChain(),
}))

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: vi.fn(),
}))

vi.mock("@/server/competition-invites/sources", () => ({
  listSourcesForChampionship: vi.fn(),
  getSourceById: vi.fn(),
}))

vi.mock("@/server/competition-invites/allocations", () => ({
  listAllocationsForChampionship: vi.fn(),
  resolveSourceAllocations: vi.fn(),
}))

vi.mock("@/lib/logging", () => ({
  withRequestContext: <T>(_ctx: unknown, fn: () => T) => fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  logEntityCreated: vi.fn(),
  logEntityUpdated: vi.fn(),
  logEntityDeleted: vi.fn(),
}))

const sessionStub = {
  userId: "user_admin",
  user: { id: "user_admin", email: "admin@example.com", role: "user" },
  teams: [
    { id: "team_a", name: "Team A", permissions: ["manage_competitions"] },
  ],
}

const sessionWithoutPermission = {
  userId: "user_member",
  user: { id: "user_member", email: "member@example.com", role: "user" },
  teams: [{ id: "team_a", name: "Team A", permissions: [] }],
}

async function getMocks() {
  const auth = await import("@/utils/auth")
  const sources = await import("@/server/competition-invites/sources")
  const allocations = await import("@/server/competition-invites/allocations")
  return { auth, sources, allocations }
}

beforeEach(() => {
  lookupQueue.length = 0
  txOps.length = 0
})

// ============================================================================
// listInviteSourceAllocationsFn
// ============================================================================

describe("listInviteSourceAllocationsFn", () => {
  it("rejects unauthenticated callers", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(null)

    const { listInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        listInviteSourceAllocationsFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/not authenticated/i)
  })

  it("rejects callers without MANAGE_COMPETITIONS", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionWithoutPermission as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { listInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        listInviteSourceAllocationsFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/permission/i)
  })

  it("throws Competition not found when the championship row is missing", async () => {
    const { auth, sources, allocations } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    // organizing team lookup
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    vi.mocked(sources.listSourcesForChampionship).mockResolvedValueOnce([])
    // The settings query returns []
    lookupQueue.push([])
    vi.mocked(allocations.listAllocationsForChampionship).mockResolvedValueOnce(
      [],
    )

    const { listInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        listInviteSourceAllocationsFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/Competition not found/)
  })

  it("returns empty allocation maps when no sources exist (still requires settings JSON)", async () => {
    const { auth, sources, allocations } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    vi.mocked(sources.listSourcesForChampionship).mockResolvedValueOnce([])
    lookupQueue.push([
      {
        settings: JSON.stringify({ divisions: { scalingGroupId: "sg_a" } }),
      },
    ])
    vi.mocked(allocations.listAllocationsForChampionship).mockResolvedValueOnce(
      [],
    )
    // championship divisions query
    lookupQueue.push([
      { id: "div_rx", label: "RX" },
      { id: "div_sc", label: "Scaled" },
    ])

    const { listInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      listInviteSourceAllocationsFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        allocationsBySourceByDivision: Record<string, Record<string, number>>
        divisionAllocationTotals: Record<string, number>
        rawAllocationsBySource: Record<
          string,
          Array<{ championshipDivisionId: string; spots: number }>
        >
      }>
    )({
      data: { championshipCompetitionId: "comp_champ" },
    })

    expect(result.allocationsBySourceByDivision).toEqual({})
    // Both divisions are present in the totals map but at zero.
    expect(result.divisionAllocationTotals).toEqual({
      div_rx: 0,
      div_sc: 0,
    })
    expect(result.rawAllocationsBySource).toEqual({})
  })

  it("returns an empty divisions list when settings has no scalingGroupId", async () => {
    const { auth, sources, allocations } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    vi.mocked(sources.listSourcesForChampionship).mockResolvedValueOnce([])
    // settings with no `divisions.scalingGroupId`
    lookupQueue.push([{ settings: JSON.stringify({}) }])
    vi.mocked(allocations.listAllocationsForChampionship).mockResolvedValueOnce(
      [],
    )
    // championship divisions query is conditional on scalingGroupId — no
    // entry needed because parseScalingGroupId returns null and the
    // handler short-circuits with an empty array.

    const { listInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      listInviteSourceAllocationsFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        divisionAllocationTotals: Record<string, number>
      }>
    )({
      data: { championshipCompetitionId: "comp_champ" },
    })

    expect(result.divisionAllocationTotals).toEqual({})
  })

  it("does not throw when settings JSON is malformed", async () => {
    const { auth, sources, allocations } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    vi.mocked(sources.listSourcesForChampionship).mockResolvedValueOnce([])
    // Garbage settings string — parseScalingGroupId catches the exception
    // and returns null. A regression that re-throws would surface here.
    lookupQueue.push([{ settings: "{not valid json" }])
    vi.mocked(allocations.listAllocationsForChampionship).mockResolvedValueOnce(
      [],
    )

    const { listInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      listInviteSourceAllocationsFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        divisionAllocationTotals: Record<string, number>
      }>
    )({
      data: { championshipCompetitionId: "comp_champ" },
    })

    expect(result.divisionAllocationTotals).toEqual({})
  })

  it("aggregates per-division totals across multiple sources", async () => {
    const { auth, sources, allocations } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const sourceA = {
      id: "cisrc_a",
      championshipCompetitionId: "comp_champ",
      kind: "competition",
      sourceCompetitionId: "comp_qual_a",
      sourceGroupId: null,
    }
    const sourceB = {
      id: "cisrc_b",
      championshipCompetitionId: "comp_champ",
      kind: "competition",
      sourceCompetitionId: "comp_qual_b",
      sourceGroupId: null,
    }
    vi.mocked(sources.listSourcesForChampionship).mockResolvedValueOnce([
      sourceA,
      sourceB,
    ] as unknown as Awaited<
      ReturnType<typeof sources.listSourcesForChampionship>
    >)
    lookupQueue.push([
      {
        settings: JSON.stringify({ divisions: { scalingGroupId: "sg_a" } }),
      },
    ])
    // Two override rows: source A → RX 3 spots; source B → Scaled 5 spots
    vi.mocked(allocations.listAllocationsForChampionship).mockResolvedValueOnce(
      [
        { sourceId: "cisrc_a", championshipDivisionId: "div_rx", spots: 3 },
        { sourceId: "cisrc_b", championshipDivisionId: "div_sc", spots: 5 },
      ] as unknown as Awaited<
        ReturnType<typeof allocations.listAllocationsForChampionship>
      >,
    )
    lookupQueue.push([
      { id: "div_rx", label: "RX" },
      { id: "div_sc", label: "Scaled" },
    ])

    vi.mocked(allocations.resolveSourceAllocations)
      .mockReturnValueOnce({
        byDivision: { div_rx: 3, div_sc: 0 },
      } as unknown as ReturnType<typeof allocations.resolveSourceAllocations>)
      .mockReturnValueOnce({
        byDivision: { div_rx: 0, div_sc: 5 },
      } as unknown as ReturnType<typeof allocations.resolveSourceAllocations>)

    const { listInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      listInviteSourceAllocationsFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        allocationsBySourceByDivision: Record<string, Record<string, number>>
        divisionAllocationTotals: Record<string, number>
        rawAllocationsBySource: Record<string, unknown[]>
      }>
    )({
      data: { championshipCompetitionId: "comp_champ" },
    })

    expect(result.divisionAllocationTotals).toEqual({
      div_rx: 3,
      div_sc: 5,
    })
    expect(result.allocationsBySourceByDivision).toEqual({
      cisrc_a: { div_rx: 3, div_sc: 0 },
      cisrc_b: { div_rx: 0, div_sc: 5 },
    })
    expect(result.rawAllocationsBySource.cisrc_a).toEqual([
      { championshipDivisionId: "div_rx", spots: 3 },
    ])
    expect(result.rawAllocationsBySource.cisrc_b).toEqual([
      { championshipDivisionId: "div_sc", spots: 5 },
    ])
  })
})

// ============================================================================
// saveInviteSourceAllocationsFn
// ============================================================================

describe("saveInviteSourceAllocationsFn", () => {
  it("rejects unauthenticated callers", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(null)

    const { saveInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        saveInviteSourceAllocationsFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { sourceId: "cisrc_a", allocations: [] },
      }),
    ).rejects.toThrow(/not authenticated/i)
  })

  it("throws Source not found when getSourceById returns null", async () => {
    const { auth, sources } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    vi.mocked(sources.getSourceById).mockResolvedValueOnce(null)

    const { saveInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        saveInviteSourceAllocationsFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { sourceId: "cisrc_missing", allocations: [] },
      }),
    ).rejects.toThrow(/Source not found/)
  })

  it("rejects callers without MANAGE_COMPETITIONS on the source's championship", async () => {
    const { auth, sources } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionWithoutPermission as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    vi.mocked(sources.getSourceById).mockResolvedValueOnce({
      id: "cisrc_a",
      championshipCompetitionId: "comp_champ",
    } as unknown as Awaited<ReturnType<typeof sources.getSourceById>>)
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { saveInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        saveInviteSourceAllocationsFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { sourceId: "cisrc_a", allocations: [] },
      }),
    ).rejects.toThrow(/permission/i)
  })

  it("rejects negative spot counts at the schema boundary", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )

    const { saveInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        saveInviteSourceAllocationsFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          sourceId: "cisrc_a",
          allocations: [
            { championshipDivisionId: "div_rx", spots: -1 },
          ],
        },
      }),
    ).rejects.toThrow()
  })

  it("rejects more than 200 allocation entries", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )

    const tooMany = Array.from({ length: 201 }, (_, i) => ({
      championshipDivisionId: `div_${i}`,
      spots: 1,
    }))

    const { saveInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        saveInviteSourceAllocationsFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { sourceId: "cisrc_a", allocations: tooMany },
      }),
    ).rejects.toThrow()
  })

  it("accepts spots=0 as a valid pinned override (distinct from null=delete)", async () => {
    const { auth, sources } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    vi.mocked(sources.getSourceById).mockResolvedValueOnce({
      id: "cisrc_a",
      championshipCompetitionId: "comp_champ",
    } as unknown as Awaited<ReturnType<typeof sources.getSourceById>>)
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { saveInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      saveInviteSourceAllocationsFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ ok: boolean }>
    )({
      data: {
        sourceId: "cisrc_a",
        allocations: [
          // 0 → upsert (override) ; null → delete row (revert to default)
          { championshipDivisionId: "div_rx", spots: 0 },
          { championshipDivisionId: "div_sc", spots: null },
        ],
      },
    })

    expect(result).toEqual({ ok: true })
    // The handler did one delete and one insert in a single transaction.
    const inserts = txOps.filter((o) => o.kind === "insert")
    const deletes = txOps.filter((o) => o.kind === "delete")
    expect(inserts).toHaveLength(1)
    expect(inserts[0].values).toMatchObject({
      sourceId: "cisrc_a",
      championshipDivisionId: "div_rx",
      spots: 0,
    })
    expect(deletes).toHaveLength(1)
  })

  it("returns ok:true with no DB writes when allocations is empty", async () => {
    const { auth, sources } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    vi.mocked(sources.getSourceById).mockResolvedValueOnce({
      id: "cisrc_a",
      championshipCompetitionId: "comp_champ",
    } as unknown as Awaited<ReturnType<typeof sources.getSourceById>>)
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { saveInviteSourceAllocationsFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      saveInviteSourceAllocationsFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ ok: boolean }>
    )({
      data: { sourceId: "cisrc_a", allocations: [] },
    })

    expect(result).toEqual({ ok: true })
    expect(txOps).toHaveLength(0)
  })
})
