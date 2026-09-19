import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TrainingWorkoutDialog } from "@/components/training/training-workout-dialog"
import { getTrainingWorkoutOptionsFn } from "@/server-fns/training-fns"
import type { TrainingBlock } from "@/lib/training/types"
import { describeWorkoutFn } from "@/server-fns/workout-authoring-fns"
vi.mock("@/server-fns/workout-authoring-fns", () => ({ describeWorkoutFn: vi.fn() }))

vi.mock("@/server-fns/training-fns", () => ({
  getTrainingWorkoutOptionsFn: vi.fn(),
}))
const options = {
  movements: [{ id: "thruster", name: "Thruster", type: "weightlifting" }],
  scalingGroups: [],
}
const block: TrainingBlock = {
  id: "conditioning",
  kind: "workout",
  title: "Intervals",
  prescription: "4 efforts",
  scalingGuidance: "Use a lighter bar",
  coachGuidance: "Rest two minutes",
  workout: {
    name: "Intervals",
    description: "4 efforts",
    scheme: "time-with-cap",
    scoreType: "sum",
    scope: "private",
    timeCapSeconds: 720,
    roundsToScore: 4,
    repsPerRound: 30,
    tiebreakScheme: "reps",
    scalingGroupId: null,
    movementIds: ["thruster"],
  },
}

describe("programmer workout authoring", () => {
  it("round trips the complete scored definition through the shared fields", async () => {
    vi.mocked(getTrainingWorkoutOptionsFn).mockResolvedValue(
      options as Awaited<ReturnType<typeof getTrainingWorkoutOptionsFn>>,
    )
    const onSave = vi.fn()
    render(
      <TrainingWorkoutDialog
        block={block}
        teamId="gym"
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Apply changes" }),
      ).toBeEnabled(),
    )
    expect(screen.getByLabelText("Time Cap (minutes)")).toHaveValue(12)
    expect(screen.getByLabelText("Rounds to Score")).toHaveValue(4)
    fireEvent.change(screen.getByLabelText("Time Cap (minutes)"), {
      target: { value: "10.5" },
    })
    fireEvent.change(screen.getByLabelText("Workout Name"), {
      target: { value: "Friday intervals" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }))
    expect(onSave).toHaveBeenCalledWith({
      ...block,
      title: "Friday intervals",
      workout: {
        ...block.workout,
        name: "Friday intervals",
        timeCapSeconds: 630,
      },
    })
  })

  it("keeps the description after recognition failure and retries without losing edits", async () => {
    vi.mocked(describeWorkoutFn)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(block.workout!)
    const onSave = vi.fn()
    render(
      <TrainingWorkoutDialog teamId="gym" onSave={onSave} onClose={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText("Describe your workout"), {
      target: { value: "Intervals\n4 efforts" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add to session" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("offline")
    expect(screen.getByLabelText("Describe your workout")).toHaveValue("Intervals\n4 efforts")
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add to session" }),
      ).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole("button", { name: "Add to session" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "workout",
        title: "Intervals",
        workout: block.workout,
      }),
    ))
    expect(describeWorkoutFn).toHaveBeenCalledWith({ data: { context: { kind: "programming", teamId: "gym" }, description: "Intervals\n4 efforts" } })
  })

  it("requires a decision before discarding an unsaved workout", async () => {
    vi.mocked(getTrainingWorkoutOptionsFn).mockResolvedValue(
      options as Awaited<ReturnType<typeof getTrainingWorkoutOptionsFn>>,
    )
    const onClose = vi.fn()
    const onDirtyChange = vi.fn()
    render(
      <TrainingWorkoutDialog
        teamId="gym"
        onSave={vi.fn()}
        onClose={onClose}
        onDirtyChange={onDirtyChange}
      />,
    )
    fireEvent.change(screen.getByLabelText("Describe your workout"), {
      target: { value: "Fran" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onClose).not.toHaveBeenCalled()
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }))
    expect(screen.getByLabelText("Describe your workout")).toHaveValue("Fran")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
