import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import CompeteNav from "@/components/compete-nav"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: (options?: { select?: (state: unknown) => unknown }) => {
    const state = { location: { pathname: "/" } }
    return options?.select ? options.select(state) : state
  },
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SheetContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SheetTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SheetTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
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

describe("CompeteNav benchmark link", () => {
  // @lat: [[competition-type-capabilities#Benchmark Rollout Gates#Always-visible Navigation]]
  it("always shows benchmark navigation on desktop and mobile", () => {
    const session = { user: null } as never
    render(<CompeteNav session={session} hasOrganizerApplication={false} />)

    const benchmarkLinks = screen.getAllByRole("link", { name: "Benchmarks" })
    expect(benchmarkLinks).toHaveLength(2)
    for (const link of benchmarkLinks) {
      expect(link).toHaveAttribute("href", "/benchmarks")
    }
  })
})
