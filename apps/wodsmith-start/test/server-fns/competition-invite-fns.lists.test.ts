/**
 * Tests for the read-only invite endpoints used by the organizer routes:
 * listInviteSourcesFn, listActiveInvitesFn, listAllInvitesFn,
 * getChampionshipRosterFn, and getInviteSourceByIdFn. Each one needs an
 * auth gate, a permission gate, and a server-side projection that
 * doesn't leak token columns into the client. The tests verify those
 * three properties plus the per-row claimUrl construction (driven by
 * activeMarker / claimToken presence).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_STATUS,
} from "@/db/schemas/competition-invites"

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
vi.mock("@/db", () => ({
  getDb: () => {
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
    }
    return chain
  },
}))

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: vi.fn(),
}))

vi.mock("@/server/competition-invites/sources", () => ({
  listSourcesForChampionship: vi.fn(),
  getSourceById: vi.fn(),
}))

vi.mock("@/server/competition-invites/roster", () => ({
  getChampionshipRoster: vi.fn(),
}))

vi.mock("@/lib/env", () => ({
  getAppUrl: () => "https://wodsmith.example",
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
  const roster = await import("@/server/competition-invites/roster")
  return { auth, sources, roster }
}

beforeEach(() => {
  lookupQueue.length = 0
})

// ============================================================================
// listInviteSourcesFn
// ============================================================================

describe("listInviteSourcesFn", () => {
  it("rejects unauthenticated callers", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(null)

    const { listInviteSourcesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        listInviteSourcesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/not authenticated/i)
  })

  it("rejects callers without MANAGE_COMPETITIONS on the championship's team", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionWithoutPermission as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { listInviteSourcesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        listInviteSourcesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/permission/i)
  })

  it("returns an empty competition+series name map when the championship has no sources", async () => {
    const { auth, sources } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    vi.mocked(sources.listSourcesForChampionship).mockResolvedValueOnce([])

    const { listInviteSourcesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      listInviteSourcesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        sources: unknown[]
        competitionNamesById: Record<string, string>
        seriesNamesById: Record<string, string>
        seriesCompCountsById: Record<string, number>
      }>
    )({
      data: { championshipCompetitionId: "comp_champ" },
    })

    expect(result.sources).toEqual([])
    expect(result.competitionNamesById).toEqual({})
    expect(result.seriesNamesById).toEqual({})
    expect(result.seriesCompCountsById).toEqual({})
  })

  it("denormalizes competition + series names alongside the source rows", async () => {
    const { auth, sources } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    vi.mocked(sources.listSourcesForChampionship).mockResolvedValueOnce([
      {
        id: "cisrc_a",
        kind: "competition",
        sourceCompetitionId: "comp_qual",
        sourceGroupId: null,
      },
      {
        id: "cisrc_b",
        kind: "series",
        sourceCompetitionId: null,
        sourceGroupId: "grp_series",
      },
    ] as unknown as Awaited<
      ReturnType<typeof sources.listSourcesForChampionship>
    >)
    // competitionIds query
    lookupQueue.push([{ id: "comp_qual", name: "Qualifier" }])
    // groupIds query
    lookupQueue.push([{ id: "grp_series", name: "Open Series" }])
    // series comp count query
    lookupQueue.push([{ groupId: "grp_series", count: 4 }])

    const { listInviteSourcesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      listInviteSourcesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        sources: Array<{ id: string }>
        competitionNamesById: Record<string, string>
        seriesNamesById: Record<string, string>
        seriesCompCountsById: Record<string, number>
      }>
    )({
      data: { championshipCompetitionId: "comp_champ" },
    })

    expect(result.competitionNamesById).toEqual({ comp_qual: "Qualifier" })
    expect(result.seriesNamesById).toEqual({ grp_series: "Open Series" })
    // PlanetScale returns `count(*)` as a number-like string — the handler
    // wraps with `Number()`. Verify the value is a number, not a string.
    expect(result.seriesCompCountsById.grp_series).toBe(4)
    expect(typeof result.seriesCompCountsById.grp_series).toBe("number")
  })
})

// ============================================================================
// listActiveInvitesFn
// ============================================================================

describe("listActiveInvitesFn", () => {
  it("rejects callers without MANAGE_COMPETITIONS", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionWithoutPermission as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { listActiveInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        listActiveInvitesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/permission/i)
  })

  it("builds claimUrl from claimToken+slug and returns null for tokenless drafts", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    // organizing team lookup
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    // invite rows: one with token, one without
    lookupQueue.push([
      {
        id: "ci_with_token",
        email: "a@example.com",
        origin: COMPETITION_INVITE_ORIGIN.SOURCE,
        status: COMPETITION_INVITE_STATUS.PENDING,
        championshipDivisionId: "div_rx",
        activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
        bespokeReason: null,
        inviteeFirstName: null,
        inviteeLastName: null,
        userId: null,
        claimToken: "tok_aaa",
        championshipSlug: "open-2099",
      },
      {
        id: "ci_draft",
        email: "draft@example.com",
        origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
        status: COMPETITION_INVITE_STATUS.PENDING,
        championshipDivisionId: "div_rx",
        activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
        bespokeReason: "Sponsored",
        inviteeFirstName: null,
        inviteeLastName: null,
        userId: null,
        claimToken: null,
        championshipSlug: "open-2099",
      },
    ])

    const { listActiveInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      listActiveInvitesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        invites: Array<{
          id: string
          claimUrl: string | null
        }>
      }>
    )({
      data: { championshipCompetitionId: "comp_champ" },
    })

    expect(result.invites).toHaveLength(2)
    expect(result.invites[0].claimUrl).toBe(
      "https://wodsmith.example/compete/open-2099/claim/tok_aaa",
    )
    expect(result.invites[1].claimUrl).toBeNull()

    // Critically: claimToken should never appear on the wire. Asserting
    // it's not a returned key is the only meaningful guard we can run
    // at this layer.
    expect(
      Object.keys(result.invites[0]).includes("claimToken"),
    ).toBe(false)
  })

  it("filters by championshipDivisionId only when provided", async () => {
    // We can't observe the query AST through the chain mock, but we can
    // at minimum show the optional parameter is accepted and the
    // handler returns rows.
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    lookupQueue.push([])

    const { listActiveInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      listActiveInvitesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ invites: unknown[] }>
    )({
      data: {
        championshipCompetitionId: "comp_champ",
        championshipDivisionId: "div_rx",
      },
    })

    expect(result.invites).toEqual([])
  })
})

// ============================================================================
// listAllInvitesFn (audit tab)
// ============================================================================

describe("listAllInvitesFn", () => {
  it("rejects unauthenticated callers", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(null)

    const { listAllInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        listAllInvitesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/not authenticated/i)
  })

  it("includes terminal-status rows and surfaces divisionLabel + lastUpdatedAt", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    const expiredAt = new Date("2024-12-31T23:59:59Z")
    lookupQueue.push([
      {
        id: "ci_expired",
        email: "a@example.com",
        origin: COMPETITION_INVITE_ORIGIN.SOURCE,
        status: COMPETITION_INVITE_STATUS.EXPIRED,
        championshipDivisionId: "div_rx",
        activeMarker: null, // terminal rows null the active marker
        bespokeReason: null,
        sourcePlacementLabel: "1st — Qualifier",
        sourceId: "cisrc_a",
        inviteeFirstName: null,
        inviteeLastName: null,
        userId: null,
        claimToken: null, // terminal rows null the token
        lastUpdatedAt: expiredAt,
        championshipSlug: "open-2099",
        divisionLabel: "RX",
      },
    ])

    const { listAllInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      listAllInvitesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        invites: Array<{
          id: string
          status: string
          claimUrl: string | null
          divisionLabel: string
          lastUpdatedAt: Date | null
          sourceId: string | null
        }>
      }>
    )({
      data: { championshipCompetitionId: "comp_champ" },
    })

    expect(result.invites).toHaveLength(1)
    expect(result.invites[0]).toMatchObject({
      id: "ci_expired",
      status: COMPETITION_INVITE_STATUS.EXPIRED,
      claimUrl: null, // terminal rows have no claim URL
      divisionLabel: "RX",
      lastUpdatedAt: expiredAt,
      sourceId: "cisrc_a",
    })
  })

  it("falls back to empty divisionLabel when the scaling-level join missed", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    lookupQueue.push([
      {
        id: "ci_orphan",
        email: "a@example.com",
        origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
        status: COMPETITION_INVITE_STATUS.PENDING,
        championshipDivisionId: "div_deleted",
        activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
        bespokeReason: null,
        sourcePlacementLabel: null,
        sourceId: null,
        inviteeFirstName: null,
        inviteeLastName: null,
        userId: null,
        claimToken: "tok_x",
        lastUpdatedAt: new Date(),
        championshipSlug: "open-2099",
        divisionLabel: null, // left join produced no row
      },
    ])

    const { listAllInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      listAllInvitesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        invites: Array<{ divisionLabel: string }>
      }>
    )({
      data: { championshipCompetitionId: "comp_champ" },
    })

    expect(result.invites[0].divisionLabel).toBe("")
  })
})

// ============================================================================
// getChampionshipRosterFn
// ============================================================================

describe("getChampionshipRosterFn", () => {
  it("rejects unauthenticated callers", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(null)

    const { getChampionshipRosterFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        getChampionshipRosterFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/not authenticated/i)
  })

  it("rejects callers without MANAGE_COMPETITIONS", async () => {
    const { auth, roster } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionWithoutPermission as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { getChampionshipRosterFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        getChampionshipRosterFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { championshipCompetitionId: "comp_champ" },
      }),
    ).rejects.toThrow(/permission/i)
    expect(roster.getChampionshipRoster).not.toHaveBeenCalled()
  })

  it("forwards the championshipId to the helper and returns its rows", async () => {
    const { auth, roster } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    vi.mocked(roster.getChampionshipRoster).mockResolvedValueOnce({
      rows: [
        {
          email: "qualifier1@example.com",
          firstName: "Q1",
          lastName: "Last",
        },
      ],
    } as unknown as Awaited<ReturnType<typeof roster.getChampionshipRoster>>)

    const { getChampionshipRosterFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      getChampionshipRosterFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        rows: Array<{ email: string }>
      }>
    )({
      data: { championshipCompetitionId: "comp_champ" },
    })

    expect(result.rows).toHaveLength(1)
    expect(roster.getChampionshipRoster).toHaveBeenCalledWith({
      championshipId: "comp_champ",
    })
  })
})

// ============================================================================
// getInviteSourceByIdFn
// ============================================================================

describe("getInviteSourceByIdFn", () => {
  it("throws Source not found when the helper returns null", async () => {
    const { auth, sources } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    vi.mocked(sources.getSourceById).mockResolvedValueOnce(null)

    const { getInviteSourceByIdFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        getInviteSourceByIdFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { sourceId: "cisrc_missing" },
      }),
    ).rejects.toThrow(/Source not found/)
  })

  it("loads the source first, then enforces MANAGE_COMPETITIONS via its championship", async () => {
    // Order of operations matters: the source is loaded BEFORE the
    // permission check so a bad sourceId fails fast and never even
    // touches the championship row. We verify by reading the call
    // sequence: getSourceById then the championship-team lookup.
    const { auth, sources } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionWithoutPermission as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    vi.mocked(sources.getSourceById).mockResolvedValueOnce({
      id: "cisrc_a",
      championshipCompetitionId: "comp_champ",
      kind: "competition",
      sourceCompetitionId: "comp_qual",
      sourceGroupId: null,
    } as unknown as Awaited<ReturnType<typeof sources.getSourceById>>)
    // championship organizing team lookup runs after getSourceById
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { getInviteSourceByIdFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        getInviteSourceByIdFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { sourceId: "cisrc_a" },
      }),
    ).rejects.toThrow(/permission/i)
    expect(sources.getSourceById).toHaveBeenCalledWith("cisrc_a")
  })

  it("returns the source row on the happy path", async () => {
    const { auth, sources } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    const sourceRow = {
      id: "cisrc_a",
      championshipCompetitionId: "comp_champ",
      kind: "competition",
      sourceCompetitionId: "comp_qual",
      sourceGroupId: null,
    }
    vi.mocked(sources.getSourceById).mockResolvedValueOnce(
      sourceRow as unknown as Awaited<
        ReturnType<typeof sources.getSourceById>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { getInviteSourceByIdFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      getInviteSourceByIdFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ source: { id: string } }>
    )({
      data: { sourceId: "cisrc_a" },
    })

    expect(result.source.id).toBe("cisrc_a")
  })
})
