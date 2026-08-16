// @vitest-environment jsdom
import type { ComponentType } from "react"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@tanstack/react-router", () => ({
  createFileRoute:
    () =>
    (config: Record<string, unknown>) => ({
      ...config,
      options: config,
      useLoaderData: () => ({ competitions: [], teams: [] }),
    }),
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => vi.fn(),
}))

vi.mock("@/server-fns/demo-competition-fns", () => ({
  deleteDemoCompetitionFn: vi.fn(),
  generateDemoCompetitionFn: vi.fn(),
  getOrganizingTeamsFn: vi.fn(),
  listDemoCompetitionsFn: vi.fn(),
}))

const { Route } = await import("@/routes/admin/demo-competitions/index")
const DemoCompetitionsPage = Route.options.component as ComponentType

describe("DemoCompetitionsPage semantics", () => {
  // @lat: [[admin-navigation#Demo Competitions Semantic Tests#Page and Card Sections Form a Coherent Heading Outline]]
  it("exposes one page heading followed by card and detail headings", () => {
    render(<DemoCompetitionsPage />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Demo Competitions" }),
    ).toBeVisible()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Existing Demo Competitions",
      }),
    ).toBeVisible()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Generate New Demo Competition",
      }),
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { level: 3, name: "What gets created:" }),
    ).toBeVisible()
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument()
  })

  // @lat: [[admin-navigation#Demo Competitions Semantic Tests#Creation Summary Uses Valid Nested Lists]]
  it("nests the workout details inside their parent list item", () => {
    render(<DemoCompetitionsPage />)

    const summaryHeading = screen.getByRole("heading", {
      level: 3,
      name: "What gets created:",
    })
    const summaryList = summaryHeading.nextElementSibling

    expect(summaryList).toBeInstanceOf(HTMLUListElement)
    expect(
      Array.from(summaryList?.children ?? []).every(
        (child) => child instanceof HTMLLIElement,
      ),
    ).toBe(true)

    const workoutsItem = within(summaryList as HTMLUListElement).getByText(
      "3 Workouts with smart timing:",
      { exact: true },
    )

    expect(workoutsItem).toBeInstanceOf(HTMLLIElement)
    expect(workoutsItem?.querySelector(":scope > ul")).toBeInTheDocument()
  })
})
