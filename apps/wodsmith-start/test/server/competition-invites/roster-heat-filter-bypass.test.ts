import { beforeEach, describe, expect, it, vi } from "vitest"

// Sequential select-result queue. Each `db.select(...).from(...)...` chain
// yields the next array we push. Mirrors the pattern from
// `prior-team.test.ts` so the chain mock stays uniform across roster tests.
const selectQueue: unknown[][] = []

function makeChain(): unknown {
  const chain: Record<string, unknown> = {}
  const noop = () => chain
  for (const m of ["from", "where", "limit", "innerJoin", "leftJoin"]) {
    chain[m] = vi.fn(noop)
  }
  chain.then = (resolve: (value: unknown) => void) => {
    const next = selectQueue.shift() ?? []
    resolve(next)
    return Promise.resolve(next)
  }
  return chain
}

const fakeDb = {
  select: vi.fn(() => makeChain()),
}

vi.mock("@/db", () => ({
  getDb: vi.fn(() => fakeDb),
}))

vi.mock("cloudflare:workers", () => ({
  env: { APP_URL: "https://test.wodsmith.com" },
}))

// Mock the leaderboard so we can both inspect the args it was called with
// AND drive a deterministic set of entries through the roster pipeline.
const getCompetitionLeaderboard = vi.fn()
vi.mock("@/server/competition-leaderboard", () => ({
  getCompetitionLeaderboard: (...args: unknown[]) =>
    getCompetitionLeaderboard(...args),
}))

// Mock invite-source resolution: one competition-kind source with no
// division mappings (label match path is sufficient — we never assert on
// cutoff math here).
const listSourcesForChampionship = vi.fn()
vi.mock("@/server/competition-invites/sources", () => ({
  listSourcesForChampionship: (...args: unknown[]) =>
    listSourcesForChampionship(...args),
}))

// Mock allocations: empty list + a permissive resolver. Cutoff isn't the
// focus of this test — `roster-allocations.test.ts` already covers that.
const listAllocationsForChampionship = vi.fn()
const resolveSourceAllocations = vi.fn()
vi.mock("@/server/competition-invites/allocations", () => ({
  listAllocationsForChampionship: (...args: unknown[]) =>
    listAllocationsForChampionship(...args),
  resolveSourceAllocations: (...args: unknown[]) =>
    resolveSourceAllocations(...args),
}))

// Mock the settings parser so we don't need to construct real
// JSON-encoded competition settings — every comp's settings row resolves
// to the same scaling group.
vi.mock("@/server-fns/competition-divisions-fns", () => ({
  parseCompetitionSettings: vi.fn(() => ({
    divisions: { scalingGroupId: "sg_qual" },
  })),
}))

import {
  COMPETITION_INVITE_SOURCE_KIND,
  type CompetitionInviteSource,
} from "@/db/schemas/competition-invites"
import { getChampionshipRoster } from "@/server/competition-invites/roster"

function sourceFixture(
  overrides: Partial<CompetitionInviteSource> = {},
): CompetitionInviteSource {
  return {
    id: "cisrc_qual",
    championshipCompetitionId: "comp_champ",
    kind: COMPETITION_INVITE_SOURCE_KIND.COMPETITION,
    sourceCompetitionId: "comp_qual",
    sourceGroupId: null,
    directSpotsPerComp: null,
    globalSpots: 5,
    divisionMappings: null,
    sortOrder: 0,
    notes: null,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-01T00:00:00Z"),
    updateCounter: 0,
    ...overrides,
  }
}

beforeEach(() => {
  selectQueue.length = 0
  fakeDb.select.mockClear()
  getCompetitionLeaderboard.mockReset()
  listSourcesForChampionship.mockReset()
  listAllocationsForChampionship.mockReset()
  resolveSourceAllocations.mockReset()
})

// @lat: [[competition-invites#Roster computation]]
describe("getChampionshipRoster — bypassHeatBasedDivisionFilter wiring", () => {
  it("passes bypassHeatBasedDivisionFilter:true on every leaderboard call AND surfaces athletes from a division the leaderboard returns", async () => {
    // ----- Source fan-out -----
    // One competition-kind source pointing at one source comp.
    listSourcesForChampionship.mockResolvedValueOnce([sourceFixture()])

    // ----- Allocations -----
    // No overrides; the resolver returns an empty per-division map so the
    // cutoff helper falls through to the source default. We don't care
    // about cutoff math here — only that the leaderboard wiring is intact.
    listAllocationsForChampionship.mockResolvedValueOnce([])
    resolveSourceAllocations.mockReturnValue({ total: 0, byDivision: {} })

    // ----- DB query queue (matches roster.ts call order) -----
    // 1. resolveSourceCompetitions → directComps lookup.
    selectQueue.push([
      { id: "comp_qual", name: "Qualifier Open", groupId: null },
    ])
    // 2. resolveDivisionRefs → competition settings rows.
    selectQueue.push([{ id: "comp_qual", settings: "{}" }])
    // 3. resolveDivisionRefs → scaling levels for the source comp.
    selectQueue.push([
      {
        id: "div_qual_rx",
        label: "Rx",
        scalingGroupId: "sg_qual",
        position: 0,
      },
      {
        id: "div_qual_scaled",
        label: "Scaled",
        scalingGroupId: "sg_qual",
        position: 1,
      },
    ])
    // 4. resolveChampionshipDivisions → championship settings row.
    selectQueue.push([{ settings: "{}" }])
    // 5. resolveChampionshipDivisions → championship scaling levels.
    selectQueue.push([
      { id: "div_champ_rx", label: "Rx", position: 0 },
      { id: "div_champ_scaled", label: "Scaled", position: 1 },
    ])
    // 6. Email hydration → look up users by id.
    selectQueue.push([
      { id: "usr_a", email: "athlete-a@example.com" },
      { id: "usr_b", email: "athlete-b@example.com" },
    ])

    // ----- Leaderboard returns -----
    // Two divisions → two leaderboard calls. Return one entry per
    // division so we can assert the entry surfaces in the final rows.
    getCompetitionLeaderboard.mockImplementation(async (params: {
      competitionId: string
      divisionId: string
    }) => {
      const entry = (
        params.divisionId === "div_qual_rx"
          ? {
              registrationId: "reg_a",
              userId: "usr_a",
              athleteName: "Athlete A",
              divisionId: "div_qual_rx",
              divisionLabel: "Rx",
            }
          : {
              registrationId: "reg_b",
              userId: "usr_b",
              athleteName: "Athlete B",
              divisionId: "div_qual_scaled",
              divisionLabel: "Scaled",
            }
      ) as unknown
      return {
        entries: [entry],
        scoringConfig: {} as never,
        events: [],
      } as unknown as Awaited<
        ReturnType<typeof import("@/server/competition-leaderboard").getCompetitionLeaderboard>
      >
    })

    const result = await getChampionshipRoster({
      championshipId: "comp_champ",
    })

    // Assertion 1: every leaderboard call carries the bypass flag. This
    // is the regression guard for the missing-divisions bug — without
    // the flag, divisions whose registered athletes have no heat
    // assignments are silently zeroed by the heat-based event filter.
    expect(getCompetitionLeaderboard).toHaveBeenCalled()
    for (const call of getCompetitionLeaderboard.mock.calls) {
      const [params] = call as [{ bypassHeatBasedDivisionFilter?: boolean }]
      expect(params.bypassHeatBasedDivisionFilter).toBe(true)
    }

    // Assertion 2: rows include the athletes the leaderboard surfaced —
    // verifies the wiring through cutoff + email hydration is intact.
    const userIds = result.rows.map((r) => r.userId).sort()
    expect(userIds).toEqual(["usr_a", "usr_b"])
    const emailsByUserId = Object.fromEntries(
      result.rows.map((r) => [r.userId, r.athleteEmail]),
    )
    expect(emailsByUserId.usr_a).toBe("athlete-a@example.com")
    expect(emailsByUserId.usr_b).toBe("athlete-b@example.com")
  })
})
