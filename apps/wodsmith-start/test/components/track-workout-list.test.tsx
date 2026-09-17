import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TrackWorkoutList } from "@/components/track-workout-list"
import type { TrackWorkoutWithDetails } from "@/server-fns/programming-fns"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: {
    children: React.ReactNode
    params: { workoutId: string }
  }) => <a href={`/workouts/${params.workoutId}`}>{children}</a>,
}))

vi.mock("@/server-fns/programming-fns", () => ({
  removeWorkoutFromTrackFn: vi.fn(),
}))

function trackWorkout(
  id: string,
  name: string,
  trackOrder: number,
  parentEventId: string | null = null,
): TrackWorkoutWithDetails {
  const now = new Date("2026-09-16T12:00:00Z")
  return {
    id,
    trackId: "track",
    workoutId: `${id}-workout`,
    parentEventId,
    trackOrder,
    notes: null,
    pointsMultiplier: 100,
    heatStatus: "published",
    eventStatus: "published",
    sponsorId: null,
    defaultHeatsCount: null,
    defaultLaneShiftPattern: null,
    minHeatBuffer: null,
    createdAt: now,
    updatedAt: now,
    updateCounter: 0,
    workout: {
      id: `${id}-workout`,
      name,
      description: null,
      scheme: id.endsWith("load") ? "load" : "time",
      scope: "public",
      teamId: "team",
    },
  }
}

describe("programming track workout hierarchy", () => {
  it("renders an unscored parent as a group and keeps each child independently linked", () => {
    render(
      <TrackWorkoutList
        trackWorkouts={[
          trackWorkout("standalone", "Standalone", 1),
          trackWorkout("parent", "Two-part workout", 2),
          trackWorkout("part-load", "Part B", 2.02, "parent"),
          trackWorkout("part-time", "Part A", 2.01, "parent"),
        ]}
      />,
    )

    const group = screen.getByRole("region", {
      name: "Two-part workout sub-events",
    })
    expect(within(group).getByText("2 scored sub-events")).toBeInTheDocument()
    expect(within(group).getByText("Two-part workout").closest("a")).toBeNull()
    expect(within(group).getByRole("link", { name: "Part A" })).toHaveAttribute(
      "href",
      "/workouts/part-time-workout",
    )
    expect(within(group).getByRole("link", { name: "Part B" })).toHaveAttribute(
      "href",
      "/workouts/part-load-workout",
    )
    expect(within(group).getAllByText("Sub-event")).toHaveLength(2)
    expect(screen.getByRole("link", { name: "Standalone" })).toHaveAttribute(
      "href",
      "/workouts/standalone-workout",
    )
  })
})
