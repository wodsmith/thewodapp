import { describe, expect, it } from "vitest"
import {
  COMPETITION_INVITE_SOURCE_KIND,
  type CompetitionInviteSource,
  type CompetitionInviteSourceDivisionAllocation,
} from "@/db/schemas/competition-invites"
import { resolveSourceAllocations } from "@/server/competition-invites/allocations"

function sourceFixture(
  overrides: Partial<CompetitionInviteSource> = {},
): CompetitionInviteSource {
  return {
    id: "cisrc_test",
    championshipCompetitionId: "comp_champ",
    kind: COMPETITION_INVITE_SOURCE_KIND.COMPETITION,
    sourceCompetitionId: "comp_src",
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

function allocationFixture(
  overrides: Partial<CompetitionInviteSourceDivisionAllocation> &
    Pick<CompetitionInviteSourceDivisionAllocation, "championshipDivisionId">,
): CompetitionInviteSourceDivisionAllocation {
  return {
    id: `cisda_${overrides.championshipDivisionId}`,
    sourceId: "cisrc_test",
    spots: null,
    globalSpots: null,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-01T00:00:00Z"),
    updateCounter: 0,
    ...overrides,
  }
}

const divisions = [
  { id: "div_rx", label: "Rx" },
  { id: "div_scaled", label: "Scaled" },
  { id: "div_masters", label: "Masters" },
]

// @lat: [[competition-invites#Sources schema]]
describe("resolveSourceAllocations", () => {
  it("uses globalSpots as the default for every division on a single-comp source with no overrides", () => {
    const result = resolveSourceAllocations({
      source: sourceFixture({ globalSpots: 5 }),
      championshipDivisions: divisions,
      allocations: [],
    })

    expect(result.byDivision).toEqual({
      div_rx: 5,
      div_scaled: 5,
      div_masters: 5,
    })
    expect(result.total).toBe(15)
  })

  it("applies a single per-division override and leaves the rest on default", () => {
    const result = resolveSourceAllocations({
      source: sourceFixture({ globalSpots: 5 }),
      championshipDivisions: divisions,
      allocations: [
        allocationFixture({ championshipDivisionId: "div_scaled", spots: 2 }),
      ],
    })

    expect(result.byDivision).toEqual({
      div_rx: 5,
      div_scaled: 2,
      div_masters: 5,
    })
    expect(result.total).toBe(12)
  })

  it("treats override = 0 as zero (not the default)", () => {
    const result = resolveSourceAllocations({
      source: sourceFixture({ globalSpots: 5 }),
      championshipDivisions: divisions,
      allocations: [
        allocationFixture({ championshipDivisionId: "div_masters", spots: 0 }),
      ],
    })

    expect(result.byDivision.div_masters).toBe(0)
    expect(result.byDivision.div_rx).toBe(5)
    expect(result.total).toBe(10)
  })

  it("resolves a series source with no overrides as directSpotsPerComp * seriesCompCount + globalSpots per division", () => {
    const result = resolveSourceAllocations({
      source: sourceFixture({
        kind: COMPETITION_INVITE_SOURCE_KIND.SERIES,
        sourceCompetitionId: null,
        sourceGroupId: "cgrp_series",
        directSpotsPerComp: 3,
        globalSpots: 2,
      }),
      championshipDivisions: divisions,
      allocations: [],
      seriesCompCount: 4,
    })

    // Per division: 3 * 4 + 2 = 14
    expect(result.byDivision).toEqual({
      div_rx: 14,
      div_scaled: 14,
      div_masters: 14,
    })
    expect(result.total).toBe(42)
  })

  it("falls back to 0 per division when both globalSpots and directSpotsPerComp are null", () => {
    const result = resolveSourceAllocations({
      source: sourceFixture({
        kind: COMPETITION_INVITE_SOURCE_KIND.SERIES,
        sourceCompetitionId: null,
        sourceGroupId: "cgrp_series",
        directSpotsPerComp: null,
        globalSpots: null,
      }),
      championshipDivisions: divisions,
      allocations: [],
      seriesCompCount: 4,
    })

    expect(result.byDivision).toEqual({
      div_rx: 0,
      div_scaled: 0,
      div_masters: 0,
    })
    expect(result.total).toBe(0)
  })

  it("returns total 0 and an empty map when championshipDivisions is empty", () => {
    const result = resolveSourceAllocations({
      source: sourceFixture({ globalSpots: 5 }),
      championshipDivisions: [],
      allocations: [],
    })

    expect(result.byDivision).toEqual({})
    expect(result.total).toBe(0)
  })

  it("ignores allocation rows that belong to a different source", () => {
    const result = resolveSourceAllocations({
      source: sourceFixture({ id: "cisrc_a", globalSpots: 5 }),
      championshipDivisions: divisions,
      allocations: [
        allocationFixture({
          championshipDivisionId: "div_rx",
          spots: 1,
          sourceId: "cisrc_other",
        }),
      ],
    })

    expect(result.byDivision.div_rx).toBe(5)
    expect(result.total).toBe(15)
  })

  it("applies a series per-division globalSpots override on top of directSpotsPerComp", () => {
    // Series source with `direct=3 × comps=4 + globals=2 = 14` per division.
    // RX overrides globals to 5 → 3*4 + 5 = 17. Scaled overrides globals to
    // 1 → 3*4 + 1 = 13. Masters has no row → falls back to default 14.
    const result = resolveSourceAllocations({
      source: sourceFixture({
        kind: COMPETITION_INVITE_SOURCE_KIND.SERIES,
        sourceCompetitionId: null,
        sourceGroupId: "cgrp_series",
        directSpotsPerComp: 3,
        globalSpots: 2,
      }),
      championshipDivisions: divisions,
      allocations: [
        allocationFixture({ championshipDivisionId: "div_rx", globalSpots: 5 }),
        allocationFixture({
          championshipDivisionId: "div_scaled",
          globalSpots: 1,
        }),
      ],
      seriesCompCount: 4,
    })

    expect(result.byDivision).toEqual({
      div_rx: 17,
      div_scaled: 13,
      div_masters: 14,
    })
    expect(result.total).toBe(44)
  })

  it("treats a series globalSpots override of 0 as zero global qualifiers (not the default)", () => {
    const result = resolveSourceAllocations({
      source: sourceFixture({
        kind: COMPETITION_INVITE_SOURCE_KIND.SERIES,
        sourceCompetitionId: null,
        sourceGroupId: "cgrp_series",
        directSpotsPerComp: 3,
        globalSpots: 2,
      }),
      championshipDivisions: divisions,
      allocations: [
        allocationFixture({
          championshipDivisionId: "div_scaled",
          globalSpots: 0,
        }),
      ],
      seriesCompCount: 4,
    })

    // Scaled: direct only → 3 * 4 + 0 = 12. Others: full default 14.
    expect(result.byDivision).toEqual({
      div_rx: 14,
      div_scaled: 12,
      div_masters: 14,
    })
    expect(result.total).toBe(40)
  })

  it("prefers the absolute spots override over the per-division globalSpots override on the same row", () => {
    // The row carries both axes. The resolver should treat `spots` as the
    // total override and ignore globalSpots — series sources can carry
    // both axes during transitional state, but spots wins when present.
    const result = resolveSourceAllocations({
      source: sourceFixture({
        kind: COMPETITION_INVITE_SOURCE_KIND.SERIES,
        sourceCompetitionId: null,
        sourceGroupId: "cgrp_series",
        directSpotsPerComp: 3,
        globalSpots: 2,
      }),
      championshipDivisions: divisions,
      allocations: [
        allocationFixture({
          championshipDivisionId: "div_rx",
          spots: 7,
          globalSpots: 99,
        }),
      ],
      seriesCompCount: 4,
    })

    expect(result.byDivision.div_rx).toBe(7)
    expect(result.byDivision.div_scaled).toBe(14)
  })

  it("falls back to the source default when a series row has neither spots nor globalSpots set", () => {
    // A row with both axes null behaves as if the row were absent — the
    // resolver should not crash and should return the source default for
    // every division. (`saveInviteSourceAllocationsFn` deletes such rows
    // on its own, but the resolver must remain robust.)
    const result = resolveSourceAllocations({
      source: sourceFixture({
        kind: COMPETITION_INVITE_SOURCE_KIND.SERIES,
        sourceCompetitionId: null,
        sourceGroupId: "cgrp_series",
        directSpotsPerComp: 3,
        globalSpots: 2,
      }),
      championshipDivisions: divisions,
      allocations: [allocationFixture({ championshipDivisionId: "div_rx" })],
      seriesCompCount: 4,
    })

    expect(result.byDivision).toEqual({
      div_rx: 14,
      div_scaled: 14,
      div_masters: 14,
    })
  })
})
