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
    Pick<CompetitionInviteSourceDivisionAllocation, "championshipDivisionId" | "spots">,
): CompetitionInviteSourceDivisionAllocation {
  return {
    id: `cisda_${overrides.championshipDivisionId}`,
    sourceId: "cisrc_test",
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
})
