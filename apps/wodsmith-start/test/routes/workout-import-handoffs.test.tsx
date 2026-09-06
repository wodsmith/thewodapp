import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentType, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({
  navigate: vi.fn().mockResolvedValue(undefined), invalidate: vi.fn(), submitLog: vi.fn(), getWorkouts: vi.fn(),
  getPersonalDay: vi.fn(), savePersonalSession: vi.fn(), importFailed: vi.fn(),
  data: {} as Record<string, unknown>, panelProps: {} as Record<string, unknown>,
}))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options, useLoaderData: () => mock.data, useSearch: () => ({ workoutId: "original" }) }),
  redirect: (options: unknown) => options,
  useNavigate: () => mock.navigate, useRouter: () => ({ invalidate: mock.invalidate }),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))
vi.mock("@/server-fns/training-personal-fns", () => ({
  getPersonalTrainingDayFn: mock.getPersonalDay,
  getPersonalLibraryScalingLevelsFn: vi.fn(),
  savePersonalLibraryResultFn: mock.submitLog,
  savePersonalTrainingSessionFn: mock.savePersonalSession,
}))
vi.mock("@/server-fns/workout-fns", () => ({ getWorkoutByIdFn: vi.fn(), getWorkoutsFn: mock.getWorkouts }))
vi.mock("@/server-fns/programming-fns", () => ({ getProgrammingTrackByIdFn: vi.fn(), getTrackWorkoutsFn: vi.fn(), addWorkoutToTrackFn: vi.fn() }))
vi.mock("@/components/track-header", () => ({ TrackHeader: () => null }))
vi.mock("@/components/track-workout-list", () => ({ TrackWorkoutList: () => null }))
vi.mock("@/components/workout-import/workout-import-entry", () => ({
  WorkoutImportEntry: ({ onSaved }: { onSaved: (result: { workoutId: string }) => Promise<void> }) => <button type="button" onClick={() => onSaved({ workoutId: "imported" }).catch(mock.importFailed)}>Finish entitled import</button>,
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
  mock.data = { workouts: [], selectedWorkout: { id: "original", name: "Original workout", description: "Prescription", scheme: "reps", roundsToScore: 1 }, scalingLevels: [], teamId: "team-personal", trainingDate: "2026-08-10", personalSessionId: "session-owned", personalItemId: "item-original", personalRevision: 3 }
  mock.getPersonalDay.mockResolvedValue({ personalSession: {
    id: "session-owned", teamId: "team-personal", trainingDate: "2026-08-10", revision: 4,
    items: [{ id: "item-original", kind: "library", workoutId: "original" }, { id: "concurrent-item", kind: "library", workoutId: "concurrent" }],
  } })
  mock.savePersonalSession.mockImplementation(async ({ data }) => ({ ...data, id: "session-owned", revision: data.expectedRevision + 1 }))
})
describe("workout import route handoffs", () => {
  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Log date and notes]]
  it("appends the imported workout to the current personal day and keeps notes without logging", async () => {
    const Page = LogRoute.options.component as ComponentType
    const { rerender } = render(<Page />)
    expect(screen.getByLabelText("Date")).toHaveAttribute("readonly")
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: "Keep my session notes" } })
    fireEvent.change(screen.getByLabelText("Score"), { target: { value: "75" } })
    fireEvent.click(screen.getByText("Finish entitled import"))
    await waitFor(() => expect(mock.navigate).toHaveBeenCalled())
    expect(mock.getPersonalDay).toHaveBeenCalledWith({ data: { teamId: "team-personal", trainingDate: "2026-08-10" } })
    const itemId = mock.savePersonalSession.mock.calls[0][0].data.items[2].id
    expect(mock.savePersonalSession).toHaveBeenCalledWith({ data: {
      teamId: "team-personal", trainingDate: "2026-08-10", expectedRevision: 4,
      items: [{ id: "item-original", kind: "library", workoutId: "original" }, { id: "concurrent-item", kind: "library", workoutId: "concurrent" }, { id: itemId, kind: "library", workoutId: "imported" }],
    } })
    expect(mock.navigate).toHaveBeenCalledWith({ to: "/log/new", search: {
      workoutId: "imported", teamId: "team-personal", date: "2026-08-10", personalSessionId: "session-owned", personalItemId: itemId, personalRevision: 5,
    } })
    mock.data = { ...mock.data, personalItemId: itemId, personalRevision: 5, selectedWorkout: { id: "imported", name: "New workout", description: "New prescription", scheme: "reps", roundsToScore: 1 } }
    rerender(<Page />)
    expect(screen.getByLabelText("Date")).toHaveValue("2026-08-10")
    expect(screen.getByLabelText(/Notes/)).toHaveValue("Keep my session notes")
    expect(screen.getByLabelText("Score")).toHaveValue("")
    expect(mock.submitLog).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Personal attachment retry]]
  it("reuses an attached occurrence after its composition response is lost", async () => {
    const Page = LogRoute.options.component as ComponentType
    render(<Page />)
    mock.savePersonalSession.mockImplementationOnce(async ({ data }) => {
      mock.getPersonalDay.mockResolvedValue({ personalSession: { ...data, id: "session-owned", revision: 5 } })
      throw new Error("Response lost")
    })
    fireEvent.click(screen.getByText("Finish entitled import"))
    await waitFor(() => expect(mock.importFailed).toHaveBeenCalled())
    expect(mock.navigate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("Finish entitled import"))
    await waitFor(() => expect(mock.navigate).toHaveBeenCalled())
    expect(mock.savePersonalSession).toHaveBeenCalledTimes(1)
    expect(mock.navigate.mock.calls[0][0].search.personalItemId).toBe(mock.savePersonalSession.mock.calls[0][0].data.items[2].id)
    expect(mock.submitLog).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Personal attachment conflict]]
  it("keeps the current log inputs when the composition rejects a stale save", async () => {
    const Page = LogRoute.options.component as ComponentType
    render(<Page />)
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: "Unsaved notes" } })
    fireEvent.change(screen.getByLabelText("Score"), { target: { value: "75" } })
    mock.savePersonalSession.mockRejectedValueOnce(new Error("CONFLICT: Refresh session"))
    fireEvent.click(screen.getByText("Finish entitled import"))
    await waitFor(() => expect(mock.importFailed).toHaveBeenCalled())
    expect(screen.getByLabelText(/Notes/)).toHaveValue("Unsaved notes")
    expect(screen.getByLabelText("Score")).toHaveValue("75")
    expect(mock.navigate).not.toHaveBeenCalled()
    expect(mock.submitLog).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Legacy log handoff]]
  it("redirects workout-only log links to Training without creating a session", async () => {
    const loader = LogRoute.options.loader as (options: unknown) => Promise<unknown>
    await expect(loader({ deps: { workoutId: "original" } })).rejects.toEqual({ href: "/training?workoutId=original" })
    expect(mock.getPersonalDay).not.toHaveBeenCalled()
    expect(mock.savePersonalSession).not.toHaveBeenCalled()
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
