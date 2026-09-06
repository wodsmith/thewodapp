import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentType, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({
  navigate: vi.fn().mockResolvedValue(undefined), invalidate: vi.fn(), submitLog: vi.fn(), getWorkouts: vi.fn(),
  data: {} as Record<string, unknown>, panelProps: {} as Record<string, unknown>,
}))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options, useLoaderData: () => mock.data, useSearch: () => ({ workoutId: "original" }) }),
  useNavigate: () => mock.navigate, useRouter: () => ({ invalidate: mock.invalidate }),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))
vi.mock("@/server-fns/log-fns", () => ({ getScalingLevelsFn: vi.fn(), submitLogFn: mock.submitLog }))
vi.mock("@/server-fns/workout-fns", () => ({ getWorkoutByIdFn: vi.fn(), getWorkoutsFn: mock.getWorkouts }))
vi.mock("@/server-fns/programming-fns", () => ({ getProgrammingTrackByIdFn: vi.fn(), getTrackWorkoutsFn: vi.fn(), addWorkoutToTrackFn: vi.fn() }))
vi.mock("@/components/track-header", () => ({ TrackHeader: () => null }))
vi.mock("@/components/track-workout-list", () => ({ TrackWorkoutList: () => null }))
vi.mock("@/components/workout-import/workout-import-entry", () => ({
  WorkoutImportEntry: ({ onSaved }: { onSaved: (result: { workoutId: string }) => void }) => <button type="button" onClick={() => onSaved({ workoutId: "imported" })}>Finish entitled import</button>,
  WorkoutImportAccessButton: ({ onClick }: { onClick: () => void }) => <button type="button" onClick={onClick}>Create with AI</button>,
}))
vi.mock("@/components/workout-import/workout-import-panel", () => ({
  WorkoutImportPanel: (props: Record<string, unknown>) => { mock.panelProps = props; return <button type="button" onClick={() => (props.onSaved as () => void)()}>Finish track import</button> },
}))
import { Route as LogRoute } from "@/routes/_protected/log/new/index"
import { Route as SettingsRoute } from "@/routes/_protected/settings/programming/$trackId/index"
import { Route as AdminRoute } from "@/routes/_protected/admin/teams/programming/$trackId/index"

beforeEach(() => {
  mock.navigate.mockResolvedValue(undefined)
  mock.getWorkouts.mockResolvedValue({ workouts: [] })
  mock.data = { workouts: [], selectedWorkout: { id: "original", name: "Original workout", description: "Prescription", scheme: "reps", roundsToScore: 1 }, scalingLevels: [], teamId: "team-personal" }
})
describe("workout import route handoffs", () => {
  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Log date and notes]]
  it("retains log date and notes while selecting the created workout without logging", async () => {
    const Page = LogRoute.options.component as ComponentType
    const { rerender } = render(<Page />)
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-08-10" } })
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: "Keep my session notes" } })
    fireEvent.change(screen.getByLabelText("Score"), { target: { value: "75" } })
    fireEvent.click(screen.getByText("Finish entitled import"))
    await waitFor(() => expect(mock.navigate).toHaveBeenCalledWith({ to: "/log/new", search: { workoutId: "imported" } }))
    mock.data = { ...mock.data, selectedWorkout: { id: "imported", name: "New workout", description: "New prescription", scheme: "reps", roundsToScore: 1 } }
    rerender(<Page />)
    expect(screen.getByLabelText("Date")).toHaveValue("2026-08-10")
    expect(screen.getByLabelText(/Notes/)).toHaveValue("Keep my session notes")
    expect(screen.getByLabelText("Score")).toHaveValue("")
    expect(mock.submitLog).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Track alias placement]]
  it.each([SettingsRoute, AdminRoute])("preserves displayed track destination, order and notes through the shared adapter", async (route) => {
    mock.data = { track: { id: "track-owned", name: "Strength", ownerTeamId: "team-owner" }, trackWorkouts: [], teamId: "team-owner", teamName: "Gym" }
    const Page = route.options.component as ComponentType
    render(<Page />)
    fireEvent.click(screen.getByRole("button", { name: "Add workout" }))
    fireEvent.change(screen.getByLabelText("Track Order"), { target: { value: "8" } })
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Keep track coaching notes" } })
    fireEvent.click(screen.getByRole("button", { name: "Create with AI" }))
    expect(mock.panelProps).toMatchObject({ destination: { kind: "track", trackId: "track-owned" }, track: { trackOrder: 8, notes: "Keep track coaching notes" }, saveLabel: "Create and add to track" })
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "Finish track import" }))
    await waitFor(() => expect(mock.invalidate).toHaveBeenCalled())
  })
})
