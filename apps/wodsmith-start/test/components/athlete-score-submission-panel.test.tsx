import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  AthleteScoreSubmissionPanel,
  getScoreSubmissionGroupProgress,
  MIN_GROUPED_SCORE_WORKOUTS,
  shouldGroupScoreSubmissionWorkouts,
  type WorkoutInfo,
} from "@/components/compete/athlete-score-submission-panel"
import { getAthleteDivisionSubmissionsFn } from "@/server-fns/video-submission-fns"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/test">{children}</a>,
}))

vi.mock("@/server-fns/video-submission-fns", () => ({
  getAthleteDivisionSubmissionsFn: vi.fn(),
  getVideoSubmissionFn: vi.fn(),
}))

const mockGetSubmissions = vi.mocked(getAthleteDivisionSubmissionsFn)

function scoreWorkout(
  id: string,
  name: string,
  scheme: string,
  parentEventId: string | null = null,
  benchmarkCategory = "strength",
): WorkoutInfo {
  return {
    id,
    workoutId: `workout-${id}`,
    trackOrder: Number(id.replace(/\D/g, "")) || 1,
    parentEventId,
    benchmarkCategory,
    workout: { name, scheme },
  }
}

describe("shouldGroupScoreSubmissionWorkouts", () => {
  // @lat: [[research#Benchmark Score Submission Group Test#Dense List Activation]]
  it("groups only dense score lists that span multiple benchmark categories", () => {
    const strengthOnly = Array.from(
      { length: MIN_GROUPED_SCORE_WORKOUTS },
      (_, index) => scoreWorkout(`s${index}`, `Lift ${index}`, "load"),
    )
    const mixedDomains = [
      ...strengthOnly.slice(0, MIN_GROUPED_SCORE_WORKOUTS - 1),
      scoreWorkout("run", "1 Mile Run", "time", null, "engine"),
    ]

    expect(
      shouldGroupScoreSubmissionWorkouts(mixedDomains.slice(0, -1)),
    ).toBe(false)
    expect(shouldGroupScoreSubmissionWorkouts(strengthOnly)).toBe(false)
    expect(shouldGroupScoreSubmissionWorkouts(mixedDomains)).toBe(true)
  })
})

describe("AthleteScoreSubmissionPanel category disclosure", () => {
  beforeEach(() => {
    mockGetSubmissions.mockReset()
  })

  // @lat: [[research#Benchmark Score Submission Group Test#Default Collapsed Interaction]]
  it("groups dense child score rows and reveals them on demand", async () => {
    const strengthParent = scoreWorkout(
      "strength-parent",
      "Strength Tests",
      "load",
    )
    const engineParent = scoreWorkout(
      "engine-parent",
      "Engine Tests",
      "time",
      null,
      "engine",
    )
    const strengthChildren = Array.from({ length: 4 }, (_, index) =>
      scoreWorkout(
        `strength-child-${index}`,
        index === 0 ? "Strict Press" : `Lift ${index}`,
        "load",
        strengthParent.id,
      ),
    )
    const engineChildren = Array.from({ length: 4 }, (_, index) =>
      scoreWorkout(
        `engine-child-${index}`,
        `Engine Test ${index}`,
        "time",
        engineParent.id,
        "engine",
      ),
    )
    const workouts = [
      strengthParent,
      engineParent,
      ...strengthChildren,
      ...engineChildren,
    ]
    mockGetSubmissions.mockResolvedValue({
      submissions: [
        {
          trackWorkoutId: strengthChildren[0].id,
          hasVideo: false,
          videoReviewStatus: null,
          hasScore: true,
          displayScore: "137 lb",
          scoreStatus: null,
          secondaryValue: null,
          verificationStatus: null,
          canSubmit: true,
          windowStatus: "open",
        },
      ],
    })

    render(
      <AthleteScoreSubmissionPanel
        competitionId="competition-1"
        slug="benchmark"
        userDivisions={[
          {
            registration: { id: "registration-1", divisionId: "open" },
            division: { id: "open", label: "Open" },
          },
        ]}
        workouts={workouts}
        eventDivisionMappings={{ mappings: [], hasMappings: false }}
      />,
    )

    await waitFor(() => expect(mockGetSubmissions).toHaveBeenCalledOnce())

    const strengthCategory = await screen.findByRole("button", {
      name: /Strength/i,
    })
    expect(strengthCategory).toHaveTextContent("1 of 4 scores submitted")
    expect(strengthCategory).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.queryByRole("button", { name: /Strict Press/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(strengthCategory)

    expect(strengthCategory).toHaveAttribute("aria-expanded", "true")
    expect(
      await screen.findByRole("button", { name: /Strict Press/i }),
    ).toBeInTheDocument()
  })
})

describe("getScoreSubmissionGroupProgress", () => {
  // @lat: [[research#Benchmark Score Submission Group Test#Category Submission Progress]]
  it("counts score-bearing child events instead of their parent container", () => {
    const parent = scoreWorkout("parent", "Clean Complex", "load")
    const standalone = scoreWorkout("standalone", "Strict Press", "load")
    const children = [
      scoreWorkout("child-a", "Clean", "load", parent.id),
      scoreWorkout("child-b", "Jerk", "load", parent.id),
    ]

    const progress = getScoreSubmissionGroupProgress(
      [parent, standalone],
      new Map([[parent.id, children]]),
      new Map([
        [children[0].id, { hasScore: true, hasVideo: false }],
        [children[1].id, { hasScore: false, hasVideo: true }],
        [standalone.id, { hasScore: false, hasVideo: false }],
      ]),
    )

    expect(progress).toEqual({ submittedCount: 2, totalCount: 3 })
  })
})
