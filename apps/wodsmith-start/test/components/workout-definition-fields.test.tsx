import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { WorkoutDefinitionFields } from "@/components/workouts/workout-definition-fields"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"

describe("shared workout definition fields", () => {
  it("changes scheme using canonical score defaults and removes an irrelevant cap", () => {
    const change = vi.fn()
    render(
      <WorkoutDefinitionFields
        value={{
          scheme: "time-with-cap",
          scoreType: "sum",
          timeCapSeconds: 720,
        }}
        onChange={change}
      />,
    )
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Scheme" }), {
      key: "ArrowDown",
    })
    fireEvent.click(screen.getByRole("option", { name: "Max Load" }))
    expect(change).toHaveBeenCalledWith({
      scheme: "load",
      scoreType: "max",
      timeCapSeconds: null,
    })
  })

  it("lets import review correct reps per round on capped workouts and announces movement selections", () => {
    function Harness() {
      const [value, setValue] = useState<Partial<NormalizedWorkoutSave>>({
        scheme: "time-with-cap",
        repsPerRound: 30,
        movementIds: ["thruster"],
      })
      return (
        <>
          <WorkoutDefinitionFields
            value={value}
            onChange={(patch) =>
              setValue((current) => ({ ...current, ...patch }))
            }
            movements={[
              { id: "thruster", name: "Thruster", type: "weightlifting" },
            ]}
          />
          <output>{JSON.stringify(value)}</output>
        </>
      )
    }
    render(<Harness />)
    fireEvent.change(screen.getByLabelText("Reps per Round (optional)"), {
      target: { value: "45" },
    })
    expect(screen.getByRole("status")).toHaveTextContent('"repsPerRound":45')
    const movement = screen.getByRole("button", { name: /Thruster/ })
    expect(movement).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(movement)
    expect(movement).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("status")).toHaveTextContent('"movementIds":[]')
  })

  it("does not offer a null aggregation when the parent cannot persist it", () => {
    render(
      <WorkoutDefinitionFields
        value={{ scheme: "time", scoreType: "min" }}
        onChange={vi.fn()}
        allowEmptyScoreType={false}
      />,
    )
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Score Type" }), {
      key: "ArrowDown",
    })
    expect(
      screen.queryByRole("option", { name: "None" }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole("option")).toHaveLength(6)
  })

  it("associates validation with the exact control and supports multiple editors", () => {
    const value = { name: "Bad draft" }
    const { container } = render(
      <>
        <WorkoutDefinitionFields
          value={value}
          onChange={vi.fn()}
          fields={["name"]}
          errors={{ name: "Use a workout name" }}
        />
        <WorkoutDefinitionFields
          value={value}
          onChange={vi.fn()}
          fields={["name"]}
        />
      </>,
    )
    const inputs = screen.getAllByLabelText("Workout Name")
    expect(inputs[0]).toHaveAttribute("aria-invalid", "true")
    expect(inputs[0]).toHaveAccessibleDescription(/Use a workout name/)
    expect(inputs[0].id).not.toBe(inputs[1].id)
    expect(container.querySelectorAll("form")).toHaveLength(0)
  })
})
