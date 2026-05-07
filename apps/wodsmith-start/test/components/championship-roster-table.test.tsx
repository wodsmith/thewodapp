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

  it("keeps a 'pending' row selectable so the organizer can resend", () => {
    // Use case: organizer is opening up earned spots first-come-first-serve
    // and needs to nudge previously-invited athletes that they could lose
    // their spot. Pending rows must stay selectable; the send pipeline
    // re-delivers the same claim link with a refreshed expiration date.
    const pendingRow = row({
      athleteName: "Ada Lovelace",
      athleteEmail: "ada@example.com",
      userId: "usr_a",
    })
    render(
      <ChampionshipRosterTable
        rows={[pendingRow]}
        selectedKeys={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        getInviteStatusForRow={() => "pending"}
      />,
    )
    expect(screen.getByText("Invited")).toBeInTheDocument()
    const checkbox = screen.getByRole("checkbox", { name: /Select Ada/i })
    expect(checkbox).not.toBeDisabled()
  })

  it("locks an 'accepted_paid' row — the athlete already registered", () => {
    const acceptedRow = row({
      athleteName: "Ada Lovelace",
      athleteEmail: "ada@example.com",
      userId: "usr_a",
    })
    render(
      <ChampionshipRosterTable
        rows={[acceptedRow]}
        selectedKeys={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        getInviteStatusForRow={() => "accepted_paid"}
      />,
    )
    expect(screen.getByText("Registered")).toBeInTheDocument()
    const checkbox = screen.getByRole("checkbox", { name: /Select Ada/i })
    expect(checkbox).toBeDisabled()
  })

  it("renders the invited championship division when getInvitedDivisionLabelForRow returns one", () => {
    // Organizers asked for a per-row "which championship division did
    // I invite this athlete to?" affordance so they can see who's been
    // invited to e.g. "Pro Men" vs "Masters Men" without clicking into
    // the Sent tab. Source-derived rows can map to multiple championship
    // divisions across re-runs, so the label has to come from the
    // resolved invite, not the row's source division label.
    const invitedRow = row({
      athleteName: "Ada Lovelace",
      athleteEmail: "ada@example.com",
      userId: "usr_a",
    })
    render(
      <ChampionshipRosterTable
        rows={[invitedRow]}
        selectedKeys={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        getInviteStatusForRow={() => "pending"}
        getInvitedDivisionLabelForRow={() => "Pro Men"}
      />,
    )
    expect(screen.getByText("Pro Men")).toBeInTheDocument()
  })

  it("renders an Invited Division header when the callback is supplied", () => {
    const uninvitedRow = row({
      athleteName: "Grace Hopper",
      athleteEmail: "grace@example.com",
      userId: "usr_b",
    })
    render(
      <ChampionshipRosterTable
        rows={[uninvitedRow]}
        selectedKeys={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        getInvitedDivisionLabelForRow={() => null}
      />,
    )
    expect(screen.getByText(/invited division/i)).toBeInTheDocument()
  })
})
