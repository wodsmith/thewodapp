import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ create: vi.fn(), cancel: vi.fn(), read: vi.fn(), upload: vi.fn(), snapshot: vi.fn(), refresh: vi.fn(), ready: true, file: null as File | null, failure: vi.fn() }))
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))
vi.mock("@/server-fns/movement-fns", () => ({ getAllMovementsFn: async () => ({ movements: [] }) }))
vi.mock("@/server-fns/workout-import-fns", () => ({ saveWorkoutImportFn: vi.fn() }))
vi.mock("@/hooks/use-workout-import", () => {
  const result = { hasAccess: true, scope: { userId: "user", teamId: "personal", destination: { kind: "personal" } }, teamName: "Personal", trackName: null, scalingGroups: [] }
  return {
    createImportSession: mock.create, cancelImportSession: mock.cancel, uploadImportSource: mock.upload,
    getImportSnapshot: mock.snapshot, isWorkoutImportAccessError: (error: unknown) => String(error).includes("access_required"), workoutImportError: String,
    workoutImportDestinationKey: () => "personal",
    useWorkoutImportAccess: () => ({ result, loading: false, refresh: mock.refresh }),
    useWorkoutImport: () => ({ ready: mock.ready, state: null, read: mock.read, revise: vi.fn(), cancel: vi.fn(), connectionError: null }),
  }
})
vi.mock("@/components/workout-import/workout-import-workspace", () => ({
  WorkoutImportWorkspace: ({ onRead, onCancel, busy, accessRequired }: { onCancel: () => Promise<void>; accessRequired: boolean; onRead: (text: string, file: File | null, requestId: string) => Promise<void>; busy: boolean }) => <><button type="button" disabled={busy || accessRequired} onClick={() => void onRead("3 rounds for time", mock.file, crypto.randomUUID()).catch(mock.failure)}>Read fixture</button><button type="button" onClick={() => void onCancel().catch(mock.failure)}>Cancel fixture</button></>,
}))
import { WorkoutImportPanel } from "@/components/workout-import/workout-import-panel"
beforeEach(() => {
  sessionStorage.clear()
  mock.ready = true
  mock.file = null
  mock.refresh.mockResolvedValue({ hasAccess: true })
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

// @lat: [[workout-import-ux-tests#Workout Import UX Tests#Expired session restoration]]
it("clears an expired stored session and can read again without locking destination access", async () => {
  sessionStorage.setItem("workout-import:user:personal", "expired")
  mock.snapshot.mockRejectedValue(new Error("source_expired"))
  const view = render(<WorkoutImportPanel destination={{ kind: "personal" }} saveLabel="Create workout" onSaved={vi.fn()} onClose={vi.fn()} />)
  await waitFor(() => expect(sessionStorage.getItem("workout-import:user:personal")).toBeNull())
  view.unmount()
  render(<WorkoutImportPanel destination={{ kind: "personal" }} saveLabel="Create workout" onSaved={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Read fixture" }))
  await waitFor(() => expect(mock.read).toHaveBeenCalledTimes(1))
  expect(mock.read.mock.calls[0][0]).toMatchObject({ importId: "first", expectedRevision: 0 })
  expect(mock.cancel).not.toHaveBeenCalled()
  expect(mock.snapshot).toHaveBeenCalledExactlyOnceWith("expired")
})

// @lat: [[workout-import-ux-tests#Workout Import UX Tests#Denied session restoration]]
it("retains access denial for a revoked or unowned stored session", async () => {
  sessionStorage.setItem("workout-import:user:personal", "denied")
  mock.snapshot.mockRejectedValue(new Error("access_required"))
  render(<WorkoutImportPanel destination={{ kind: "personal" }} saveLabel="Create workout" onSaved={vi.fn()} onClose={vi.fn()} />)
  await waitFor(() => expect(screen.getByRole("button", { name: "Read fixture" })).toBeDisabled())
  expect(sessionStorage.getItem("workout-import:user:personal")).toBe("denied")
  expect(mock.create).not.toHaveBeenCalled()
  expect(mock.read).not.toHaveBeenCalled()
})

// @lat: [[workout-import-ux-tests#Workout Import UX Tests#Cancel pending source operations]]
it.each(["create", "socket", "upload"])("never reads after cancellation during %s", async (boundary) => {
  let finish!: (value: unknown) => void
  const pending = new Promise((resolve) => { finish = resolve })
  if (boundary === "create") mock.create.mockReset().mockReturnValue(pending)
  if (boundary === "socket") mock.ready = false
  if (boundary === "upload") {
    mock.file = new File(["image"], "workout.png", { type: "image/png" })
    mock.upload.mockReturnValue(pending)
  }
  const view = render(<WorkoutImportPanel destination={{ kind: "personal" }} saveLabel="Create workout" onSaved={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Read fixture" }))
  await waitFor(() => expect(mock.create).toHaveBeenCalled())
  if (boundary === "upload") await waitFor(() => expect(mock.upload).toHaveBeenCalled())
  if (boundary === "socket") await waitFor(() => expect(sessionStorage.getItem("workout-import:user:personal")).toBe("first"))
  fireEvent.click(screen.getByRole("button", { name: "Cancel fixture" }))
  await act(async () => {
    finish(boundary === "create" ? { importId: "late", agentName: "late", expiresAt: "later" } : { imageId: "first", url: "/source" })
  })
  if (boundary === "socket") {
    mock.ready = true
    view.rerender(<WorkoutImportPanel destination={{ kind: "personal" }} saveLabel="Create workout" onSaved={vi.fn()} onClose={vi.fn()} />)
  }
  await waitFor(() => expect(mock.cancel).toHaveBeenCalledWith(boundary === "create" ? "late" : "first"))
  await waitFor(() => expect(screen.getByRole("button", { name: "Read fixture" })).toBeEnabled())
  expect(mock.read).not.toHaveBeenCalled()
  expect(mock.failure).not.toHaveBeenCalled()
  expect(sessionStorage.getItem("workout-import:user:personal")).toBeNull()
})

// @lat: [[workout-import-ux-tests#Workout Import UX Tests#Access check failure blocks operations]]
it("blocks a read on a failed fresh access check without revoking the destination", async () => {
  mock.refresh.mockResolvedValue(null)
  render(<WorkoutImportPanel destination={{ kind: "personal" }} saveLabel="Create workout" onSaved={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Read fixture" }))
  await waitFor(() => expect(mock.failure).toHaveBeenCalled())
  expect(screen.getByRole("button", { name: "Read fixture" })).toBeEnabled()
  expect(mock.create).not.toHaveBeenCalled()
  expect(mock.read).not.toHaveBeenCalled()
})
