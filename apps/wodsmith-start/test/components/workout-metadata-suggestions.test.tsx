import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WorkoutMetadataSuggestions } from "@/components/workout-metadata-suggestions"

const suggestWorkoutMetadataFn = vi.hoisted(() => vi.fn())

vi.mock("@/server-fns/workout-metadata-suggestion-fns", () => ({
  suggestWorkoutMetadataFn,
}))

describe("WorkoutMetadataSuggestions", () => {
  afterEach(() => {
    vi.useRealTimers()
    suggestWorkoutMetadataFn.mockReset()
  })

  it("rechecks access when the form switches teams", async () => {
    vi.useFakeTimers()
    suggestWorkoutMetadataFn
      .mockResolvedValueOnce({ hasAccess: false })
      .mockResolvedValueOnce({
        hasAccess: true,
        suggestion: {
          scheme: "time",
          scoreType: "min",
          movements: [],
        },
      })
    const view = render(
      <WorkoutMetadataSuggestions
        context={{
          teamId: "denied-team",
          writePermission: "create_components",
        }}
        description="21-15-9 thrusters and pull-ups"
        onApply={vi.fn()}
      />,
    )

    await act(() => vi.advanceTimersByTimeAsync(701))
    expect(suggestWorkoutMetadataFn).toHaveBeenCalledTimes(1)

    view.rerender(
      <WorkoutMetadataSuggestions
        context={{
          teamId: "allowed-team",
          writePermission: "create_components",
        }}
        description="21-15-9 thrusters and pull-ups"
        onApply={vi.fn()}
      />,
    )
    await act(() => vi.advanceTimersByTimeAsync(701))

    expect(suggestWorkoutMetadataFn).toHaveBeenCalledTimes(2)
    expect(suggestWorkoutMetadataFn.mock.calls[1]?.[0]).toMatchObject({
      data: {
        teamId: "allowed-team",
        writePermission: "create_components",
      },
    })
    expect(screen.getByText("Suggested workout details")).toBeInTheDocument()
  })
})
