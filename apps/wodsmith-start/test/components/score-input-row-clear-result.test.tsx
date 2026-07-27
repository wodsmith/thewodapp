import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ScoreInputRow } from "@/components/organizer/results/score-input-row"
import type { EventScoreEntryAthlete } from "@/types/competition-scores"

const athlete: EventScoreEntryAthlete = {
  registrationId: "registration-1",
  userId: "athlete-1",
  firstName: "Maya",
  lastName: "Chen",
  email: "maya@example.com",
  divisionId: "division-rx",
  divisionLabel: "Women Rx",
  teamName: null,
  teamMembers: [],
  existingResult: {
    resultId: "score-1",
    wodScore: "12:48",
    scoreStatus: "scored",
    tieBreakScore: null,
    secondaryScore: null,
    sets: [],
  },
}

describe("ScoreInputRow clear result action", () => {
  it("confirms before clearing a saved result", async () => {
    const onClear = vi.fn().mockResolvedValue(undefined)

    render(
      <ScoreInputRow
        athlete={athlete}
        workoutScheme="time"
        scoreType="min"
        tiebreakScheme={null}
        isSaved
        onClear={onClear}
        onChange={() => undefined}
        onTabNext={() => undefined}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", {
        name: "Clear result for Maya Chen",
      }),
    )

    expect(
      screen.getByRole("heading", {
        name: "Clear result for Maya Chen?",
      }),
    ).toBeInTheDocument()
    const warning = screen.getByRole("alert")
    expect(warning).toHaveClass("bg-orange-50", "text-orange-950")
    expect(warning.className).not.toContain("destructive")
    expect(warning.className).not.toContain("dark:")
    expect(screen.getByText("This action cannot be undone")).toBeInTheDocument()
    expect(onClear).not.toHaveBeenCalled()

    const confirmButton = screen.getByRole("button", {
      name: "Yes, clear result",
    })
    expect(confirmButton).toHaveClass("bg-orange-700", "dark:bg-orange-800")
    fireEvent.click(confirmButton)

    await waitFor(() => expect(onClear).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", {
          name: "Clear result for Maya Chen?",
        }),
      ).not.toBeInTheDocument(),
    )
  })

  it("does not expose the destructive action without an organizer callback", () => {
    render(
      <ScoreInputRow
        athlete={athlete}
        workoutScheme="time"
        scoreType="min"
        tiebreakScheme={null}
        isSaved
        onChange={() => undefined}
        onTabNext={() => undefined}
      />,
    )

    expect(
      screen.queryByRole("button", {
        name: "Clear result for Maya Chen",
      }),
    ).not.toBeInTheDocument()
  })
})
