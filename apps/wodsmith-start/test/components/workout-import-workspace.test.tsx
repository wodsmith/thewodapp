import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { WorkoutImportWorkspace, type WorkoutImportWorkspaceProps } from "@/components/workout-import/workout-import-workspace"
import { emptyImportWorkout } from "@/components/workout-import/editor-adapter"
import type { WorkoutImportDraft } from "@/lib/workout-import"
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))
vi.mock("@/components/movements-list", () => ({ MovementsList: () => null }))
const draft: WorkoutImportDraft = {
  schemaVersion: 1, importId: "import-1", revision: 1, requestId: "request-1", status: "ready", source: { text: "3 rounds for time, 12 minute cap" },
  workout: { ...emptyImportWorkout, name: "Capped workout", description: "3 rounds for time", scheme: "time-with-cap", scoreType: "min", timeCapSeconds: 720, roundsToScore: 1 },
  extractedText: "3 rounds for time", unresolved: [], warnings: [], changedFields: ["name", "description", "scheme", "timeCapSeconds"],
}
function props(overrides: Partial<WorkoutImportWorkspaceProps> = {}): WorkoutImportWorkspaceProps {
  return { destinationLabel: "Private workout · Personal team", saveLabel: "Create workout", draft, stage: "Ready", busy: false, accessRequired: false, error: null, movements: [], onRead: vi.fn(), onRevise: vi.fn(), onSave: vi.fn().mockResolvedValue(undefined), onCancel: vi.fn(), onClose: vi.fn(), onCheckAccess: vi.fn(), ...overrides }
}

describe("WorkoutImportWorkspace", () => {
  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Reviewed entitled save retries]]
  it("requires acceptance, preserves edits on failure, and reuses the save key", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValue(undefined)
    render(<WorkoutImportWorkspace {...props({ onSave })} />)
    expect(screen.getByRole("button", { name: "Create workout" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Apply selected fields" }))
    fireEvent.change(screen.getByLabelText("Workout Name"), { target: { value: "My corrected name" } })
    fireEvent.click(screen.getByRole("button", { name: "Create workout" }))
    await screen.findByText("Connection lost")
    expect(screen.getByLabelText("Workout Name")).toHaveValue("My corrected name")
    fireEvent.click(screen.getByRole("button", { name: "Create workout" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[0][0]).toEqual(onSave.mock.calls[1][0])
    expect(onSave.mock.calls[0][0].workout).toMatchObject({ timeCapSeconds: 720, roundsToScore: 1, name: "My corrected name" })
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Revoked access preserves edits]]
  it("locks all AI actions after revocation while preserving local editor values", () => {
    const initial = props()
    const { rerender } = render(<WorkoutImportWorkspace {...initial} />)
    fireEvent.click(screen.getByRole("button", { name: "Apply selected fields" }))
    fireEvent.change(screen.getByLabelText("Workout Name"), { target: { value: "Keep this edit" } })
    rerender(<WorkoutImportWorkspace {...initial} accessRequired />)
    expect(screen.getByText("AI Workout Import access required")).toBeVisible()
    expect(screen.getByLabelText("Workout Name")).toHaveValue("Keep this edit")
    expect(screen.getByRole("button", { name: "Create workout" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Read workout" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Review another proposal" })).toBeDisabled()
    expect(initial.onSave).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Multiple scored parts]]
  it("requires another proposal to select one independently scored part", () => {
    render(<WorkoutImportWorkspace {...props({ draft: { ...draft, unresolved: [{ id: "part", field: "selectedPart", reason: "Choose a workout", sourceExcerpt: "Strength and metcon", choices: ["Strength", "Metcon"] }] } })} />)
    fireEvent.click(screen.getByRole("button", { name: "Apply selected fields" }))
    expect(screen.getByText(/This has more than one workout/)).toBeVisible()
    expect(screen.getByRole("button", { name: "Create workout" })).toBeDisabled()
    expect(screen.queryByRole("combobox", { name: "Choose a workout" })).not.toBeInTheDocument()
  })
  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Cancelled revision keeps editor]]
  it("keeps manual edits visible after cancelling a revision but requires another proposal to save", async () => {
    const initial = props({ onCancel: vi.fn().mockResolvedValue(undefined) })
    const { rerender } = render(<WorkoutImportWorkspace {...initial} />)
    fireEvent.click(screen.getByRole("button", { name: "Apply selected fields" }))
    fireEvent.change(screen.getByLabelText("Workout Name"), { target: { value: "Keep after cancel" } })
    rerender(<WorkoutImportWorkspace {...initial} busy stage="Reading your correction" />)
    fireEvent.click(screen.getByRole("button", { name: "Cancel reading" }))
    await waitFor(() => expect(initial.onCancel).toHaveBeenCalled())
    rerender(<WorkoutImportWorkspace {...initial} draft={null} />)
    await screen.findByText(/Reading cancelled. Your source/)
    expect(screen.getByLabelText("Workout Name")).toHaveValue("Keep after cancel")
    expect(screen.getByRole("button", { name: "Create workout" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Undo last application" })).toBeInTheDocument()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Selected part focus]]
  it("focuses the correction field when choosing an independently scored part requires another proposal", async () => {
    render(<WorkoutImportWorkspace {...props({ draft: { ...draft, unresolved: [{ id: "part-focus", field: "selectedPart", reason: "Choose the part", sourceExcerpt: "Strength and metcon", choices: [] }] } })} />)
    fireEvent.click(screen.getByRole("button", { name: "Apply selected fields" }))
    await waitFor(() => expect(screen.getByLabelText("Ask for a change")).toHaveFocus())
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Removed source preview]]
  it("removes the prior authenticated image preview when choosing text-only source", () => {
    render(<WorkoutImportWorkspace {...props({ draft: null, sourceUrl: "/api/workout-import/sessions/old/source" })} />)
    expect(screen.getByRole("img")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }))
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

})
