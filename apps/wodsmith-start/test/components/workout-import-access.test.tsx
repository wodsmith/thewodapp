import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ access: vi.fn(), agent: vi.fn(), save: vi.fn() }))
vi.mock("@/server-fns/workout-import-fns", () => ({ getWorkoutImportAccessFn: mock.access, saveWorkoutImportFn: mock.save }))
vi.mock("agents/react", () => ({ useAgent: mock.agent }))
vi.mock("@/server-fns/movement-fns", () => ({ getAllMovementsFn: vi.fn().mockResolvedValue({ movements: [] }) }))
import { WorkoutImportEntry } from "@/components/workout-import/workout-import-entry"
import { renderHook } from "@testing-library/react"
import { isWorkoutImportAccessError, workoutImportError, useWorkoutImportAccess } from "@/hooks/use-workout-import"

beforeEach(() => { mock.access.mockResolvedValue({ hasAccess: false }) })
describe("workout import access", () => {
  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Locked entry makes no agent requests]]
  it("renders access required without opening a socket, creating a session, or uploading", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    render(<WorkoutImportEntry destination={{ kind: "personal" }} saveLabel="Create workout" onSaved={vi.fn()} />)
    const locked = await screen.findByRole("button", { name: "AI Workout Import access required" })
    expect(locked).toBeDisabled()
    fireEvent.click(locked)
    expect(mock.agent).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mock.save).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Destination access race]]
  it("does not carry an entitled response into a newly selected destination", async () => {
    let resolveFirst!: (value: unknown) => void
    mock.access.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve })).mockResolvedValue({ hasAccess: false })
    const { result, rerender } = renderHook(({ trackId }) => useWorkoutImportAccess({ kind: "track", trackId }), { initialProps: { trackId: "track-one" } })
    rerender({ trackId: "track-two" })
    await waitFor(() => expect(result.current.result).toEqual({ hasAccess: false }))
    resolveFirst({ hasAccess: true, scope: { userId: "user", teamId: "other-team", destination: { kind: "track", trackId: "track-one" } }, teamName: "Other team", trackName: "Other track" })
    await waitFor(() => expect(mock.access).toHaveBeenCalledTimes(2))
    expect(result.current.result).toEqual({ hasAccess: false })
  })
  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Save denial classification]]
  it.each(["AI Workout Import access required", "Not authenticated", "access_required"])("recognizes save denial without a stale enabled UI: %s", (message) => {
    expect(isWorkoutImportAccessError(new Error(message))).toBe(true)
    expect(workoutImportError(new Error(message))).toMatch(/access required/)
  })

})
