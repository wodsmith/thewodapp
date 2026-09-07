import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TrainingWorkoutDialog } from "@/components/training/training-workout-dialog"
import { getTrainingWorkoutOptionsFn } from "@/server-fns/training-fns"
import type { TrainingBlock } from "@/lib/training/types"

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

  it("keeps the form after catalog failure and retries without losing edits", async () => {
    vi.mocked(getTrainingWorkoutOptionsFn)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(
        options as Awaited<ReturnType<typeof getTrainingWorkoutOptionsFn>>,
      )
    const onSave = vi.fn()
    render(
      <TrainingWorkoutDialog teamId="gym" onSave={onSave} onClose={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText("Workout Name"), {
      target: { value: "Fran" },
    })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "21-15-9 thrusters and pull-ups" },
    })
    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Add to session" }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add to session" }),
      ).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole("button", { name: "Add to session" }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "workout",
        title: "Fran",
        workout: expect.objectContaining({
          name: "Fran",
          description: "21-15-9 thrusters and pull-ups",
          scheme: "time",
        }),
      }),
    )
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
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add to session" }),
      ).toBeEnabled(),
    )
    fireEvent.change(screen.getByLabelText("Workout Name"), {
      target: { value: "Fran" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onClose).not.toHaveBeenCalled()
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }))
    expect(screen.getByLabelText("Workout Name")).toHaveValue("Fran")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
