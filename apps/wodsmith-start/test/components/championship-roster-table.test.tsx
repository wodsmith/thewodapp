// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ChampionshipRosterTable } from "@/components/organizer/invites/championship-roster-table"
import type { RosterRow } from "@/server/competition-invites/roster"

const row = (overrides: Partial<RosterRow>): RosterRow => ({
  sourcePlacement: 1,
  sourceId: "cisrc_1",
  sourceKind: "competition",
  sourceCompetitionId: "comp_src",
  sourceCompetitionName: "SLC Throwdown",
  sourceDivisionId: "div_rxm",
  sourceDivisionLabel: "RX Men",
  userId: "usr_a",
  athleteName: "Ada Lovelace",
  athleteEmail: null,
  inviteId: null,
  inviteStatus: null,
  roundId: null,
  roundNumber: null,
  ...overrides,
})

describe("ChampionshipRosterTable", () => {
  it("renders the empty state when no rows", () => {
    render(<ChampionshipRosterTable rows={[]} />)
    expect(screen.getByText(/no qualifying rows/i)).toBeInTheDocument()
  })

  it("renders rows with athlete names and source columns", () => {
    render(
      <ChampionshipRosterTable
        rows={[
          row({ athleteName: "Ada Lovelace", sourcePlacement: 1 }),
          row({
            athleteName: "Grace Hopper",
            sourcePlacement: 2,
            userId: "usr_b",
          }),
        ]}
      />,
    )
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument()
    expect(screen.getAllByText("SLC Throwdown")).toHaveLength(2)
    expect(screen.getAllByText("RX Men")).toHaveLength(2)
  })
})
