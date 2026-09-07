import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const api = vi.hoisted(() => ({ add: vi.fn(), workouts: vi.fn() }))
vi.mock("@/server-fns/programming-fns", () => ({ addWorkoutToTrackFn: api.add }))
vi.mock("@/server-fns/workout-fns", () => ({ getWorkoutsFn: api.workouts }))
vi.mock("@/components/workout-import/workout-import-entry", () => ({ WorkoutImportAccessButton: () => null }))
vi.mock("@/components/workout-import/workout-import-panel", () => ({ WorkoutImportPanel: () => null }))
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, disabled }: { children: ReactNode; value: string; disabled: boolean; onValueChange: (value: string) => void }) => <select aria-label="Workout" value={value} disabled={disabled} onChange={(event) => onValueChange(event.target.value)}><option value="">Select a workout</option>{children}</select>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null, SelectValue: () => null,
}))
import { AddWorkoutToTrackDialog } from "@/components/add-workout-to-track-dialog"
afterEach(cleanup)
beforeEach(() => {
  api.add.mockResolvedValue({})
  api.workouts.mockResolvedValue({ workouts: [{ id: "first", name: "First workout" }], totalCount: 1, currentPage: 1, pageSize: 50 })
})
async function openDialog() {
  render(<AddWorkoutToTrackDialog trackId="track" teamId="gym" />)
  fireEvent.click(screen.getByRole("button", { name: "Add workout" }))
  return screen.getByRole("dialog")
}
// @lat: [[training-correctness-tests#Training Correctness Tests#Successful add cannot repeat]]
it("locks submission through the success delay and closes once", async () => {
  const dialog = await openDialog()
  await screen.findByRole("option", { name: "First workout" })
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "first" } })
  const add = within(dialog).getByRole("button", { name: "Add workout" })
  fireEvent.click(add)
  await screen.findByText("Workout added to track")
  expect(add).toBeDisabled()
  fireEvent.click(add)
  expect(api.add).toHaveBeenCalledOnce()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), { timeout: 2000 })
})
// @lat: [[training-correctness-tests#Training Correctness Tests#Track picker reaches later pages]]
it("loads later pages and submits a workout beyond the first hundred", async () => {
  api.workouts.mockImplementation(async ({ data }: { data: { page: number; pageSize: number } }) => ({
    workouts: Array.from({ length: data.page === 3 ? 1 : 50 }, (_, i) => ({ id: `w${(data.page - 1) * 50 + i}`, name: `Workout ${(data.page - 1) * 50 + i}` })),
    totalCount: 101, currentPage: data.page, pageSize: data.pageSize,
  }))
  const dialog = await openDialog()
  await screen.findByRole("option", { name: "Workout 49" })
  fireEvent.click(screen.getByRole("button", { name: "Load more workouts" }))
  await screen.findByRole("option", { name: "Workout 99" })
  fireEvent.click(screen.getByRole("button", { name: "Load more workouts" }))
  await screen.findByRole("option", { name: "Workout 100" })
  expect(screen.queryByRole("button", { name: "Load more workouts" })).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "w100" } })
  fireEvent.click(within(dialog).getByRole("button", { name: "Add workout" }))
  await waitFor(() => expect(api.add).toHaveBeenCalledWith({ data: { trackId: "track", workoutId: "w100", trackOrder: 1, notes: undefined } }))
})
// @lat: [[training-correctness-tests#Training Correctness Tests#Failed add can retry]]
it("retains the selected workout after failure and permits a retry", async () => {
  api.add.mockRejectedValueOnce(new Error("Try again"))
  const dialog = await openDialog()
  await screen.findByRole("option", { name: "First workout" })
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "first" } })
  fireEvent.click(within(dialog).getByRole("button", { name: "Add workout" }))
  await screen.findByText("Try again")
  expect(screen.getByRole("combobox")).toHaveValue("first")
  fireEvent.click(within(dialog).getByRole("button", { name: "Add workout" }))
  await screen.findByText("Workout added to track")
  expect(api.add).toHaveBeenCalledTimes(2)
})
// @lat: [[training-correctness-tests#Training Correctness Tests#Failed page load can retry]]
it("shows a page error and retries the same page without losing loaded choices", async () => {
  api.workouts.mockResolvedValueOnce({ workouts: [{ id: "first", name: "First workout" }], totalCount: 51, currentPage: 1, pageSize: 50 }).mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce({ workouts: [{ id: "last", name: "Last workout" }], totalCount: 51, currentPage: 2, pageSize: 50 })
  await openDialog()
  await screen.findByRole("option", { name: "First workout" })
  fireEvent.click(screen.getByRole("button", { name: "Load more workouts" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load workouts")
  fireEvent.click(screen.getByRole("button", { name: "Retry loading workouts" }))
  await screen.findByRole("option", { name: "Last workout" })
  expect(screen.getByRole("option", { name: "First workout" })).toBeInTheDocument()
  expect(api.workouts.mock.calls.map(([request]) => request.data.page)).toEqual([1, 2, 2])
})
