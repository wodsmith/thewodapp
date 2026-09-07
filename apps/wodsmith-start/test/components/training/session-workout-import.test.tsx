import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WorkoutImportPanelProps } from "@/components/workout-import/workout-import-panel"
import type { TrainingContext } from "@/lib/training/types"

const api = vi.hoisted(() => ({
  access: vi.fn(), day: vi.fn(), detail: vi.fn(), savePersonal: vi.fn(), result: vi.fn(),
  week: vi.fn(), saveDraft: vi.fn(), publish: vi.fn(), blocker: vi.fn(),
  panel: null as WorkoutImportPanelProps | null, panelError: vi.fn(),
}))
vi.mock("@/server-fns/workout-import-fns", () => ({ getWorkoutImportAccessFn: api.access }))
vi.mock("agents/react", () => ({ useAgent: vi.fn() }))
vi.mock("@/server-fns/training-personal-fns", () => ({
  getPersonalTrainingDayFn: api.day, getTrainingLibraryWorkoutFn: api.detail,
  savePersonalTrainingSessionFn: api.savePersonal, savePersonalTrainingResultFn: api.result,
  listTrainingLibraryWorkoutsFn: vi.fn(),
}))
vi.mock("@/server-fns/training-fns", () => ({
  getTrainingWeekFn: api.week, saveTrainingDraftFn: api.saveDraft,
  publishTrainingSessionFn: api.publish, copyTrainingSessionFn: vi.fn(),
}))
vi.mock("@tanstack/react-router", async (actual) => ({ ...await actual<object>(), useBlocker: api.blocker }))
vi.mock("@/components/crossfit-track-days", () => ({ CrossFitTrackDays: () => null }))
vi.mock("@/components/workout-import/workout-import-panel", () => ({
  WorkoutImportPanel: (props: WorkoutImportPanelProps) => {
    api.panel = props
    return <>
      <p>Reviewed import workspace</p>
      <button type="button" onClick={() => Promise.resolve().then(() => props.onSaved(receipt)).catch(api.panelError)}>Finish reviewed import</button>
      <button type="button" onClick={props.onClose}>Close import</button>
    </>
  },
}))
import { AthletePersonalSession } from "@/components/training/athlete-personal-session"
import { CoachPlanner } from "@/components/training/coach-planner"

const receipt = { workoutId: "imported", importId: "import-one", revision: 1, trackWorkoutId: null }
const context: TrainingContext = { userId: "me", activeTeamId: "gym", teams: [{
  id: "gym", name: "Selected gym", timezone: "UTC", canProgram: true,
  tracks: [{ id: "everyday", name: "Everyday", description: null }, { id: "compete", name: "Compete", description: null }],
}] }
const workout = { id: "imported", name: "Imported workout", description: "21-15-9 thrusters and pull-ups", scheme: "time", scoreType: "min", roundsToScore: 1, timeCap: null, repsPerRound: null, tiebreakScheme: null, scalingGroupId: null }
const day = { defaultTrackId: "everyday", selectedTrackId: "everyday", sourceSession: null, personalSession: null, results: [], libraryResults: [], items: [] }
function personal(trackId = "everyday", onInteractionBusy = vi.fn()) {
  return <AthletePersonalSession team={context.teams[0]} trackId={trackId} date="2026-09-07" sourceResults={[]} onSaved={vi.fn()} onInteractionBusy={onInteractionBusy} />
}
async function openImport() {
  const entry = await screen.findByRole("button", { name: "Import workout" })
  await waitFor(() => expect(entry).toBeEnabled())
  fireEvent.click(entry)
  await screen.findByText("Reviewed import workspace")
}
async function finishImport() {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Finish reviewed import" })))
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-07T12:00:00Z"))
  api.access.mockResolvedValue({ hasAccess: true, scope: { userId: "me", teamId: "personal-team", destination: { kind: "personal" } }, teamName: "Personal", scalingGroups: [] })
  api.day.mockResolvedValue(day)
  api.detail.mockResolvedValue(workout)
  api.week.mockResolvedValue({ sessions: [], myResults: [], teamResults: [] })
  api.blocker.mockReturnValue({ status: "idle" })
  api.saveDraft.mockRejectedValue(new Error("Keep the draft for review"))
  api.panel = null
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe("session workout import", () => {
  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Personal session import confirmation]]
  it("uses personal entitlement and queues rich scoring for explicit composition on the selected gym day", async () => {
    api.detail.mockResolvedValue({ ...workout, roundsToScore: 3, timeCap: 900, tiebreakScheme: "time" })
    const busy = vi.fn()
    render(personal("compete", busy))
    await openImport()
    expect(api.access).toHaveBeenCalledWith({ data: { destination: { kind: "personal" } } })
    expect(busy).toHaveBeenLastCalledWith(true)
    await finishImport()
    const confirm = await screen.findByRole("button", { name: "Add to my session" })
    await waitFor(() => expect(confirm).toBeEnabled())
    expect(api.detail).toHaveBeenCalledWith({ data: { teamId: "gym", workoutId: "imported" } })
    expect(api.savePersonal).not.toHaveBeenCalled()
    expect(busy).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole("button", { name: "Import workout" })).toBeDisabled()
    await act(async () => fireEvent.click(confirm))
    await waitFor(() => expect(api.savePersonal).toHaveBeenCalledWith({ data: {
      teamId: "gym", trainingDate: "2026-09-07", expectedRevision: 0,
      items: [{ id: expect.any(String), kind: "library", workoutId: "imported" }],
    } }))
    expect(api.day).toHaveBeenCalledWith({ data: { teamId: "gym", trainingDate: "2026-09-07", trackId: "compete" } })
    expect(api.result).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Session import entitlement gate]]
  it.each(["personal", "coach"])("keeps the %s session manual flow available when personal AI access is denied", async (kind) => {
    api.access.mockResolvedValue({ hasAccess: false })
    render(kind === "personal" ? personal() : <CoachPlanner context={context} />)
    const locked = await screen.findByRole("button", { name: "Workout import access required" })
    expect(locked).toBeDisabled()
    fireEvent.click(locked)
    expect(api.panel).toBeNull()
    expect(api.detail).not.toHaveBeenCalled()
    expect(api.savePersonal).not.toHaveBeenCalled()
    expect(api.saveDraft).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: kind === "personal" ? "Create workout" : "Add a section" })).toBeEnabled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Personal session import recovery]]
  it("keeps confirmation after composition failure and lets cancellation leave the session untouched", async () => {
    api.savePersonal.mockRejectedValue(new Error("CONFLICT: Refresh this session"))
    render(personal())
    await openImport()
    await finishImport()
    const confirm = await screen.findByRole("button", { name: "Add to my session" })
    await waitFor(() => expect(confirm).toBeEnabled())
    await act(async () => fireEvent.click(confirm))
    expect(await screen.findByRole("alert")).toHaveTextContent("CONFLICT")
    expect(confirm).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("button", { name: "Add to my session" })).not.toBeInTheDocument()
    expect(api.savePersonal).toHaveBeenCalledTimes(1)
    expect(api.result).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Personal session import context race]]
  it("rejects a saved import callback after track changes and after unmount", async () => {
    const view = render(personal())
    await openImport()
    const oldSave = api.panel!.onSaved
    view.rerender(personal("compete"))
    await waitFor(() => expect(screen.queryByText("Reviewed import workspace")).not.toBeInTheDocument())
    await expect(oldSave(receipt)).rejects.toThrow("import was closed")
    await openImport()
    const unmountedSave = api.panel!.onSaved
    view.unmount()
    await expect(unmountedSave(receipt)).rejects.toThrow("import was closed")
    expect(api.savePersonal).not.toHaveBeenCalled()
    expect(api.detail).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Personal manual session editor safety]]
  it("does not expose an import that could overwrite an open manual workout", async () => {
    render(personal())
    fireEvent.click(await screen.findByRole("button", { name: "Create workout" }))
    expect(screen.queryByRole("button", { name: "Import workout" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save to my session" })).toBeInTheDocument()
    expect(api.savePersonal).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Coach session import draft]]
  it("appends supported scoring to an unsaved coach draft without losing edits or publishing", async () => {
    render(<CoachPlanner context={context} />)
    const title = await screen.findByLabelText("Session title")
    fireEvent.change(title, { target: { value: "My unsaved plan" } })
    fireEvent.click(screen.getByRole("button", { name: "Add a section" }))
    fireEvent.change(screen.getByLabelText("Section title"), { target: { value: "Manual warm-up" } })
    await openImport()
    expect(api.blocker.mock.lastCall?.[0].shouldBlockFn()).toBe(true)
    await finishImport()
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(title).toHaveValue("My unsaved plan")
    expect(screen.getByRole("region", { name: "Section 1: Manual warm-up" })).toBeInTheDocument()
    expect(screen.getByLabelText("Section title")).toHaveValue("Imported workout")
    expect(api.saveDraft).not.toHaveBeenCalled()
    expect(api.publish).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledWith({ data: expect.objectContaining({
      teamId: "gym", trackId: "everyday", trainingDate: "2026-09-07", expectedRevision: 0,
      content: expect.objectContaining({ title: "My unsaved plan", blocks: [expect.objectContaining({ title: "Manual warm-up" }), expect.objectContaining({ title: "Imported workout", kind: "time", prescription: workout.description })] }),
    }) }))
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Coach import scoring compatibility]]
  it.each([{ timeCap: 900 }, { roundsToScore: 3 }, { tiebreakScheme: "time" }])("shows incompatible scoring without flattening the saved library workout: %j", async (scoring) => {
    api.detail.mockResolvedValue({ ...workout, ...scoring })
    render(<CoachPlanner context={context} />)
    const title = await screen.findByLabelText("Session title")
    fireEvent.change(title, { target: { value: "Keep my draft" } })
    await openImport()
    await finishImport()
    expect(await screen.findByRole("alert")).toHaveTextContent("scoring the session composer cannot preserve")
    expect(screen.getByRole("alert")).toHaveTextContent("saved in the library")
    fireEvent.click(screen.getByRole("button", { name: "Close import" }))
    expect(title).toHaveValue("Keep my draft")
    expect(screen.queryByLabelText("Section title")).not.toBeInTheDocument()
    expect(api.saveDraft).not.toHaveBeenCalled()
    expect(api.publish).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Coach session import context race]]
  it("ignores an in-flight library lookup after leaving the coach session", async () => {
    let resolve!: (value: typeof workout) => void
    api.detail.mockReturnValue(new Promise((done) => { resolve = done }))
    const view = render(<CoachPlanner context={context} />)
    await openImport()
    await finishImport()
    await waitFor(() => expect(api.detail).toHaveBeenCalled())
    view.unmount()
    await act(async () => resolve(workout))
    await waitFor(() => expect(api.panelError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("selected session changed") })))
    expect(api.saveDraft).not.toHaveBeenCalled()
  })
})

// @lat: [[workout-import-ux-tests#Workout Import UX Tests#Closed session import handoff]]
it("cancels a pending coach handoff while preserving the title and manual section", async () => {
  let resolve!: (value: typeof workout) => void
  api.detail.mockReturnValue(new Promise((done) => { resolve = done }))
  render(<CoachPlanner context={context} />)
  const title = await screen.findByLabelText("Session title")
  fireEvent.change(title, { target: { value: "Keep my plan" } })
  fireEvent.click(screen.getByRole("button", { name: "Add a section" }))
  fireEvent.change(screen.getByLabelText("Section title"), { target: { value: "Manual warm-up" } })
  await openImport()
  const oldSave = api.panel!.onSaved
  await finishImport()
  await waitFor(() => expect(api.detail).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole("button", { name: "Close import" }))
  await act(async () => resolve(workout))
  await waitFor(() => expect(api.panelError).toHaveBeenCalled())
  expect(title).toHaveValue("Keep my plan")
  expect(screen.getByLabelText("Section title")).toHaveValue("Manual warm-up")
  expect(screen.queryByText("Imported workout")).not.toBeInTheDocument()
  await expect(oldSave(receipt)).rejects.toThrow("import was closed")
  expect(api.detail).toHaveBeenCalledTimes(1)
  expect(api.saveDraft).not.toHaveBeenCalled()
  expect(api.publish).not.toHaveBeenCalled()
})

// @lat: [[workout-import-ux-tests#Workout Import UX Tests#Coach session import capacity]]
it("disables AI import when the coach session already has 20 sections", async () => {
  const content = { title: "Full session", coachNote: "", isRestDay: false, blocks: Array.from({ length: 20 }, (_, index) => ({ id: `section-${index}`, kind: "check", title: `Section ${index}`, prescription: "Move well", scalingGuidance: "", coachGuidance: "" })) }
  api.week.mockResolvedValue({ sessions: [{ id: "session", teamId: "gym", trackId: "everyday", trainingDate: "2026-09-07", timezone: "UTC", revision: 1, publishedVersion: 0, draft: content, published: null }], myResults: [], teamResults: [] })
  render(<CoachPlanner context={context} />)
  const entry = await screen.findByRole("button", { name: "Import workout" })
  expect(entry).toBeDisabled()
  fireEvent.click(entry)
  expect(api.panel).toBeNull()
})
