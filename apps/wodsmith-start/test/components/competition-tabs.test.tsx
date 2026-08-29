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

describe("CompetitionTabs registry-driven tabs", () => {
  it("shows the Stats tab only for benchmark competitions", () => {
    const { rerender } = render(
      <CompetitionTabs slug="test-benchmark" competitionType="in-person" />,
    )

    expect(screen.queryByRole("link", { name: /stats/i })).toBeNull()

    rerender(
      <CompetitionTabs slug="test-benchmark" competitionType="online" />,
    )

    expect(screen.queryByRole("link", { name: /stats/i })).toBeNull()

    rerender(
      <CompetitionTabs slug="test-benchmark" competitionType="benchmark" />,
    )

    expect(screen.getByRole("link", { name: /stats/i })).toHaveAttribute(
      "href",
      "/compete/test-benchmark/stats",
    )
  })

  it("hides the Schedule tab for benchmark competitions", () => {
    const { rerender } = render(
      <CompetitionTabs slug="test-benchmark" competitionType="benchmark" />,
    )

    expect(screen.queryByRole("link", { name: /schedule/i })).toBeNull()

    rerender(
      <CompetitionTabs slug="test-benchmark" competitionType="in-person" />,
    )

    expect(screen.getByRole("link", { name: /schedule/i })).toHaveAttribute(
      "href",
      "/compete/test-benchmark/schedule",
    )
  })
})
