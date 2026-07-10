// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentType, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  updateEvent: vi.fn(),
  loaderData: {} as Record<string, unknown>,
}))

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useLoaderData: () => mocks.loaderData,
    useParams: () => ({ groupId: "group-1", eventId: "parent-1" }),
    useSearch: () => ({}),
  }),
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useRouter: () => ({ invalidate: mocks.invalidate }),
}))

vi.mock("@/components/events/event-resources-card", () => ({
  EventResourcesCard: () => <div>Event resources</div>,
}))

vi.mock("@/components/organizer/event-judging-sheets", () => ({
  EventJudgingSheets: () => <div>Judging sheets</div>,
}))

vi.mock("@/server-fns/competition-fns", () => ({
  getCompetitionGroupByIdFn: vi.fn(),
}))
vi.mock("@/server-fns/event-resources-fns", () => ({
  getEventResourcesFn: vi.fn(),
}))
vi.mock("@/server-fns/judging-sheet-fns", () => ({
  getEventJudgingSheetsFn: vi.fn(),
}))
vi.mock("@/server-fns/movement-fns", () => ({ getAllMovementsFn: vi.fn() }))
vi.mock("@/server-fns/competition-workouts-fns", () => ({
  getWorkoutDivisionDescriptionsFn: vi.fn(),
  updateWorkoutDivisionDescriptionsFn: vi.fn(),
}))
vi.mock("@/server-fns/series-division-mapping-fns", () => ({
  getSeriesTemplateDivisionsFn: vi.fn(),
}))
vi.mock("@/server-fns/series-event-template-fns", () => ({
  getSeriesTemplateEventByIdFn: vi.fn(),
  getSeriesTemplateEventsFn: vi.fn(),
  updateSeriesTemplateEventFn: mocks.updateEvent,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { Route } from "@/routes/compete/organizer/series/$groupId/events/$eventId"

const SeriesTemplateEventEditPage = Route.options.component as ComponentType

const parentEvent = {
  id: "parent-1",
  workoutId: "workout-parent",
  trackOrder: 1,
  pointsMultiplier: 100,
  notes: null,
  workout: {
    name: "Two-Part Finale",
    description: "Parent event",
    scheme: "time",
    scoreType: null,
    timeCap: null,
  },
}

const childEvent = {
  id: "child-1",
  workoutId: "workout-child",
  parentEventId: "parent-1",
  trackOrder: 1.01,
  pointsMultiplier: 100,
  notes: null,
  workout: {
    name: "Finale Part A",
    description: "21-15-9 thrusters",
    scheme: "time",
    scoreType: null,
    timeCap: null,
  },
}

function setLoaderData(movementIds: string[]) {
  mocks.loaderData = {
    event: parentEvent,
    movementIds: [],
    movements: [
      { id: "movement-1", name: "Thruster", type: "weightlifting" },
      { id: "movement-2", name: "Pull-up", type: "gymnastic" },
    ],
    organizingTeamId: "team-1",
    divisions: [],
    divisionDescriptions: [],
    childEvents: [childEvent],
    childDivisionDescriptions: {},
    childMovementIds: { "child-1": movementIds },
    resources: [],
    judgingSheets: [],
  }
}

describe("series template event editor", () => {
  beforeEach(() => {
    setLoaderData(["movement-1"])
    mocks.invalidate.mockReset()
    mocks.updateEvent.mockReset().mockResolvedValue({ success: true })
  })

  // @lat: [[series-event-templates#Template Event Editing#Sub-event movement editing]]
  it("renders sub-event movement controls as a semantic collection", () => {
    render(<SeriesTemplateEventEditPage />)

    expect(
      screen.getByRole("heading", { name: "Movements", level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Thruster/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: /Pull-up/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  it("renders the movement list empty state", () => {
    setLoaderData([])
    mocks.loaderData.movements = []

    render(<SeriesTemplateEventEditPage />)

    expect(screen.getByText("No movements found")).toBeInTheDocument()
  })

  it("preserves the sub-event update payload", async () => {
    render(<SeriesTemplateEventEditPage />)

    fireEvent.click(screen.getByRole("button", { name: "Save sub-event" }))

    await waitFor(() =>
      expect(mocks.updateEvent).toHaveBeenCalledWith({
        data: {
          trackWorkoutId: "child-1",
          groupId: "group-1",
          workout: {
            name: "Finale Part A",
            description: "21-15-9 thrusters",
            scheme: "time",
            scoreType: null,
            timeCap: null,
            tiebreakScheme: null,
          },
          movementIds: ["movement-1"],
          pointsMultiplier: 100,
          notes: null,
        },
      }),
    )
    expect(mocks.invalidate).toHaveBeenCalledOnce()
  })
})
