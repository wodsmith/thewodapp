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
  group: vi.fn(),
  errorToast: vi.fn(),
  invalidate: vi.fn(),
  trackEvent: vi.fn(),
  describe: vi.fn(),
}))
vi.mock("@/server-fns/workout-authoring-fns", () => ({
  describeCompetitionEventFn: mocks.describe,
  describeWorkoutFn: mocks.describe,
}))

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: mocks.invalidate }),
  Link: () => null,
}))
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}))
vi.mock("sonner", () => ({
  toast: { error: mocks.errorToast, success: vi.fn() },
}))
vi.mock("@/lib/posthog", () => ({ trackEvent: mocks.trackEvent }))
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
  groupCompetitionEventsFn: mocks.group,
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
    mocks.invalidate.mockResolvedValue(undefined)
    mocks.group.mockResolvedValue({ trackWorkoutId: "parent-event" })
    mocks.describe.mockImplementation(async ({ data }: { data: { description: string } }) => ({
      name: data.description.split("\n")[0], description: data.description, scheme: "time-with-cap", scoreType: "min",
      roundsToScore: 3, timeCapSeconds: 600, tiebreakScheme: "reps", repsPerRound: 30, movementIds: ["thruster"],
      scope: "private", scalingGroupId: "divisions", scalingDescriptions: [{ scalingLevelId: "rx", description: "95 lb thrusters" }],
    }))
    for (const mutation of [
      mocks.create,
      mocks.cohostCreate,
      mocks.addSeriesEvent,
    ]) {
      mutation.mockRejectedValue(new Error("Creation unavailable"))
    }
  })

  // @lat: [[workout-authoring#Workout Authoring#Description creation lifecycle]]
  it("persists every inferred field for both scored parts before grouping them", async () => {
    const prompt =
      "A part is 10 reps down to one where you are doing dumbbell squats with a pair of dumbbells men are 50s. Women are 35 scaled men are 35 women are 20 and it’s for time with the time cap of 10 minutes at 10 minutes. your transition to a one rep Max power clean, which has a five minute time cap."
    const scalingDescriptions = [
      { scalingLevelId: "rx-men", description: "men are 50s" },
      { scalingLevelId: "rx-women", description: "Women are 35" },
      { scalingLevelId: "scaled-men", description: "scaled men are 35" },
      { scalingLevelId: "scaled-women", description: "women are 20" },
    ]
    mocks.describe.mockResolvedValueOnce({
      kind: "multi-part",
      name: "Multi-part event",
      description: prompt,
      subEvents: [
        {
          name: "Part A",
          description: "Dumbbell squat ladder",
          scheme: "time-with-cap",
          scoreType: "min",
          roundsToScore: 1,
          timeCapSeconds: 600,
          tiebreakScheme: null,
          repsPerRound: null,
          movementIds: ["dumbbell-squat"],
          scope: "private",
          scalingGroupId: "divisions",
          scalingDescriptions,
        },
        {
          name: "Part B",
          description: "One rep max power clean",
          scheme: "load",
          scoreType: "max",
          roundsToScore: 1,
          timeCapSeconds: null,
          tiebreakScheme: null,
          repsPerRound: null,
          movementIds: ["power-clean"],
          scope: "private",
          scalingGroupId: "divisions",
          scalingDescriptions: [],
        },
      ],
    })
    mocks.create
      .mockResolvedValueOnce({ trackWorkoutId: "part-a" })
      .mockResolvedValueOnce({ trackWorkoutId: "part-b" })

    render(
      <OrganizerEventManager
        competitionId="competition-1"
        organizingTeamId="team-1"
        events={[]}
        movements={[]}
        divisions={[]}
        divisionDescriptionsByWorkout={{}}
        sponsors={[]}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Create event" }))
    const dialog = within(screen.getByRole("dialog"))
    fireEvent.change(dialog.getByLabelText("Describe your workout"), {
      target: { value: prompt },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Create event" }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2))
    expect(mocks.create.mock.calls.map(([call]) => call.data)).toEqual([
      expect.objectContaining({
        name: "Part A",
        scheme: "time-with-cap",
        scoreType: "min",
        timeCap: 600,
        movementIds: ["dumbbell-squat"],
        scalingGroupId: "divisions",
        scalingDescriptions,
      }),
      expect.objectContaining({
        name: "Part B",
        scheme: "load",
        scoreType: "max",
        movementIds: ["power-clean"],
        scalingGroupId: "divisions",
        scalingDescriptions: [],
      }),
    ])
    expect(mocks.group).toHaveBeenCalledWith({
      data: {
        competitionId: "competition-1",
        teamId: "team-1",
        trackWorkoutIds: ["part-a", "part-b"],
        name: "Multi-part event",
        description: prompt,
      },
    })
  })

  // @lat: [[authoring-series-review#Series Authoring Review#Organizer refresh failure follows successful creation]]
  it.each(["organizer", "cohost"])(
    "%s resets a created draft after refresh fails",
    async (context) => {
      const mutation = context === "cohost" ? mocks.cohostCreate : mocks.create
      mutation.mockResolvedValueOnce({ trackWorkoutId: "event-1" })
      mocks.invalidate.mockRejectedValueOnce(new Error("Refresh unavailable"))
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
      fireEvent.click(screen.getByRole("button", { name: "Create event" }))
      const dialog = within(screen.getByRole("dialog"))
      fireEvent.change(dialog.getByLabelText("Describe your workout"), {
        target: { value: "Created once" },
      })
      fireEvent.click(dialog.getByRole("button", { name: "Create event" }))
      await waitFor(() =>
        expect(mocks.errorToast).toHaveBeenCalledWith(
          "Event created, but the list could not refresh. Reload to see it.",
        ),
      )
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: "Create event" }))
      expect(
        within(screen.getByRole("dialog")).getByLabelText("Describe your workout"),
      ).toHaveValue("")
      expect(mutation).toHaveBeenCalledTimes(1)
      expect(mocks.trackEvent.mock.calls.map(([event]) => event)).not.toContain(
        "competition_event_created_failed",
      )
    },
  )

  // @lat: [[authoring-series-review#Series Authoring Review#Series dialog preserves selected fields]]
  it("sends selected rounds, tiebreak, and movements through the series callback", async () => {
    render(
      <SeriesTemplateEventEditor
        groupId="group-1"
        trackId="track-1"
        events={[]}
        movements={[
          {
            id: "thruster",
            name: "Thruster",
            type: "weightlifting",
            createdAt: new Date(),
            updatedAt: new Date(),
            updateCounter: 0,
          },
        ]}
        onEventsChanged={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Create event" }))
    const dialog = within(screen.getByRole("dialog"))
    fireEvent.change(dialog.getByLabelText("Describe your workout"), {
      target: { value: "Three efforts" },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Create event" }))
    await waitFor(() =>
      expect(mocks.addSeriesEvent).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workout: expect.objectContaining({
            roundsToScore: 3,
            tiebreakScheme: "reps",
            timeCap: 600,
            repsPerRound: 30,
            scalingGroupId: "divisions",
            scalingDescriptions: [{ scalingLevelId: "rx", description: "95 lb thrusters" }],
          }),
          movementIds: ["thruster"],
        }),
      }),
    )
    await waitFor(() => expect(dialog.getByRole("alert")).toBeInTheDocument())
    expect(dialog.getByLabelText("Describe your workout")).toHaveValue("Three efforts")
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
    fireEvent.click(screen.getByRole("button", { name: "Create event" }))
    const dialog = within(screen.getByRole("dialog"))
    fireEvent.change(dialog.getByLabelText("Describe your workout"), {
      target: { value: "Friday workout" },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Create event" }))
    await waitFor(() =>
      expect(mocks.errorToast).toHaveBeenCalledWith("Refresh unavailable"),
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Create event" }))
    expect(
      within(screen.getByRole("dialog")).getByLabelText("Describe your workout"),
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

      fireEvent.click(screen.getByRole("button", { name: "Create event" }))
      const dialog = within(screen.getByRole("dialog"))
      fireEvent.change(dialog.getByLabelText("Describe your workout"), {
        target: { value: "Friday workout\n21-15-9 thrusters and pull-ups" },
      })
      fireEvent.click(dialog.getByRole("button", { name: "Create event" }))

      await waitFor(() =>
        expect(dialog.getByRole("alert")).toHaveTextContent(
          "Creation unavailable",
        ),
      )
      expect(dialog.getByLabelText("Describe your workout")).toHaveValue(
        "Friday workout\n21-15-9 thrusters and pull-ups",
      )
      expect(mocks.errorToast).toHaveBeenCalledWith("Creation unavailable")

      const mutation =
        context === "series"
          ? mocks.addSeriesEvent
          : context === "cohost"
            ? mocks.cohostCreate
            : mocks.create
      fireEvent.click(dialog.getByRole("button", { name: "Create event" }))
      await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2))
      expect(mutation.mock.calls[1][0]).toEqual(mutation.mock.calls[0][0])
      expect(dialog.getByLabelText("Describe your workout")).toHaveValue("Friday workout\n21-15-9 thrusters and pull-ups")
      expect(mocks.describe).toHaveBeenCalledTimes(1)
    },
  )
})
