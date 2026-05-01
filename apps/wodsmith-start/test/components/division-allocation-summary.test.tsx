// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DivisionAllocationSummary } from "@/components/organizer/invites/division-allocation-summary"
import type { CompetitionInviteSource } from "@/db/schemas/competition-invites"

function source(
  overrides: Partial<CompetitionInviteSource> & { id: string },
): CompetitionInviteSource {
  return {
    championshipCompetitionId: "champ_1",
    kind: "competition",
    sourceCompetitionId: null,
    sourceGroupId: null,
    directSpotsPerComp: null,
    globalSpots: null,
    divisionMappings: null,
    sortOrder: 0,
    notes: null,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-01T00:00:00Z"),
    updateCounter: 0,
    ...overrides,
  }
}

const divisions = [
  { id: "div_rxm", label: "Men's RX" },
  { id: "div_rxw", label: "Women's RX" },
] as const

describe("DivisionAllocationSummary", () => {
  it("renders the championship total across all divisions", () => {
    const sources = [
      source({
        id: "src_series",
        kind: "series",
        sourceGroupId: "grp_throwdown",
      }),
      source({
        id: "src_comp",
        kind: "competition",
        sourceCompetitionId: "comp_global",
      }),
    ]
    render(
      <DivisionAllocationSummary
        divisions={divisions}
        sources={sources}
        allocationsBySourceByDivision={{
          src_series: { div_rxm: 5, div_rxw: 5 },
          src_comp: { div_rxm: 3, div_rxw: 3 },
        }}
        seriesNamesById={{ grp_throwdown: "2025 Throwdown Series" }}
        competitionNamesById={{ comp_global: "Global Leaderboard" }}
      />,
    )
    // 5 + 5 + 3 + 3 = 16
    expect(screen.getByText("16")).toBeInTheDocument()
  })

  it("isolates each source's per-division spots in the breakdown", () => {
    const sources = [
      source({
        id: "src_series",
        kind: "series",
        sourceGroupId: "grp_throwdown",
      }),
      source({
        id: "src_comp",
        kind: "competition",
        sourceCompetitionId: "comp_global",
      }),
    ]
    render(
      <DivisionAllocationSummary
        divisions={divisions}
        sources={sources}
        allocationsBySourceByDivision={{
          // Series gives Men's RX 5 spots; Competition source gives 7 (override).
          src_series: { div_rxm: 5, div_rxw: 5 },
          src_comp: { div_rxm: 7, div_rxw: 4 },
        }}
        seriesNamesById={{ grp_throwdown: "2025 Throwdown Series" }}
        competitionNamesById={{ comp_global: "Global Leaderboard" }}
      />,
    )

    // Click the Men's RX trigger to expand its breakdown.
    const trigger = screen.getByRole("button", {
      name: /Men's RX:\s*12 spots/i,
    })
    fireEvent.click(trigger)

    // Both sources appear with their independent spot counts (5 and 7).
    expect(screen.getByText("2025 Throwdown Series")).toBeInTheDocument()
    expect(screen.getByText("Global Leaderboard")).toBeInTheDocument()
  })

  it("hides sources that contribute zero spots from the breakdown", () => {
    const sources = [
      source({
        id: "src_series",
        kind: "series",
        sourceGroupId: "grp_throwdown",
      }),
      source({
        id: "src_zero",
        kind: "competition",
        sourceCompetitionId: "comp_zero",
      }),
    ]
    render(
      <DivisionAllocationSummary
        divisions={[{ id: "div_rxm", label: "Men's RX" }]}
        sources={sources}
        allocationsBySourceByDivision={{
          src_series: { div_rxm: 5 },
          src_zero: { div_rxm: 0 },
        }}
        seriesNamesById={{ grp_throwdown: "2025 Throwdown Series" }}
        competitionNamesById={{ comp_zero: "Excluded Comp" }}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: /Men's RX:\s*5 spots/i }),
    )
    expect(screen.getByText("2025 Throwdown Series")).toBeInTheDocument()
    expect(screen.queryByText("Excluded Comp")).not.toBeInTheDocument()
  })

  it("disables the toggle when a division has no contributing sources", () => {
    render(
      <DivisionAllocationSummary
        divisions={[{ id: "div_team", label: "Team RX" }]}
        sources={[
          source({
            id: "src_series",
            kind: "series",
            sourceGroupId: "grp_throwdown",
          }),
        ]}
        allocationsBySourceByDivision={{ src_series: {} }}
        seriesNamesById={{ grp_throwdown: "2025 Throwdown Series" }}
      />,
    )

    const trigger = screen.getByRole("button", {
      name: /Team RX: 0 spots/i,
    })
    expect(trigger).toBeDisabled()
  })

  it("renders the empty-state copy when no divisions are provided", () => {
    render(
      <DivisionAllocationSummary
        divisions={[]}
        sources={[]}
        allocationsBySourceByDivision={{}}
      />,
    )
    expect(
      screen.getByText(/no divisions yet/i),
    ).toBeInTheDocument()
  })

  it("shows the per-division resolved total in the trigger row", () => {
    render(
      <DivisionAllocationSummary
        divisions={[{ id: "div_rxm", label: "Men's RX" }]}
        sources={[
          source({
            id: "src_series",
            kind: "series",
            sourceGroupId: "grp_throwdown",
          }),
        ]}
        allocationsBySourceByDivision={{ src_series: { div_rxm: 5 } }}
        seriesNamesById={{ grp_throwdown: "2025 Throwdown Series" }}
      />,
    )
    const trigger = screen.getByRole("button", {
      name: /Men's RX:\s*5 spots/i,
    })
    expect(within(trigger).getByText("5")).toBeInTheDocument()
  })
})
