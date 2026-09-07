import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({
  options: {} as Record<string, Record<string, (...args: any[]) => any>>,
  data: {} as Record<string, unknown>,
  save: vi.fn(), workouts: vi.fn(), training: vi.fn(), filters: vi.fn(),
}))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (options: Record<string, (...args: any[]) => any>) => { state.options[path] = options; return { useLoaderData: () => state.data, useSearch: () => ({}), useParams: () => ({ id: "log" }) } },
  useNavigate: () => vi.fn(), redirect: (value: unknown) => value,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock("@/server-fns/training-personal-fns", () => ({ getPersonalTrainingDayFn: vi.fn(), getPersonalLibraryScalingLevelsFn: vi.fn(), savePersonalLibraryResultFn: state.save, savePersonalTrainingSessionFn: vi.fn() }))
vi.mock("@/server-fns/workout-fns", () => ({ getWorkoutsFn: state.workouts, getWorkoutByIdFn: vi.fn(), getWorkoutFilterOptionsFn: state.filters }))
vi.mock("@/server-fns/training-fns", () => ({ getTrainingContextFn: state.training }))
vi.mock("@/server-fns/log-fns", () => ({ getLogByIdFn: vi.fn(), getScalingLevelsFn: vi.fn(), getScoreRoundsFn: vi.fn(), updateLogFn: vi.fn() }))
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))
vi.mock("@/components/workout-import/workout-import-entry", () => ({ WorkoutImportEntry: () => null }))
vi.mock("@/components/workout-filters", () => ({ WorkoutFilters: () => null }))
vi.mock("@/components/workout-card", () => ({ WorkoutCard: () => null }))
import "@/routes/_protected/log/new/index"
import "@/routes/_protected/log/$id/edit/index"
import "@/routes/_protected/workouts/index"
import "@/routes/_protected/workouts/$workoutId/schedule/index"
import { normalizePersonalLibraryScore } from "@/server/training-personal-scoring"
afterEach(cleanup)
// @lat: [[training-display-tests#Training Display Tests#New occurrence resets scoring inputs]]
it("resets scaling, Rx and score count for the newly selected occurrence", async () => {
  state.save.mockRejectedValue(new Error("Controlled test failure"))
  state.data = { selectedWorkout: { id: "old", name: "Old", scheme: "reps", roundsToScore: 1 }, scalingLevels: [{ id: "old-rx", label: "Rx", position: 0 }, { id: "old-scaled", label: "Scaled", position: 2 }], teamId: "gym", trainingDate: "2026-09-07", personalSessionId: "session", personalItemId: "old-item", personalRevision: 1 }
  const Page = state.options["/_protected/log/new/"].component
  const view = render(<Page />)
  fireEvent.click(screen.getByRole("button", { name: "Scaled" }))
  fireEvent.change(screen.getByLabelText("Score"), { target: { value: "42" } })
  state.data = { ...state.data, selectedWorkout: { id: "new", name: "New", scheme: "reps", roundsToScore: 3 }, scalingLevels: [{ id: "new-rx", label: "New Rx", position: 0 }], personalItemId: "new-item" }
  view.rerender(<Page />)
  const rounds = screen.getAllByPlaceholderText("Enter score...")
  expect(rounds).toHaveLength(3)
  for (const input of rounds) { expect(input).toHaveValue(""); fireEvent.change(input, { target: { value: "10" } }) }
  fireEvent.click(screen.getByRole("button", { name: "Save result" }))
  await waitFor(() => expect(state.save).toHaveBeenCalledWith({ data: expect.objectContaining({ itemId: "new-item", scalingLevelId: "new-rx", asRx: true, roundScores: [{ score: "10" }, { score: "10" }, { score: "10" }] }) }))
})
// @lat: [[training-display-tests#Training Display Tests#Current cap and round policy]]
it("rejects over-cap times and missing rounds while preserving valid cap and finish values", () => {
  const workout = { name: "Capped", description: "Run", scheme: "time-with-cap", timeCap: 600, roundsToScore: 1 }
  expect(() => normalizePersonalLibraryScore(workout, { score: "11:00" })).toThrow("exceeds the cap")
  expect(normalizePersonalLibraryScore(workout, { score: "10:00" })).toMatchObject({ scoreValue: 600000, status: "scored" })
  expect(normalizePersonalLibraryScore(workout, { score: "CAP+0" })).toMatchObject({ scoreValue: 600000, secondaryValue: 0, status: "cap" })
  expect(() => normalizePersonalLibraryScore(workout, { score: "CAP" })).toThrow()
  expect(() => normalizePersonalLibraryScore({ ...workout, roundsToScore: 3 }, { score: "", roundScores: [{ score: "1:00" }] })).toThrow("every prescribed round")
})
// @lat: [[training-display-tests#Training Display Tests#Library search reaches server pagination]]
it("passes library search and pagination to the accessible server query", async () => {
  state.training.mockResolvedValue({ teams: [{ id: "gym", timezone: "Asia/Tokyo" }], activeTeamId: "gym" })
  state.filters.mockResolvedValue({ tags: [], movements: [], tracks: [] })
  state.workouts.mockResolvedValue({ workouts: [{ id: "late", name: "Unique target" }], totalCount: 1, currentPage: 1, pageSize: 50 })
  const route = state.options["/_protected/workouts/"]
  const deps = route.loaderDeps({ search: { q: "Unique target", teamId: "gym", date: "2026-09-07", page: 1, pageSize: 50 } })
  const result = await route.loader({ deps })
  expect(state.workouts).toHaveBeenCalledWith({ data: { teamId: "gym", search: "Unique target", page: 1, pageSize: 50 } })
  expect(result.workouts).toEqual([{ id: "late", name: "Unique target" }])
})
// @lat: [[training-display-tests#Training Display Tests#Validated history return destinations]]
it("allows local log and training returns and rejects external or disguised redirect targets", () => {
  const validate = state.options["/_protected/log/$id/edit/"].validateSearch
  for (const redirectUrl of ["/log", "/training?teamId=gym&date=2026-09-07"]) expect(validate({ redirectUrl })).toEqual({ redirectUrl })
  for (const redirectUrl of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/training/../../evil", "/training.evil", "/log?redirect=https://evil.example"]) expect(validate({ redirectUrl }).redirectUrl).toBeUndefined()
})
// @lat: [[training-display-tests#Training Display Tests#Legacy scheduling preserves selected day]]
it("redirects old scheduling links with the exact selected date and no timestamp conversion", () => {
  const beforeLoad = state.options["/_protected/workouts/$workoutId/schedule/"].beforeLoad
  expect(() => beforeLoad({ params: { workoutId: "workout" }, search: { teamId: "gym", date: "2026-09-07" } })).toThrow(expect.objectContaining({ to: "/training", search: expect.objectContaining({ date: "2026-09-07", workoutId: "workout" }) }))
})
