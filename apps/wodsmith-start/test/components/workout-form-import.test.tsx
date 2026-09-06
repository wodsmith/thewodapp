import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { WorkoutForm, type WorkoutFormData } from "@/components/workout-form"
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))
vi.mock("@/components/movements-list", () => ({ MovementsList: () => null }))

describe("WorkoutForm import adapter", () => {
  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Explicit asynchronous draft application]]
  it("applies a controlled draft arriving after mount and submits cap seconds", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    function Harness() {
      const [value, onChange] = useState<Partial<WorkoutFormData>>({ scope: "private" })
      return <><button type="button" onClick={() => onChange({ name: "Capped workout", description: "3 rounds for time", scheme: "time-with-cap", timeCap: 720, roundsToScore: 1, repsPerRound: 30, movementIds: ["squat"], scope: "private" })}>Apply reviewed draft</button><WorkoutForm mode="create" editor={{ value, onChange }} onSubmit={onSubmit} backUrl="/workouts" embedded /></>
    }
    render(<Harness />)
    fireEvent.click(screen.getByText("Apply reviewed draft"))
    expect(screen.getByLabelText("Workout Name")).toHaveValue("Capped workout")
    expect(screen.getByLabelText("Time Cap (seconds)")).toHaveValue(720)
    fireEvent.click(screen.getByText("Create workout"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ timeCap: 720, roundsToScore: 1, repsPerRound: 30, movementIds: ["squat"] })))
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Manual edit and remix stability]]
  it.each([false, true])("keeps local edits when initial data changes (remix %s)", (isRemix) => {
    const props = { mode: "edit" as const, isRemix, onSubmit: vi.fn(), backUrl: "/workouts" }
    const { rerender } = render(<WorkoutForm {...props} initialData={{ name: "Original" }} />)
    fireEvent.change(screen.getByLabelText("Workout Name"), { target: { value: "My edit" } })
    rerender(<WorkoutForm {...props} initialData={{ name: "Late loader data" }} />)
    expect(screen.getByLabelText("Workout Name")).toHaveValue("My edit")
  })
})
