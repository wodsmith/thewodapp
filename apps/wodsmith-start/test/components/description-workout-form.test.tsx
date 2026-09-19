import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { WorkoutForm } from "@/components/workout-form"
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))
import { DescriptionWorkoutForm } from "@/components/workouts/description-workout-form"
import { describeWorkoutFn } from "@/server-fns/workout-authoring-fns"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"

vi.mock("@/server-fns/workout-authoring-fns", () => ({ describeWorkoutFn: vi.fn() }))
const workout: NormalizedWorkoutSave = { name: "Fran", description: "21-15-9 thrusters", scheme: "time-with-cap", scoreType: "min", roundsToScore: 1, timeCapSeconds: 600, repsPerRound: null, tiebreakScheme: null, scalingGroupId: "group", scalingDescriptions: [{ scalingLevelId: "rx", description: "95 lb" }], movementIds: ["thruster"], scope: "private" }
describe("description creation lifecycle", () => {
  it("discards an in-flight recognition result when the destination changes", async () => {
    let finish!: (value: NormalizedWorkoutSave) => void
    vi.mocked(describeWorkoutFn).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const onSubmit = vi.fn()
    const props = { onSubmit, onCancel: vi.fn() }
    const { rerender } = render(<DescriptionWorkoutForm {...props} context={{ kind: "personal", teamId: "first" }} />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "30 thrusters for time" } })
    fireEvent.click(screen.getByRole("button", { name: "Create workout" }))
    rerender(<DescriptionWorkoutForm {...props} context={{ kind: "personal", teamId: "second" }} />)
    await act(async () => finish(workout))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("textbox")).toHaveValue("30 thrusters for time")
  })
  it("adapts library cap seconds and scaling prescriptions without exposing structured creation controls", async () => {
    vi.mocked(describeWorkoutFn).mockResolvedValue(workout)
    const onSubmit = vi.fn()
    render(<WorkoutForm mode="create" authoringContext={{ kind: "library", teamId: "gym" }} onSubmit={onSubmit} backUrl="/workouts" />)
    fireEvent.change(screen.getByLabelText("Describe your workout"), { target: { value: "Fran for time" } })
    fireEvent.click(screen.getByRole("button", { name: "Create workout" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ timeCap: 600, scalingGroupId: "group", scalingDescriptions: workout.scalingDescriptions, movementIds: ["thruster"] })))
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })
  // @lat: [[workout-authoring#Workout Authoring#Description creation lifecycle]]
  it("shows just one field, retains text on failure and retries the same complete definition", async () => {
    vi.mocked(describeWorkoutFn).mockResolvedValue(workout)
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("Save unavailable")).mockResolvedValue(undefined)
    render(<DescriptionWorkoutForm context={{ kind: "competition", competitionId: "comp" }} onSubmit={onSubmit} onCancel={vi.fn()} />)
    expect(screen.getAllByRole("textbox")).toHaveLength(1)
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Describe your workout"), { target: { value: "Fran for time with a 10 minute cap" } })
    fireEvent.click(screen.getByRole("button", { name: "Create workout" }))
    await screen.findByText("Save unavailable")
    expect(screen.getByRole("textbox")).toHaveValue("Fran for time with a 10 minute cap")
    fireEvent.click(screen.getByRole("button", { name: "Create workout" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
    expect(onSubmit).toHaveBeenLastCalledWith(workout)
    expect(describeWorkoutFn).toHaveBeenCalledTimes(1)
    expect(describeWorkoutFn).toHaveBeenCalledWith({ data: { context: { kind: "competition", competitionId: "comp" }, description: "Fran for time with a 10 minute cap" } })
  })
  it("does not save when recognition fails, and reclassifies after text changes", async () => {
    vi.mocked(describeWorkoutFn).mockRejectedValueOnce(new Error("Clarify scoring")).mockResolvedValue(workout)
    const onSubmit = vi.fn()
    render(<DescriptionWorkoutForm context={{ kind: "personal", teamId: "gym" }} onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Thrusters" } })
    fireEvent.click(screen.getByRole("button", { name: "Create workout" }))
    await screen.findByText("Clarify scoring")
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "30 thrusters for time" } })
    fireEvent.click(screen.getByRole("button", { name: "Create workout" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(workout))
    expect(describeWorkoutFn).toHaveBeenCalledTimes(2)
  })
})
