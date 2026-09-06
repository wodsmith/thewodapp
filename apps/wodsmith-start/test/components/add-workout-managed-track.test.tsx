import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ add: vi.fn(), ai: vi.fn() }))
vi.mock("@/server-fns/programming-fns", () => ({ addWorkoutToTrackFn: mock.add }))
vi.mock("@/server-fns/workout-fns", () => ({ getWorkoutsFn: async () => ({ workouts: [{ id: "workout", name: "Existing workout" }] }) }))
vi.mock("@/components/workout-import/workout-import-entry", () => ({ WorkoutImportAccessButton: mock.ai }))
vi.mock("@/components/workout-import/workout-import-panel", () => ({ WorkoutImportPanel: () => null }))
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange: (value: string) => void }) => <select aria-label="Workout" value={value} onChange={(event) => onValueChange(event.target.value)}><option value="">Select a workout</option>{children}</select>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
}))
import { AddWorkoutToTrackDialog } from "@/components/add-workout-to-track-dialog"
import { CROSSFIT_TRACK_ID } from "@/lib/crossfit/source"
// @lat: [[workout-import-ux-tests#Workout Import UX Tests#Managed track append]]
it("keeps the managed CrossFit track on automatic manual append without exposing AI creation", async () => {
  mock.add.mockResolvedValue(undefined)
  render(<AddWorkoutToTrackDialog trackId={CROSSFIT_TRACK_ID} teamId="owner" />)
  fireEvent.click(screen.getByRole("button", { name: "Add workout" }))
  await screen.findByRole("option", { name: "Existing workout" })
  expect(screen.queryByLabelText("Track Order")).not.toBeInTheDocument()
  expect(mock.ai).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole("combobox", { name: "Workout" }), { target: { value: "workout" } })
  fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Append coaching note" } })
  fireEvent.click(screen.getByRole("button", { name: "Add workout" }))
  await waitFor(() => expect(mock.add).toHaveBeenCalledExactlyOnceWith({ data: { trackId: CROSSFIT_TRACK_ID, workoutId: "workout", notes: "Append coaching note" } }))
})
