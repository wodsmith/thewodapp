import { render } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { OrganizerCompetitionForm } from "@/components/organizer-competition-form"

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock("@/server-fns/competition-divisions-fns", () => ({
  initializeCompetitionDivisionsFn: vi.fn(),
}))

vi.mock("@/server-fns/competition-fns", () => ({
  createCompetitionFn: vi.fn(),
  updateCompetitionFn: vi.fn(),
}))

vi.mock("@/server-fns/series-event-template-fns", () => ({
  syncTemplateEventsToCompetitionsFn: vi.fn(),
}))

vi.mock("@/lib/posthog", () => ({
  trackEvent: vi.fn(),
}))

beforeAll(() => {
  globalThis.ResizeObserver ??= class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

const emptyTemplateDivisions = {}
const emptyTemplateEvents = {}

describe("OrganizerCompetitionForm", () => {
  // @lat: [[competition-type-capabilities#Create Picker Selectability Test#Create Form Benchmark Option]]
  it("includes benchmark in the create competition type picker", () => {
    const { container } = render(
      <OrganizerCompetitionForm
        teams={[{ id: "team_gym", name: "Test Gym", type: "gym" }]}
        selectedTeamId="team_gym"
        seriesTemplateDivisions={emptyTemplateDivisions}
        seriesTemplateEvents={emptyTemplateEvents}
      />,
    )

    const optionLabels = Array.from(container.querySelectorAll("option")).map(
      (option) => option.textContent,
    )
    expect(optionLabels).toContain(
      "Benchmark - Perpetual benchmark board with video submissions",
    )
  })
})
