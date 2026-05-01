// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  buildSentTabDivisions,
  computeAllocationMismatch,
  SentInvitesByDivision,
} from "@/components/organizer/invites/sent-invites-by-division"
import type { AuditInviteSummary } from "@/server-fns/competition-invite-fns"

// Stub the TanStack Router `Link` so the ADR-0013 mismatch warning
// renders without a real router context. Mirrors the pattern used in
// `competition-workout-card.test.tsx`. The real component otherwise
// pulls the route tree from the file-based router, which isn't
// available in a unit-test environment.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode
    to: string
    params: Record<string, string>
  }) => (
    <a href={`${to}?${new URLSearchParams(params).toString()}`}>{children}</a>
  ),
}))

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
  sourceId: "cisrc_qualifier",
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

  it("renders accepted/maxSpots ratio under each division title", () => {
    render(
      <SentInvitesByDivision
        invites={[
          baseInvite({
            id: "inv_a",
            email: "a@example.com",
            status: "accepted_paid",
            championshipDivisionId: "div_rxm",
          }),
          baseInvite({
            id: "inv_b",
            email: "b@example.com",
            status: "accepted_paid",
            championshipDivisionId: "div_rxm",
          }),
          baseInvite({
            id: "inv_c",
            email: "c@example.com",
            status: "pending",
            championshipDivisionId: "div_rxm",
          }),
        ]}
        divisions={[
          { id: "div_rxm", label: "RX Men", maxSpots: 10 },
          { id: "div_rxw", label: "RX Women", maxSpots: 8 },
        ]}
      />,
    )

    // RX Men: 2 accepted out of 10 spots.
    expect(screen.getByText("2/10 spots filled")).toBeInTheDocument()
    // RX Women: 0 accepted out of 8 spots.
    expect(screen.getByText("0/8 spots filled")).toBeInTheDocument()
  })

  it("renders per-source accepted/allocated breakdown chips under each division", () => {
    const sources = [
      {
        id: "cisrc_qualifier",
        championshipCompetitionId: "comp_champ",
        kind: "competition" as const,
        sourceCompetitionId: "comp_qualifier",
        sourceGroupId: null,
        globalSpots: 5,
        divisionMappings: null,
        sortOrder: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        updateCounter: 0,
      },
      {
        id: "cisrc_throwdown",
        championshipCompetitionId: "comp_champ",
        kind: "competition" as const,
        sourceCompetitionId: "comp_throwdown",
        sourceGroupId: null,
        globalSpots: 4,
        divisionMappings: null,
        sortOrder: 1,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        updateCounter: 0,
      },
    ]
    // ADR-0012 Phase 2: allocations now arrive as a resolved map from the
    // route loader (`listInviteSourceAllocationsFn`) rather than being
    // parsed out of `divisionMappings` JSON.
    const allocationsBySourceByDivision = {
      cisrc_qualifier: { div_rxm: 3, div_rxw: 2 },
      cisrc_throwdown: { div_rxm: 4 },
    }

    render(
      <SentInvitesByDivision
        invites={[
          // Two accepted from the qualifier in RX Men.
          baseInvite({
            id: "inv_q1",
            email: "q1@example.com",
            status: "accepted_paid",
            championshipDivisionId: "div_rxm",
            sourceId: "cisrc_qualifier",
          }),
          baseInvite({
            id: "inv_q2",
            email: "q2@example.com",
            status: "accepted_paid",
            championshipDivisionId: "div_rxm",
            sourceId: "cisrc_qualifier",
          }),
          // One accepted from the throwdown in RX Men.
          baseInvite({
            id: "inv_t1",
            email: "t1@example.com",
            status: "accepted_paid",
            championshipDivisionId: "div_rxm",
            sourceId: "cisrc_throwdown",
          }),
          // One bespoke accepted in RX Men.
          baseInvite({
            id: "inv_b1",
            email: "b1@example.com",
            status: "accepted_paid",
            championshipDivisionId: "div_rxm",
            origin: "bespoke",
            sourceId: null,
            bespokeReason: "Sponsor",
          }),
          // Pending invite shouldn't count.
          baseInvite({
            id: "inv_pending",
            email: "p@example.com",
            status: "pending",
            championshipDivisionId: "div_rxm",
            sourceId: "cisrc_qualifier",
          }),
        ]}
        divisions={[
          { id: "div_rxm", label: "RX Men", maxSpots: 10 },
          { id: "div_rxw", label: "RX Women", maxSpots: 8 },
        ]}
        sources={sources}
        competitionNamesById={{
          comp_qualifier: "Regional Qualifier",
          comp_throwdown: "Boise Throwdown",
        }}
        seriesNamesById={{}}
        allocationsBySourceByDivision={allocationsBySourceByDivision}
      />,
    )

    // RX Men breakdown chips: qualifier 2/3, throwdown 1/4, bespoke 1/—.
    expect(screen.getByText("2/3")).toBeInTheDocument()
    expect(screen.getByText("1/4")).toBeInTheDocument()
    expect(screen.getByText("1/—")).toBeInTheDocument()
    // Qualifier appears in both RX Men (with 2/3) and RX Women (with 0/2).
    expect(screen.getAllByText("Regional Qualifier")).toHaveLength(2)
    // Throwdown only allocates to RX Men, so single appearance.
    expect(screen.getByText("Boise Throwdown")).toBeInTheDocument()
    // "Bespoke" matches both the toolbar origin chip (button) and the
    // breakdown chip (span). Scope to the span via the chip's title attr.
    expect(
      screen.getByTitle(/^Bespoke: 1 accepted$/),
    ).toBeInTheDocument()

    // RX Women only has the qualifier allocation (2 spots) with 0 accepted.
    expect(screen.getByText("0/2")).toBeInTheDocument()
  })

  it("falls back to plain accepted count when a division has no maxSpots cap", () => {
    render(
      <SentInvitesByDivision
        invites={[
          baseInvite({
            id: "inv_a",
            email: "a@example.com",
            status: "accepted_paid",
            championshipDivisionId: "div_rxm",
          }),
        ]}
        divisions={[{ id: "div_rxm", label: "RX Men", maxSpots: null }]}
      />,
    )
    expect(screen.getByText("1 accepted")).toBeInTheDocument()
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

  // ADR-0013: the mismatch warning compares the sum of resolved
  // per-source allocations against the division's enforced cap and
  // surfaces a one-line warning with a link to the divisions page when
  // they disagree.
  describe("ADR-0013 allocation-mismatch warning", () => {
    it("renders 'exceeds' warning when allocations sum above the division cap", () => {
      render(
        <SentInvitesByDivision
          invites={[]}
          divisions={[
            {
              id: "div_rxm",
              label: "RX Men",
              maxSpots: 1,
              allocationTotal: 3,
            },
          ]}
          competitionId="comp_champ"
        />,
      )
      expect(
        screen.getByText(
          /Source allocations sum to 3, exceeding this division's capacity of 1/i,
        ),
      ).toBeInTheDocument()
      const link = screen.getByRole("link", {
        name: /Update division capacity/i,
      })
      expect(link).toHaveAttribute(
        "href",
        "/compete/organizer/$competitionId/divisions?competitionId=comp_champ",
      )
    })

    it("renders 'fewer than' warning when allocations sum below the cap", () => {
      render(
        <SentInvitesByDivision
          invites={[]}
          divisions={[
            {
              id: "div_rxm",
              label: "RX Men",
              maxSpots: 10,
              allocationTotal: 3,
            },
          ]}
          competitionId="comp_champ"
        />,
      )
      expect(
        screen.getByText(
          /Source allocations sum to 3, fewer than this division's capacity of 10/i,
        ),
      ).toBeInTheDocument()
    })

    it("renders 'no division cap' warning when allocations are set but no cap is", () => {
      render(
        <SentInvitesByDivision
          invites={[]}
          divisions={[
            {
              id: "div_rxm",
              label: "RX Men",
              maxSpots: null,
              allocationTotal: 5,
            },
          ]}
          competitionId="comp_champ"
        />,
      )
      expect(
        screen.getByText(
          /Source allocations sum to 5, but no division cap is set/i,
        ),
      ).toBeInTheDocument()
    })

    it("renders no warning when allocations equal the cap", () => {
      render(
        <SentInvitesByDivision
          invites={[]}
          divisions={[
            {
              id: "div_rxm",
              label: "RX Men",
              maxSpots: 5,
              allocationTotal: 5,
            },
          ]}
          competitionId="comp_champ"
        />,
      )
      expect(
        screen.queryByText(/Source allocations sum to/i),
      ).not.toBeInTheDocument()
    })

    it("renders no warning when both cap and allocations are 0/null", () => {
      render(
        <SentInvitesByDivision
          invites={[]}
          divisions={[
            {
              id: "div_rxm",
              label: "RX Men",
              maxSpots: null,
              allocationTotal: 0,
            },
          ]}
          competitionId="comp_champ"
        />,
      )
      expect(
        screen.queryByText(/Source allocations sum to/i),
      ).not.toBeInTheDocument()
    })

    it("suppresses the link when no competitionId is provided", () => {
      render(
        <SentInvitesByDivision
          invites={[]}
          divisions={[
            {
              id: "div_rxm",
              label: "RX Men",
              maxSpots: 1,
              allocationTotal: 3,
            },
          ]}
        />,
      )
      // Warning copy renders, link does not.
      expect(
        screen.getByText(
          /Source allocations sum to 3, exceeding this division's capacity of 1/i,
        ),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("link", { name: /Update division capacity/i }),
      ).not.toBeInTheDocument()
    })
  })
})

describe("computeAllocationMismatch", () => {
  it("returns null when allocations equal the cap", () => {
    expect(
      computeAllocationMismatch({ allocationTotal: 5, maxSpots: 5 }),
    ).toBeNull()
  })

  it("returns null when both are 0/null", () => {
    expect(
      computeAllocationMismatch({ allocationTotal: 0, maxSpots: null }),
    ).toBeNull()
  })

  it("returns 'exceeds' when allocation total > cap", () => {
    expect(
      computeAllocationMismatch({ allocationTotal: 7, maxSpots: 5 }),
    ).toEqual({ kind: "exceeds", allocationTotal: 7, maxSpots: 5 })
  })

  it("returns 'undershoots' when allocation total < cap", () => {
    expect(
      computeAllocationMismatch({ allocationTotal: 2, maxSpots: 5 }),
    ).toEqual({ kind: "undershoots", allocationTotal: 2, maxSpots: 5 })
  })

  it("returns 'no-cap' when cap is null but allocations are set", () => {
    expect(
      computeAllocationMismatch({ allocationTotal: 3, maxSpots: null }),
    ).toEqual({ kind: "no-cap", allocationTotal: 3 })
  })
})

describe("buildSentTabDivisions", () => {
  it("uses the per-division override when present", () => {
    expect(
      buildSentTabDivisions({
        divisions: [{ id: "div_rxm", label: "RX Men", maxSpots: 12 }],
        defaultMaxSpotsPerDivision: 5,
        divisionAllocationTotals: {},
      }),
    ).toEqual([
      { id: "div_rxm", label: "RX Men", maxSpots: 12, allocationTotal: 0 },
    ])
  })

  it("falls back to defaultMaxSpotsPerDivision when override is null", () => {
    expect(
      buildSentTabDivisions({
        divisions: [{ id: "div_rxm", label: "RX Men", maxSpots: null }],
        defaultMaxSpotsPerDivision: 5,
        divisionAllocationTotals: {},
      }),
    ).toEqual([
      { id: "div_rxm", label: "RX Men", maxSpots: 5, allocationTotal: 0 },
    ])
  })

  it("returns null cap when both override and default are null", () => {
    expect(
      buildSentTabDivisions({
        divisions: [{ id: "div_rxm", label: "RX Men", maxSpots: null }],
        defaultMaxSpotsPerDivision: null,
        divisionAllocationTotals: {},
      }),
    ).toEqual([
      { id: "div_rxm", label: "RX Men", maxSpots: null, allocationTotal: 0 },
    ])
  })

  it("attaches allocationTotal from the resolved-totals map", () => {
    expect(
      buildSentTabDivisions({
        divisions: [
          { id: "div_rxm", label: "RX Men", maxSpots: 1 },
          { id: "div_rxw", label: "RX Women", maxSpots: 2 },
        ],
        defaultMaxSpotsPerDivision: null,
        divisionAllocationTotals: { div_rxm: 3, div_rxw: 2 },
      }),
    ).toEqual([
      { id: "div_rxm", label: "RX Men", maxSpots: 1, allocationTotal: 3 },
      { id: "div_rxw", label: "RX Women", maxSpots: 2, allocationTotal: 2 },
    ])
  })

  it("defaults allocationTotal to 0 when the division id is missing from the map", () => {
    expect(
      buildSentTabDivisions({
        divisions: [{ id: "div_rxm", label: "RX Men", maxSpots: 5 }],
        defaultMaxSpotsPerDivision: null,
        divisionAllocationTotals: { other_division: 7 },
      }),
    ).toEqual([
      { id: "div_rxm", label: "RX Men", maxSpots: 5, allocationTotal: 0 },
    ])
  })

  it("returns an empty array when no divisions are configured", () => {
    expect(
      buildSentTabDivisions({
        divisions: [],
        defaultMaxSpotsPerDivision: 5,
        divisionAllocationTotals: { div_rxm: 3 },
      }),
    ).toEqual([])
  })

  it("preserves division order from the input", () => {
    const result = buildSentTabDivisions({
      divisions: [
        { id: "div_c", label: "C", maxSpots: null },
        { id: "div_a", label: "A", maxSpots: null },
        { id: "div_b", label: "B", maxSpots: null },
      ],
      defaultMaxSpotsPerDivision: 1,
      divisionAllocationTotals: {},
    })
    expect(result.map((d) => d.id)).toEqual(["div_c", "div_a", "div_b"])
  })

  // ADR-0013 regression case: this is exactly the bug-report scenario —
  // three sources each contribute their default `globalSpots: 1` into a
  // division whose actual cap is also 1. Pre-ADR-0013 the loader would
  // emit `maxSpots: 3` (sum of allocations); post-ADR-0013 it emits
  // `maxSpots: 1` (the enforced cap) plus `allocationTotal: 3` so the
  // component can render the mismatch warning.
  it("emits the division cap, not the allocation sum (ADR-0013 regression)", () => {
    expect(
      buildSentTabDivisions({
        divisions: [{ id: "div_rxm", label: "RX Men", maxSpots: null }],
        defaultMaxSpotsPerDivision: 1,
        divisionAllocationTotals: { div_rxm: 3 },
      }),
    ).toEqual([
      { id: "div_rxm", label: "RX Men", maxSpots: 1, allocationTotal: 3 },
    ])
  })
})
