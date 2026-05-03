// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChampionshipRosterTable } from "@/components/organizer/invites/championship-roster-table"
import { COMPETITION_INVITE_STATUS } from "@/db/schemas/competition-invites"
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

  it("keeps a pending-invited row's checkbox enabled so the organizer can re-send", () => {
    const pendingRow = row({
      athleteName: "Ada Lovelace",
      athleteEmail: "ada@example.com",
    })
    render(
      <ChampionshipRosterTable
        rows={[pendingRow]}
        selectedKeys={new Set()}
        onToggleSelection={vi.fn()}
        onToggleAll={vi.fn()}
        getInviteStatusForRow={() => COMPETITION_INVITE_STATUS.PENDING}
        getInviteSendCountForRow={() => 1}
      />,
    )

    const checkbox = screen.getByRole("checkbox", { name: /Select Ada/i })
    expect(checkbox).not.toBeDisabled()
  })

  it("locks an accepted_paid row from re-invite (athlete already registered)", () => {
    const registeredRow = row({
      athleteName: "Grace Hopper",
      athleteEmail: "grace@example.com",
    })
    render(
      <ChampionshipRosterTable
        rows={[registeredRow]}
        selectedKeys={new Set()}
        onToggleSelection={vi.fn()}
        onToggleAll={vi.fn()}
        getInviteStatusForRow={() => COMPETITION_INVITE_STATUS.ACCEPTED_PAID}
        getInviteSendCountForRow={() => 1}
      />,
    )

    const checkbox = screen.getByRole("checkbox", { name: /Select Grace/i })
    expect(checkbox).toBeDisabled()
    expect(checkbox).toHaveAttribute(
      "title",
      expect.stringMatching(/already registered/i),
    )
  })

  it("renders the 'Invited Nx' badge once the row has been sent more than once", () => {
    const reinvitedRow = row({
      athleteName: "Ada Lovelace",
      athleteEmail: "ada@example.com",
    })
    render(
      <ChampionshipRosterTable
        rows={[reinvitedRow]}
        getInviteStatusForRow={() => COMPETITION_INVITE_STATUS.PENDING}
        getInviteSendCountForRow={() => 3}
      />,
    )

    expect(screen.getByText("3×")).toBeInTheDocument()
    expect(screen.getByTitle("Invited 3 times")).toBeInTheDocument()
  })
})
