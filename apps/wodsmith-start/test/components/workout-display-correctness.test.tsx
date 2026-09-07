import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ component: (() => null) as () => ReactNode, cap: 600 }))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: () => ReactNode }) => { state.component = options.component; return { useLoaderData: () => ({ workout: { id: "workout", name: "Capped", description: "Run", scheme: "time-with-cap", scope: "public", timeCap: state.cap }, canEdit: false, scores: [{ id: "score", userName: "Athlete", recordedAt: new Date("2026-09-07T00:00:00Z"), displayScore: "5:00", asRx: true, status: "scored" }], scheduledInstances: [], teamId: "gym", date: "2026-09-07", sourceWorkout: null, remixCount: 0 }) } },
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock("@/server-fns/workout-fns", () => ({ getWorkoutByIdFn: vi.fn(), getWorkoutScheduledInstancesFn: vi.fn() }))
vi.mock("@/server-fns/log-fns", () => ({ getWorkoutScoresFn: vi.fn() }))
vi.mock("@/server-fns/training-fns", () => ({ getTrainingContextFn: vi.fn() }))
vi.mock("@/server-fns/workout-remix-fns", () => ({ getWorkoutRemixInfoFn: vi.fn() }))
vi.mock("@/components/workout-remix-info", () => ({ WorkoutRemixInfo: () => null }))
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))
vi.mock("@/components/ui/hover-card", () => ({ HoverCard: ({ children }: { children: ReactNode }) => <>{children}</>, HoverCardTrigger: ({ children }: { children: ReactNode }) => <>{children}</>, HoverCardContent: ({ children }: { children: ReactNode }) => <>{children}</> }))
import "@/routes/_protected/workouts/$workoutId/index"
import WorkoutRowCard from "@/components/workout-row-card"
afterEach(cleanup)
// @lat: [[training-display-tests#Training Display Tests#Caps display minutes and seconds]]
it.each([[600, "10:00"], [90, "1:30"], [45, "0:45"]])("formats a %s second cap in both detail and hover preview", (cap, expected) => {
  state.cap = cap
  const Page = state.component
  const view = render(<Page />)
  expect(screen.getByText(expected)).toBeInTheDocument()
  view.unmount()
  render(<WorkoutRowCard workout={{ id: "workout", name: "Capped", description: "Run", scheme: "time-with-cap", scope: "public", timeCap: cap }} />)
  expect(screen.getByText(`${expected} cap`)).toBeInTheDocument()
})
// @lat: [[training-display-tests#Training Display Tests#Workout score dates preserve calendar label]]
it("preserves the recorded day on workout score cards", () => {
  const Page = state.component
  render(<Page />)
  expect(screen.getByText("Sep 7, 2026")).toBeInTheDocument()
})
