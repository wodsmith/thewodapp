import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CrewVolunteerSignupForm } from "@/components/crew/volunteer-signup-form"

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => vi.fn(),
}))

vi.mock("@/server-fns/crew-volunteer-fns", () => ({
  submitCrewVolunteerSignupFn: vi.fn(),
}))

vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

describe("Crew public accessibility", () => {
  // @lat: [[crew#Crew Accessibility Regressions#Global And Series Navigation Landmarks Are Named]]
  it("gives the global and series navigation landmarks distinct names", () => {
    const rootRoute = readSource("src/routes/__root.tsx")
    const seriesRoute = readSource("src/routes/series/$groupId/crew.tsx")

    expect(rootRoute).toMatch(/<nav\s+aria-label="Primary navigation"/)
    expect(seriesRoute).toMatch(/<nav\s+aria-label="Series navigation"/)
  })

  // @lat: [[crew#Crew Accessibility Regressions#Volunteer Signup Title Is An H1]]
  it("renders the volunteer signup title as the page h1", () => {
    render(
      <CrewVolunteerSignupForm
        event={{
          id: "competition-1",
          slug: "throwdown",
          name: "Demo Throwdown",
          description: null,
          startDate: "2026-07-10",
          endDate: "2026-07-11",
          timezone: "America/Denver",
          competitionTeamId: "team-1",
        }}
        questions={[]}
        waivers={[]}
      />,
    )

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Volunteer for Demo Throwdown",
      }),
    ).toBeInTheDocument()
  })
})

function readSource(relativePath: string): string {
  return readFileSync(resolve(import.meta.dirname, "../..", relativePath), "utf8")
}
