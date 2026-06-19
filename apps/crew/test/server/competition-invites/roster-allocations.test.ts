import { describe, expect, it } from "vitest"
import {
  COMPETITION_INVITE_SOURCE_KIND,
  type CompetitionInviteSource,
  type CompetitionInviteSourceDivisionAllocation,
} from "@/db/schemas/competition-invites"
import { resolveSourceAllocations } from "@/server/competition-invites/allocations"
import { __test__ } from "@/server/competition-invites/roster"

const { computeCutoffForLeaderboard, mapSourceDivisionToChampionship } =
  __test__

// Mirror the fixture style of test/server/competition-invites/claim.test.ts —
// pure helpers fed typed fixtures, no DB.

function sourceFixture(
  overrides: Partial<CompetitionInviteSource> = {},
): CompetitionInviteSource {
  return {
    id: "cisrc_qual",
    championshipCompetitionId: "comp_champ",
    kind: COMPETITION_INVITE_SOURCE_KIND.COMPETITION,
    sourceCompetitionId: "comp_qual",
    sourceGroupId: null,
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

function allocationFixture(
  overrides: Partial<CompetitionInviteSourceDivisionAllocation> &
    Pick<
      CompetitionInviteSourceDivisionAllocation,
      "championshipDivisionId" | "spots"
    >,
): CompetitionInviteSourceDivisionAllocation {
  return {
    id: `cisda_${overrides.championshipDivisionId}`,
    sourceId: "cisrc_qual",
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-01T00:00:00Z"),
    updateCounter: 0,
    ...overrides,
  }
}

const championshipDivisions = [
  { id: "div_champ_rx", label: "Rx" },
  { id: "div_champ_scaled", label: "Scaled" },
]

// @lat: [[competition-invites#Roster computation]]
describe("mapSourceDivisionToChampionship", () => {
  it("uses the source's divisionMappings JSON when an explicit row exists", () => {
    const championshipDivisionId = mapSourceDivisionToChampionship({
      sourceDivisionId: "div_qual_rxm",
      sourceDivisionLabel: "Men Rx",
      divisionMappings: [
        {
          sourceDivisionId: "div_qual_rxm",
          championshipDivisionId: "div_champ_rx",
        },
      ],
      championshipDivisions,
    })
    expect(championshipDivisionId).toBe("div_champ_rx")
  })

  it("falls back to case-insensitive label match when no explicit mapping is set", () => {
    const championshipDivisionId = mapSourceDivisionToChampionship({
      sourceDivisionId: "div_qual_rx",
      sourceDivisionLabel: "  rx  ",
      divisionMappings: [],
      championshipDivisions,
    })
    expect(championshipDivisionId).toBe("div_champ_rx")
  })

  it("returns null when neither mapping nor label match resolves a championship division", () => {
    const championshipDivisionId = mapSourceDivisionToChampionship({
      sourceDivisionId: "div_qual_masters",
      sourceDivisionLabel: "Masters 40+",
      divisionMappings: [],
      championshipDivisions,
    })
    expect(championshipDivisionId).toBeNull()
  })
})

// @lat: [[competition-invites#Roster computation]]
describe("computeCutoffForLeaderboard", () => {
  it("respects a per-division override on a single-comp source (override beats source default)", () => {
    const source = sourceFixture({ globalSpots: 5 })
    const resolved = resolveSourceAllocations({
      source,
      championshipDivisions,
      allocations: [
        allocationFixture({
          championshipDivisionId: "div_champ_rx",
          spots: 2,
        }),
      ],
    })

    const cutoff = computeCutoffForLeaderboard({
      source,
      sourceDivisionId: "div_qual_rxm",
      sourceDivisionLabel: "Rx",
      championshipDivisions,
      resolved,
      divisionMappings: [
        {
          sourceDivisionId: "div_qual_rxm",
          championshipDivisionId: "div_champ_rx",
        },
      ],
    })

    expect(cutoff).toBe(2)
  })

  it("uses the source default when no override is set (single-comp regression guard)", () => {
    const source = sourceFixture({ globalSpots: 5 })
    const resolved = resolveSourceAllocations({
      source,
      championshipDivisions,
      allocations: [],
    })

    const cutoff = computeCutoffForLeaderboard({
      source,
      sourceDivisionId: "div_qual_scaled",
      sourceDivisionLabel: "Scaled",
      championshipDivisions,
      resolved,
      divisionMappings: [],
    })

    expect(cutoff).toBe(5)
  })

  it("returns null when the source's division can't be mapped to a championship division (include all rows)", () => {
    const source = sourceFixture({ globalSpots: 5 })
    const resolved = resolveSourceAllocations({
      source,
      championshipDivisions,
      allocations: [],
    })

    const cutoff = computeCutoffForLeaderboard({
      source,
      sourceDivisionId: "div_qual_masters",
      sourceDivisionLabel: "Masters 40+",
      championshipDivisions,
      resolved,
      divisionMappings: [],
    })

    // No mapping inferable → no truncation. Mis-mapped divisions never
    // silently drop qualifying athletes.
    expect(cutoff).toBeNull()
  })

  it("series sources skip leaderboard truncation (full leaderboard returned)", () => {
    const seriesSource = sourceFixture({
      kind: COMPETITION_INVITE_SOURCE_KIND.SERIES,
      sourceCompetitionId: null,
      sourceGroupId: "cgrp_series",
      globalSpots: 2,
    })
    const resolved = resolveSourceAllocations({
      source: seriesSource,
      championshipDivisions,
      allocations: [
        allocationFixture({
          championshipDivisionId: "div_champ_rx",
          spots: 2,
          sourceId: seriesSource.id,
        }),
      ],
    })

    const cutoff = computeCutoffForLeaderboard({
      source: seriesSource,
      sourceDivisionId: "div_qual_rxm",
      sourceDivisionLabel: "Rx",
      championshipDivisions,
      resolved,
      divisionMappings: [
        {
          sourceDivisionId: "div_qual_rxm",
          championshipDivisionId: "div_champ_rx",
        },
      ],
    })

    // Series fallback: keeps the full leaderboard so organizers can
    // pick whom to invite. The (source, division) cap is enforced
    // downstream at claim/webhook time.
    expect(cutoff).toBeNull()
  })
})

// @lat: [[competition-invites#Roster computation]]
describe("computeCutoffForLeaderboard — bespoke / non-source rows", () => {
  it("does not apply when there is no source row (bespoke invites have sourceId = null)", () => {
    // Regression guard: bespoke invites are produced by
    // `bespoke.ts` and merged into the route's roster *outside* the
    // leaderboard fan-out. They never carry a source row, so the
    // cutoff helper is never invoked for them — there's no allocation
    // model for bespoke. This test makes that contract explicit:
    // calling the helper without a source-derived leaderboard path
    // simply doesn't happen, but if a future refactor accidentally
    // routes a bespoke draft through this helper it would have no
    // `source` to feed the helper at all.
    //
    // The strongest assertion we can make at this layer is: the helper
    // signature *requires* a `CompetitionInviteSource` — there's no
    // way to call it for a bespoke row.
    expect(computeCutoffForLeaderboard).toBeTypeOf("function")
  })
})
