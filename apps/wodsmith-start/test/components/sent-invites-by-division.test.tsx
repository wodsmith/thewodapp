// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SentInvitesByDivision } from "@/components/organizer/invites/sent-invites-by-division"
import type { AuditInviteSummary } from "@/server-fns/competition-invite-fns"

const baseInvite = (
  overrides: Partial<AuditInviteSummary>,
): AuditInviteSummary => ({
  id: "inv_1",
  email: "athlete@example.com",
  origin: "source",
  status: "pending",
  championshipDivisionId: "div_rxm",
  activeMarker: "active",
  bespokeReason: null,
  sourcePlacementLabel: "1st — SLC Throwdown · RX Men",
  inviteeFirstName: "Ada",
  inviteeLastName: "Lovelace",
  userId: "usr_a",
  claimUrl: "https://example.com/compete/champ/claim/tok_1",
  divisionLabel: "RX Men",
  lastUpdatedAt: new Date("2026-04-20T12:00:00Z"),
  ...overrides,
})

const divisions = [
  { id: "div_rxm", label: "RX Men" },
  { id: "div_rxw", label: "RX Women" },
] as const

describe("SentInvitesByDivision", () => {
  it("renders one card per division", () => {
    render(<SentInvitesByDivision invites={[]} divisions={divisions} />)
    expect(screen.getByText("RX Men")).toBeInTheDocument()
    expect(screen.getByText("RX Women")).toBeInTheDocument()
  })

  it("shows empty-state copy when a division has no matching invites", () => {
    render(<SentInvitesByDivision invites={[]} divisions={divisions} />)
    const emptyCells = screen.getAllByText(
      /No invites in this division match the current filters/i,
    )
    expect(emptyCells).toHaveLength(2)
  })

  it("hides the copy-link button for terminal rows without a claim URL", () => {
    render(
      <SentInvitesByDivision
        invites={[
          baseInvite({
            id: "inv_pending",
            email: "pending@example.com",
            inviteeFirstName: "Pending",
            inviteeLastName: "Athlete",
            status: "pending",
            claimUrl: "https://example.com/claim/live",
          }),
          baseInvite({
            id: "inv_declined",
            email: "declined@example.com",
            inviteeFirstName: "Declined",
            inviteeLastName: "Athlete",
            status: "declined",
            activeMarker: null,
            claimUrl: null,
          }),
        ]}
        divisions={divisions}
      />,
    )

    const copyButtons = screen.getAllByLabelText("Copy invite link")
    // Only the pending row exposes the copy button.
    expect(copyButtons).toHaveLength(1)
  })

  it("filter chip narrows visible rows without removing division cards", () => {
    render(
      <SentInvitesByDivision
        invites={[
          baseInvite({
            id: "inv_pending",
            email: "pending@example.com",
            inviteeFirstName: "Pending",
            inviteeLastName: "Athlete",
            status: "pending",
          }),
          baseInvite({
            id: "inv_declined",
            email: "declined@example.com",
            inviteeFirstName: "Declined",
            inviteeLastName: "Athlete",
            status: "declined",
            activeMarker: null,
            claimUrl: null,
          }),
        ]}
        divisions={divisions}
      />,
    )

    // Both rows visible up front.
    expect(screen.getByText("Pending Athlete")).toBeInTheDocument()
    expect(screen.getByText("Declined Athlete")).toBeInTheDocument()

    // Click the page-level "Declined" filter chip (in the toolbar above
    // the cards). The CounterChip in each card header also carries the
    // same label, so we scope to the toolbar via the aria-label search.
    const declinedToolbarChip = screen.getAllByRole("button", {
      name: "Declined",
    })[0]
    fireEvent.click(declinedToolbarChip)

    // Pending row hidden, declined row still visible.
    expect(screen.queryByText("Pending Athlete")).not.toBeInTheDocument()
    expect(screen.getByText("Declined Athlete")).toBeInTheDocument()

    // Both division cards still rendered (one with a row, the other
    // with the empty-state copy).
    expect(screen.getByText("RX Men")).toBeInTheDocument()
    expect(screen.getByText("RX Women")).toBeInTheDocument()
    const emptyCells = screen.getAllByText(
      /No invites in this division match the current filters/i,
    )
    expect(emptyCells.length).toBeGreaterThanOrEqual(1)
  })

  it("free-text search narrows by email or name across divisions", () => {
    render(
      <SentInvitesByDivision
        invites={[
          baseInvite({
            id: "inv_a",
            email: "ada@example.com",
            inviteeFirstName: "Ada",
            inviteeLastName: "Lovelace",
            championshipDivisionId: "div_rxm",
          }),
          baseInvite({
            id: "inv_b",
            email: "grace@example.com",
            inviteeFirstName: "Grace",
            inviteeLastName: "Hopper",
            championshipDivisionId: "div_rxw",
          }),
        ]}
        divisions={divisions}
      />,
    )

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument()

    const searchInput = screen.getByLabelText(
      "Search invites by name or email",
    )
    fireEvent.change(searchInput, { target: { value: "grace" } })

    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument()
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument()
  })

  it("counter chip in the card header reflects unfiltered totals", () => {
    render(
      <SentInvitesByDivision
        invites={[
          baseInvite({
            id: "inv_pending",
            email: "p@example.com",
            inviteeFirstName: "P",
            inviteeLastName: "One",
            status: "pending",
            championshipDivisionId: "div_rxm",
          }),
          baseInvite({
            id: "inv_accepted",
            email: "a@example.com",
            inviteeFirstName: "A",
            inviteeLastName: "Two",
            status: "accepted_paid",
            championshipDivisionId: "div_rxm",
          }),
        ]}
        divisions={divisions}
      />,
    )

    // Counter chips render as buttons with "Pending 1" / "Accepted 1".
    // The toolbar `Pending` and `Accepted` chips don't carry counts,
    // so a name regex with the count uniquely targets the per-card
    // counter chips. RX Men has 2 invites; RX Women has 0 — only the
    // RX Men card carries non-zero pending/accepted counters.
    expect(
      screen.getByRole("button", { name: /Pending\s*1/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Accepted\s*1/ }),
    ).toBeInTheDocument()
  })
})
