// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CompetitionLayout } from "@/routes/compete/organizer/$competitionId"

const mockCompetition = {
  id: "comp_123",
  name: "Test Throwdown",
  slug: "test-throwdown",
  description: null,
  startDate: new Date("2026-08-01T00:00:00Z"),
  endDate: new Date("2026-08-02T00:00:00Z"),
  registrationOpensAt: null,
  registrationClosesAt: null,
  visibility: "public",
  status: "draft",
  groupId: null,
  competitionType: "in-person",
}

let routeContext: unknown

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useLoaderData: () => ({ competition: mockCompetition }),
    useRouteContext: () => routeContext,
  }),
  notFound: vi.fn(),
  Outlet: () => <div data-testid="outlet" />,
  redirect: vi.fn((options) => options),
  useMatches: () => [{ pathname: "/compete/organizer/comp_123" }],
}))

vi.mock("@/components/competition-header", () => ({
  CompetitionHeader: () => <div data-testid="competition-header" />,
}))

vi.mock("@/components/competition-sidebar", () => ({
  CompetitionSidebar: ({ children }: { children: ReactNode }) => (
    <div data-testid="competition-sidebar">{children}</div>
  ),
}))

vi.mock("@/components/organizer-breadcrumb", () => ({
  OrganizerBreadcrumb: () => <div data-testid="organizer-breadcrumb" />,
}))

vi.mock("@/components/pending-organizer-banner", () => ({
  PendingOrganizerBanner: () => <div data-testid="pending-organizer-banner" />,
}))

vi.mock("@/lib/competitions/capabilities", () => ({
  resultsNavLabel: () => "Results",
}))

vi.mock("@/server-fns/competition-detail-fns", () => ({
  getCompetitionByIdFn: vi.fn(),
}))

describe("CompetitionLayout", () => {
  beforeEach(() => {
    routeContext = {}
  })

  it("renders when organizer entitlements are absent from route context", () => {
    expect(() => render(<CompetitionLayout />)).not.toThrow()

    expect(screen.getByTestId("competition-sidebar")).toBeInTheDocument()
    expect(screen.getByTestId("competition-header")).toBeInTheDocument()
    expect(
      screen.queryByTestId("pending-organizer-banner"),
    ).not.toBeInTheDocument()
  })

  it("shows the pending organizer banner when the context marks approval pending", () => {
    routeContext = { entitlements: { isPendingApproval: true } }

    render(<CompetitionLayout />)

    expect(screen.getByTestId("pending-organizer-banner")).toBeInTheDocument()
  })
})
