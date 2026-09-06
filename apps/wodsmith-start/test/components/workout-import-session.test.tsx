import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ create: vi.fn(), cancel: vi.fn(), read: vi.fn(), upload: vi.fn() }))
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))
vi.mock("@/server-fns/movement-fns", () => ({ getAllMovementsFn: async () => ({ movements: [] }) }))
vi.mock("@/server-fns/workout-import-fns", () => ({ saveWorkoutImportFn: vi.fn() }))
vi.mock("@/hooks/use-workout-import", () => {
  const result = { hasAccess: true, scope: { userId: "user", teamId: "personal", destination: { kind: "personal" } }, teamName: "Personal", trackName: null, scalingGroups: [] }
  return {
    createImportSession: mock.create, cancelImportSession: mock.cancel, uploadImportSource: mock.upload,
    getImportSnapshot: vi.fn(), isWorkoutImportAccessError: () => false, workoutImportError: String,
    workoutImportDestinationKey: () => "personal",
    useWorkoutImportAccess: () => ({ result, loading: false, refresh: async () => result }),
    useWorkoutImport: () => ({ ready: true, state: null, read: mock.read, revise: vi.fn(), cancel: vi.fn(), connectionError: null }),
  }
})
vi.mock("@/components/workout-import/workout-import-workspace", () => ({
  WorkoutImportWorkspace: ({ onRead, busy }: { onRead: (text: string, file: null, requestId: string) => Promise<void>; busy: boolean }) => <button type="button" disabled={busy} onClick={() => void onRead("3 rounds for time", null, crypto.randomUUID())}>Read fixture</button>,
}))
import { WorkoutImportPanel } from "@/components/workout-import/workout-import-panel"
beforeEach(() => {
  sessionStorage.clear()
  mock.create.mockResolvedValueOnce({ importId: "first", agentName: "first", expiresAt: "later" }).mockResolvedValueOnce({ importId: "second", agentName: "second", expiresAt: "later" })
  mock.cancel.mockResolvedValue({ cancelled: true })
  mock.read.mockResolvedValue(undefined)
})
// @lat: [[workout-import-ux-tests#Workout Import UX Tests#Fresh source session]]
it("starts source rereads in a fresh session at revision zero and cancels the prior source", async () => {
  render(<WorkoutImportPanel destination={{ kind: "personal" }} saveLabel="Create workout" onSaved={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Read fixture" }))
  await waitFor(() => expect(mock.read).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.getByRole("button", { name: "Read fixture" })).toBeEnabled())
  fireEvent.click(screen.getByRole("button", { name: "Read fixture" }))
  await waitFor(() => expect(mock.read).toHaveBeenCalledTimes(2))
  expect(mock.cancel).toHaveBeenCalledWith("first")
  expect(mock.read.mock.calls[0][0]).toMatchObject({ importId: "first", expectedRevision: 0 })
  expect(mock.read.mock.calls[1][0]).toMatchObject({ importId: "second", expectedRevision: 0 })
  expect(mock.upload).not.toHaveBeenCalled()
})
