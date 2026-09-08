import { cleanup, render, screen, waitFor } from "@testing-library/react"
import type { ComponentType, ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({
  day: vi.fn(),
  data: {} as Record<string, unknown>,
}))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useLoaderData: () => mock.data,
    useSearch: () => ({ trackId: "source", sourceDate: "2026-09-04" }),
  }),
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode
    to: string
    search?: Record<string, string>
  }) => (
    <a href={`${to}${search ? `?${new URLSearchParams(search)}` : ""}`}>
      {children}
    </a>
  ),
}))
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))
vi.mock("@/server-fns/training-personal-fns", () => ({
  getPersonalTrainingDayFn: mock.day,
  savePersonalTrainingSessionFn: vi.fn(),
}))
vi.mock("@/server-fns/training-fns", () => ({ getTrainingContextFn: vi.fn() }))
vi.mock("@/server-fns/log-fns", () => ({ getWorkoutScoresFn: vi.fn() }))
vi.mock("@/server-fns/workout-fns", () => ({
  getWorkoutByIdFn: vi.fn(),
  getWorkoutScheduledInstancesFn: vi.fn(),
}))
vi.mock("@/server-fns/workout-remix-fns", () => ({
  getWorkoutRemixInfoFn: vi.fn(),
}))
vi.mock("@/components/workout-remix-info", () => ({
  WorkoutRemixInfo: () => null,
}))
import { Route } from "@/routes/_protected/workouts/$workoutId/index"
afterEach(cleanup)

// @lat: [[session-navigation-tests#Workout detail has one direct Add action]]
it("keeps schedules and earlier results with only the header's direct Add action", async () => {
  mock.day.mockResolvedValue({
    personalSession: null,
    items: [],
    results: [],
    libraryResults: [],
  })
  mock.data = {
    workout: {
      id: "work",
      name: "Workout",
      description: "Run",
      scheme: "time",
      scope: "public",
    },
    canEdit: false,
    teamId: "gym",
    date: "2026-09-07",
    sourceWorkout: null,
    remixCount: 0,
    scheduledInstances: [
      { id: "scheduled", scheduledDate: "2026-09-04T12:00:00" },
    ],
    scores: [
      {
        id: "score",
        userName: "Athlete",
        recordedAt: "2026-09-04",
        displayScore: "1:23",
        asRx: true,
        scalingLabel: "Rx",
      },
    ],
  }
  const Page = Route.options.component as ComponentType
  render(<Page />)
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Add to My session" }),
    ).toBeEnabled(),
  )
  expect(
    screen.getAllByRole("button", { name: "Add to My session" }),
  ).toHaveLength(1)
  expect(
    screen.queryAllByRole("link", { name: /Add to my session/i }),
  ).toHaveLength(0)
  expect(screen.getByRole("heading", { name: "Scheduled dates" })).toBeVisible()
  expect(screen.getByText(/Fri, Sep 4, 2026/)).toBeVisible()
  expect(
    screen.getByRole("heading", { name: "EARLIER WORKOUT RESULTS" }),
  ).toBeVisible()
  expect(screen.getByText("1:23")).toBeVisible()
  expect(screen.getByRole("link", { name: "Log score" })).toHaveAttribute(
    "href",
    expect.stringContaining("/log/new?"),
  )
  expect(
    screen.queryByRole("link", { name: "Edit source workout" }),
  ).not.toBeInTheDocument()
})
