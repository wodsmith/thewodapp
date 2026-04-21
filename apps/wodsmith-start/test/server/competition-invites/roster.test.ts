import { describe, expect, it } from "vitest"
import type { CompetitionInviteSource } from "@/db/schemas/competition-invites"
import {
  aggregateQualifyingRows,
  parseDivisionMappings,
  resolveSourceDivisionId,
  resolveSpotsForDivision,
  type RosterRow,
} from "@/server/competition-invites/roster"

const baseSource = (
  overrides: Partial<CompetitionInviteSource>,
): CompetitionInviteSource => ({
  id: "cisrc_1",
  championshipCompetitionId: "comp_champ",
  kind: "competition",
  sourceCompetitionId: "comp_src",
  sourceGroupId: null,
  directSpotsPerComp: null,
  globalSpots: 3,
  divisionMappings: null,
  sortOrder: 0,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  updateCounter: 0,
  ...overrides,
})

const baseRow = (
  overrides: Partial<Omit<RosterRow, "belowCutoff">>,
): Omit<RosterRow, "belowCutoff"> => ({
  sourcePlacement: 1,
  sourcePlacementLabel: "1st",
  sourceId: "cisrc_1",
  sourceKind: "competition",
  sourceCompetitionId: "comp_src",
  userId: "usr_a",
  athleteName: "A",
  championshipDivisionId: "div_rxm",
  inviteId: null,
  inviteStatus: null,
  roundId: null,
  roundNumber: null,
  ...overrides,
})

describe("parseDivisionMappings", () => {
  it("parses valid JSON", () => {
    const out = parseDivisionMappings(
      JSON.stringify([
        { sourceDivisionId: "a", championshipDivisionId: "b", spots: 5 },
      ]),
    )
    expect(out).toHaveLength(1)
    expect(out[0].spots).toBe(5)
  })
  it("returns [] for null / malformed", () => {
    expect(parseDivisionMappings(null)).toEqual([])
    expect(parseDivisionMappings("not json")).toEqual([])
    expect(parseDivisionMappings("{}")).toEqual([])
  })
})

describe("resolveSourceDivisionId", () => {
  it("returns mapped source division", () => {
    expect(
      resolveSourceDivisionId(
        [{ sourceDivisionId: "s1", championshipDivisionId: "c1" }],
        "c1",
      ),
    ).toBe("s1")
  })
  it("returns null when no mapping", () => {
    expect(resolveSourceDivisionId([], "c1")).toBeNull()
  })
})

describe("resolveSpotsForDivision", () => {
  it("uses per-mapping spots when present", () => {
    const source = baseSource({ globalSpots: 2 })
    expect(
      resolveSpotsForDivision({
        source,
        mappings: [
          { sourceDivisionId: "s", championshipDivisionId: "c", spots: 7 },
        ],
        championshipDivisionId: "c",
      }),
    ).toBe(7)
  })
  it("falls back to globalSpots", () => {
    const source = baseSource({ globalSpots: 4 })
    expect(
      resolveSpotsForDivision({
        source,
        mappings: [],
        championshipDivisionId: "c",
      }),
    ).toBe(4)
  })
})

describe("aggregateQualifyingRows", () => {
  it("assigns belowCutoff once qualifiedCount reaches cutoff", () => {
    const out = aggregateQualifyingRows([
      {
        source: baseSource({ globalSpots: 2 }),
        rows: [
          baseRow({ userId: "u1", athleteName: "A" }),
          baseRow({ userId: "u2", athleteName: "B" }),
          baseRow({ userId: "u3", athleteName: "C" }),
        ],
        cutoff: 2,
      },
    ])
    expect(out.map((r) => r.belowCutoff)).toEqual([false, false, true])
  })

  it("skips athletes already qualified from a higher-priority source", () => {
    const s1 = baseSource({ id: "cisrc_1", sortOrder: 0 })
    const s2 = baseSource({ id: "cisrc_2", sortOrder: 1 })
    const out = aggregateQualifyingRows([
      {
        source: s2,
        rows: [baseRow({ userId: "u1", sourceId: "cisrc_2" })],
        cutoff: 5,
      },
      {
        source: s1,
        rows: [
          baseRow({ userId: "u1", sourceId: "cisrc_1" }),
          baseRow({ userId: "u2", sourceId: "cisrc_1" }),
        ],
        cutoff: 5,
      },
    ])
    // Higher-priority (lower sortOrder) s1 should process first; u1
    // should then not reappear under s2.
    expect(out.map((r) => ({ user: r.userId, src: r.sourceId }))).toEqual([
      { user: "u1", src: "cisrc_1" },
      { user: "u2", src: "cisrc_1" },
    ])
  })

  it("sorts sources by sortOrder before aggregation", () => {
    const s1 = baseSource({ id: "cisrc_1", sortOrder: 10 })
    const s2 = baseSource({ id: "cisrc_2", sortOrder: 0 })
    const out = aggregateQualifyingRows([
      {
        source: s1,
        rows: [baseRow({ userId: "u1", sourceId: "cisrc_1" })],
        cutoff: 1,
      },
      {
        source: s2,
        rows: [baseRow({ userId: "u2", sourceId: "cisrc_2" })],
        cutoff: 1,
      },
    ])
    expect(out.map((r) => r.sourceId)).toEqual(["cisrc_2", "cisrc_1"])
  })
})
