import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import CompeteNav from "@/components/compete-nav"

const { mockUseFeatureFlagEnabled, mockCompeteMobileNav } = vi.hoisted(() => ({
  mockUseFeatureFlagEnabled: vi.fn(),
  mockCompeteMobileNav: vi.fn(
    (_props: { showBenchmarksLink: boolean }) => null,
  ),
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: "/" } }),
}))

vi.mock("@/lib/posthog", () => ({
  useFeatureFlagEnabled: mockUseFeatureFlagEnabled,
}))

vi.mock("@/components/compete-mobile-nav", () => ({
  default: mockCompeteMobileNav,
}))

vi.mock("@/components/compete-nav-brand", () => ({
  CompeteNavBrand: () => null,
}))

vi.mock("@/components/nav/dark-mode-toggle", () => ({
  DarkModeToggle: () => null,
}))

vi.mock("@/components/nav/logout-button", () => ({
  default: () => null,
}))

describe("CompeteNav benchmark feature flag", () => {
  // @lat: [[competition-type-capabilities#Benchmark Rollout Gates#Navigation Feature Flag]]
  it("shows benchmark navigation only when benchmark-comp-type is enabled", () => {
    mockUseFeatureFlagEnabled.mockReturnValue(false)
    const session = { user: null } as never
    const { rerender } = render(
      <CompeteNav session={session} hasOrganizerApplication={false} />,
    )

    expect(mockUseFeatureFlagEnabled).toHaveBeenCalledWith(
      "benchmark-comp-type",
    )
    expect(screen.queryByRole("link", { name: "Benchmarks" })).toBeNull()
    expect(mockCompeteMobileNav.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ showBenchmarksLink: false }),
    )

    mockUseFeatureFlagEnabled.mockReturnValue(true)
    rerender(<CompeteNav session={session} hasOrganizerApplication={false} />)

    expect(screen.getByRole("link", { name: "Benchmarks" })).toHaveAttribute(
      "href",
      "/benchmarks",
    )
    expect(mockCompeteMobileNav.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ showBenchmarksLink: true }),
    )
  })
})
