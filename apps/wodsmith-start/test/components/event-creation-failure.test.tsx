import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { OrganizerEventManager } from "@/components/events/organizer-event-manager"
import { SeriesTemplateEventEditor } from "@/components/series/series-template-event-editor"

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  cohostCreate: vi.fn(),
  addSeriesEvent: vi.fn(),
  errorToast: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: () => null,
}))
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}))
vi.mock("sonner", () => ({
  toast: { error: mocks.errorToast, success: vi.fn() },
}))
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))
vi.mock("@/components/events/add-event-dialog", () => ({
  AddEventDialog: () => null,
}))
vi.mock("@/components/events/group-events-dialog", () => ({
  GroupEventsDialog: () => null,
}))
vi.mock("@/components/events/competition-event-row", () => ({
  CompetitionEventRow: () => null,
}))
vi.mock("@/server-fns/competition-workouts-fns", () => ({
  createWorkoutAndAddToCompetitionFn: mocks.create,
  groupCompetitionEventsFn: vi.fn(),
  removeWorkoutFromCompetitionFn: vi.fn(),
  reorderCompetitionEventsFn: vi.fn(),
  updateWorkoutDivisionDescriptionsFn: vi.fn(),
}))
vi.mock("@/server-fns/series-event-template-fns", () => ({
  addEventToSeriesTemplateFn: mocks.addSeriesEvent,
  deleteSeriesTemplateEventFn: vi.fn(),
  reorderSeriesTemplateEventsFn: vi.fn(),
}))

describe("event creation failure recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const mutation of [
      mocks.create,
      mocks.cohostCreate,
      mocks.addSeriesEvent,
    ]) {
      mutation.mockRejectedValue(new Error("Creation unavailable"))
    }
  })

  // @lat: [[workout-authoring#Workout Authoring#Failed event creation retains entries#Refresh failure after creation]]
  it("resets a successfully created series event even when refreshing fails", async () => {
    mocks.addSeriesEvent.mockResolvedValueOnce({
      event: {
        id: "event-1",
        trackId: "track-1",
        workoutId: "workout-1",
        trackOrder: 1,
        parentEventId: null,
        notes: null,
        pointsMultiplier: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: 1,
        name: "Friday workout",
        scoreType: "min",
        workout: {
          id: "workout-1",
          name: "Friday workout",
          description: "For time",
          scheme: "time",
          scoreType: "min",
          timeCap: null,
        },
      },
    })
    render(
      <SeriesTemplateEventEditor
        groupId="group-1"
        trackId="track-1"
        events={[]}
        movements={[]}
        onEventsChanged={vi
          .fn()
          .mockRejectedValue(new Error("Refresh unavailable"))}
      />,
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Create event" }),
    )
    const dialog = within(screen.getByRole("dialog"))
    fireEvent.change(dialog.getByLabelText("Event Name"), {
      target: { value: "Friday workout" },
    })
    fireEvent.click(
      dialog.getByRole("button", { name: "Create event" }),
    )
    await waitFor(() =>
      expect(mocks.errorToast).toHaveBeenCalledWith("Refresh unavailable"),
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Create event" }),
    )
    expect(
      within(screen.getByRole("dialog")).getByLabelText("Event Name"),
    ).toHaveValue("")
    expect(mocks.addSeriesEvent).toHaveBeenCalledTimes(1)
  })

  // @lat: [[workout-authoring#Workout Authoring#Failed event creation retains entries]]
  it.each(["organizer", "cohost", "series"] as const)(
    "%s preserves the real dialog's entries and retries the same definition",
    async (context) => {
      if (context === "series") {
        render(
          <SeriesTemplateEventEditor
            groupId="group-1"
            trackId="track-1"
            events={[]}
            movements={[]}
            onEventsChanged={vi.fn()}
          />,
        )
      } else {
        render(
          <OrganizerEventManager
            competitionId="competition-1"
            organizingTeamId="team-1"
            events={[]}
            movements={[]}
            divisions={[]}
            divisionDescriptionsByWorkout={{}}
            sponsors={[]}
            overrides={
              context === "cohost"
                ? { createWorkoutFn: mocks.cohostCreate }
                : undefined
            }
          />,
        )
      }

      fireEvent.click(
        screen.getByRole("button", { name: "Create event" }),
      )
      const dialog = within(screen.getByRole("dialog"))
      fireEvent.change(dialog.getByLabelText("Event Name"), {
        target: { value: "Friday workout" },
      })
      fireEvent.change(dialog.getByLabelText("Description"), {
        target: { value: "21-15-9 thrusters and pull-ups" },
      })
      fireEvent.click(
        dialog.getByRole("button", { name: "Create event" }),
      )

      await waitFor(() =>
        expect(dialog.getByRole("alert")).toHaveTextContent(
          "Creation unavailable",
        ),
      )
      expect(dialog.getByLabelText("Event Name")).toHaveValue("Friday workout")
      expect(dialog.getByLabelText("Description")).toHaveValue(
        "21-15-9 thrusters and pull-ups",
      )
      expect(mocks.errorToast).toHaveBeenCalledWith("Creation unavailable")

      const mutation =
        context === "series"
          ? mocks.addSeriesEvent
          : context === "cohost"
            ? mocks.cohostCreate
            : mocks.create
      fireEvent.click(
        dialog.getByRole("button", { name: "Create event" }),
      )
      await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2))
      expect(mutation.mock.calls[1][0]).toEqual(mutation.mock.calls[0][0])
      expect(dialog.getByLabelText("Event Name")).toHaveValue("Friday workout")
    },
  )
})
