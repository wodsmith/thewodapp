// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { CompetitionTabs } from "@/components/competition-tabs"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: ReactNode
    to: string
    className?: string
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: "/compete/test-benchmark" }),
  useNavigate: () => vi.fn(),
}))

const benchmarkSettings = JSON.stringify({
  scoringConfig: {
    algorithm: "absolute_tier",
    absoluteTier: { batteryId: "bbat_test" },
    tiebreaker: { primary: "countback" },
    statusHandling: { dnf: "zero", dns: "zero", withdrawn: "zero" },
  },
})

const traditionalSettings = JSON.stringify({
  scoringConfig: {
    algorithm: "traditional",
    traditional: { step: 5, firstPlacePoints: 100 },
    tiebreaker: { primary: "countback" },
    statusHandling: { dnf: "zero", dns: "zero", withdrawn: "zero" },
  },
})

describe("CompetitionTabs benchmark stats gate", () => {
  it("shows the generic Stats tab only for absolute-tier benchmark scoring", () => {
    const { rerender } = render(
      <CompetitionTabs slug="test-benchmark" settings={traditionalSettings} />,
    )

    expect(screen.queryByRole("link", { name: /stats/i })).toBeNull()

    rerender(
      <CompetitionTabs slug="test-benchmark" settings={benchmarkSettings} />,
    )

    expect(screen.getByRole("link", { name: /stats/i })).toHaveAttribute(
      "href",
      "/compete/test-benchmark/stats",
    )
  })
})
