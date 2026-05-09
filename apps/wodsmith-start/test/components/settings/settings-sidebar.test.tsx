// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SettingsSidebar } from "@/components/settings/settings-sidebar"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: "/settings/overview" }),
}))

describe("SettingsSidebar", () => {
  it("renders General group with Overview, Profile, Appearance items", () => {
    render(<SettingsSidebar />)
    expect(screen.getByText("General")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /overview/i })).toHaveAttribute(
      "href",
      "/settings/overview",
    )
    expect(screen.getByRole("link", { name: /^profile$/i })).toHaveAttribute(
      "href",
      "/settings/profile",
    )
    expect(screen.getByRole("link", { name: /appearance/i })).toHaveAttribute(
      "href",
      "/settings/appearance",
    )
  })

  it("renders Athlete group with Athlete profile and Teams items", () => {
    render(<SettingsSidebar />)
    expect(screen.getByText("Athlete")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /athlete profile/i }),
    ).toHaveAttribute("href", "/settings/athlete")
    expect(screen.getByRole("link", { name: /teams/i })).toHaveAttribute(
      "href",
      "/settings/teams",
    )
  })

  it("renders Account group with Security, Sessions, Billing items", () => {
    render(<SettingsSidebar />)
    expect(screen.getByText("Account")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /security/i })).toHaveAttribute(
      "href",
      "/settings/security",
    )
    expect(screen.getByRole("link", { name: /sessions/i })).toHaveAttribute(
      "href",
      "/settings/sessions",
    )
    expect(
      screen.getByRole("link", { name: /billing/i }),
    ).toHaveAttribute("href", "/settings/billing")
  })

  it("conditionally shows Programming under Athlete when hasWorkoutTracking", () => {
    const { rerender } = render(<SettingsSidebar hasWorkoutTracking={false} />)
    expect(
      screen.queryByRole("link", { name: /programming/i }),
    ).not.toBeInTheDocument()

    rerender(<SettingsSidebar hasWorkoutTracking={true} />)
    expect(
      screen.getByRole("link", { name: /programming/i }),
    ).toHaveAttribute("href", "/settings/programming")
  })
})
