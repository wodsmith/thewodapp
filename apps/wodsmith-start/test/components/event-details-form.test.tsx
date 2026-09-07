import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EventDetailsForm } from "@/components/events/event-details-form"
import type { WorkoutScheme } from "@/db/schemas/workouts"

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
}))

// Mock server function
vi.mock("@/server-fns/competition-workouts-fns", () => ({
  saveCompetitionEventFn: vi.fn(),
}))

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

function createTestEvent(scheme: WorkoutScheme, tiebreakScheme?: string) {
  return {
    id: "event-1",
    trackId: "track-1",
    workoutId: "workout-1",
    trackOrder: 1,
    parentEventId: null,
    notes: null,
    pointsMultiplier: 100,
    sponsorId: null,
    workout: {
      id: "workout-1",
      name: "Test Workout",
      description: "Test description",
      scheme,
      scoreType: "max" as const,
      roundsToScore: null,
      tiebreakScheme: tiebreakScheme ?? null,
      timeCap: null,
      movements: [],
    },
  }
}

const defaultProps = {
  competitionId: "comp-1",
  organizingTeamId: "team-1",
  divisions: [],
  divisionDescriptions: [],
  movements: [],
  sponsors: [],
}

describe("EventDetailsForm", () => {
  // @lat: [[workout-authoring#Existing event scoring choices]]
  it.each(["sum", null] as const)(
    "preserves explicit aggregation %s on scheme changes and still accepts direct choices",
    async (scoreType) => {
      const event = createTestEvent("load")
      render(
        <EventDetailsForm
          {...defaultProps}
          event={{ ...event, workout: { ...event.workout, scoreType } }}
        />,
      )
      fireEvent.keyDown(
        screen.getByRole("combobox", { name: /^Scheme$/ }),
        { key: "ArrowDown" },
      )
      fireEvent.click(
        screen.getByRole("option", { name: /^For Time$/ }),
      )
      await waitFor(() =>
        expect(
          screen.getByRole("combobox", { name: /^Score Type$/ }),
        ).toHaveTextContent(scoreType === "sum" ? "Sum" : "Min"),
      )
      fireEvent.keyDown(
        screen.getByRole("combobox", { name: /^Score Type$/ }),
        { key: "ArrowDown" },
      )
      fireEvent.click(screen.getByRole("option", { name: /Average/ }))
      await waitFor(() =>
        expect(
          screen.getByRole("combobox", { name: /^Score Type$/ }),
        ).toHaveTextContent("Average"),
      )
    },
  )

  describe("Tiebreak field visibility", () => {
    it("shows tiebreak field for time scheme", async () => {
      render(
        <EventDetailsForm event={createTestEvent("time")} {...defaultProps} />,
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/tiebreak/i)).toBeInTheDocument()
      })
    })

    it("shows tiebreak field for time-with-cap scheme", async () => {
      render(
        <EventDetailsForm
          event={createTestEvent("time-with-cap")}
          {...defaultProps}
        />,
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/tiebreak/i)).toBeInTheDocument()
      })
    })

    it("shows tiebreak field for rounds-reps scheme", async () => {
      render(
        <EventDetailsForm
          event={createTestEvent("rounds-reps")}
          {...defaultProps}
        />,
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/tiebreak/i)).toBeInTheDocument()
      })
    })

    it("shows tiebreak field for load scheme", async () => {
      render(
        <EventDetailsForm event={createTestEvent("load")} {...defaultProps} />,
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/tiebreak/i)).toBeInTheDocument()
      })
    })

    it("shows tiebreak field for points scheme", async () => {
      render(
        <EventDetailsForm
          event={createTestEvent("points")}
          {...defaultProps}
        />,
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/tiebreak/i)).toBeInTheDocument()
      })
    })

    it("hides tiebreak field for pass-fail scheme", async () => {
      render(
        <EventDetailsForm
          event={createTestEvent("pass-fail")}
          {...defaultProps}
        />,
      )

      await waitFor(() => {
        expect(screen.queryByLabelText(/tiebreak/i)).not.toBeInTheDocument()
      })
    })
  })

  describe("Time cap field visibility", () => {
    it("shows time cap field for time-with-cap scheme", async () => {
      render(
        <EventDetailsForm
          event={createTestEvent("time-with-cap")}
          {...defaultProps}
        />,
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/time cap/i)).toBeInTheDocument()
      })
    })

    it("hides time cap field for time scheme", async () => {
      render(
        <EventDetailsForm event={createTestEvent("time")} {...defaultProps} />,
      )

      await waitFor(() => {
        expect(screen.queryByLabelText(/time cap/i)).not.toBeInTheDocument()
      })
    })

    it("hides time cap field for rounds-reps scheme", async () => {
      render(
        <EventDetailsForm
          event={createTestEvent("rounds-reps")}
          {...defaultProps}
        />,
      )

      await waitFor(() => {
        expect(screen.queryByLabelText(/time cap/i)).not.toBeInTheDocument()
      })
    })
  })
})
