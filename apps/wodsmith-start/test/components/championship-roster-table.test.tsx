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
  isTeamDivision: false,
  teamName: null,
  teamMembers: [],
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

  it("renders team rows with team name and members (captain marked)", () => {
    const teamRow = row({
      isTeamDivision: true,
      teamName: "Team Pegasus",
      athleteName: "Ada Lovelace",
      athleteEmail: "ada@example.com",
      teamMembers: [
        {
          userId: "usr_a",
          firstName: "Ada",
          lastName: "Lovelace",
          isCaptain: true,
        },
        {
          userId: "usr_b",
          firstName: "Grace",
          lastName: "Hopper",
          isCaptain: false,
        },
      ],
    })
    render(<ChampionshipRosterTable rows={[teamRow]} />)
    expect(screen.getByText("Team Pegasus")).toBeInTheDocument()
    expect(
      screen.getByText("Ada Lovelace (C), Grace Hopper"),
    ).toBeInTheDocument()
    // Individual athlete name should NOT be the primary label on team rows.
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument()
  })

  it("renders 'Declined' pill and keeps the row selectable", () => {
    const declinedRow = row({
      athleteName: "Ada Lovelace",
      athleteEmail: "ada@example.com",
      userId: "usr_a",
    })
    render(
      <ChampionshipRosterTable
        rows={[declinedRow]}
        selectedKeys={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        getInviteStatusForRow={() => "declined"}
      />,
    )
    expect(screen.getByText("Declined")).toBeInTheDocument()
    // Declined doesn't gate the checkbox — organizer can re-issue.
    const checkbox = screen.getByRole("checkbox", { name: /Select Ada/i })
    expect(checkbox).not.toBeDisabled()
  })
})
