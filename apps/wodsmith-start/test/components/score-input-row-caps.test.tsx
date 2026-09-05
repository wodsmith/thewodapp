import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ScoreInputRow } from "@/components/organizer/results/score-input-row"
import type { EventScoreEntryAthlete } from "@/types/competition-scores"

const athlete: EventScoreEntryAthlete = {
  registrationId: "registration",
  userId: "athlete",
  firstName: "Maya",
  lastName: "Chen",
  email: "maya@example.com",
  divisionId: "rx",
  divisionLabel: "Rx",
  teamName: null,
  teamMembers: [],
  existingResult: {
    resultId: "score",
    wodScore: "14:00",
    scoreStatus: "cap",
    tieBreakScore: null,
    secondaryScore: "100",
    sets: [
      {
        setNumber: 1,
        score: 240,
        reps: null,
        status: "scored",
        secondaryValue: null,
      },
      {
        setNumber: 2,
        score: 600,
        reps: null,
        status: "cap",
        secondaryValue: 100,
      },
    ],
  },
}
const flushBlur = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

describe("organizer capped rounds", () => {
  // @lat: [[competition-results#Competition Result Commands#Organizer cap editing]]
  it("loads capped facts, saves edited reps on leaving the row, and can mark an exact-cap finish", async () => {
    const onChange = vi.fn()
    render(
      <>
        <ScoreInputRow
          athlete={athlete}
          workoutScheme="time-with-cap"
          scoreType="sum"
          roundsToScore={2}
          timeCap={600}
          tiebreakScheme={null}
          onChange={onChange}
          onTabNext={() => {}}
        />
        <button type="button">Outside</button>
      </>,
    )
    const capped = screen.getByRole("checkbox", { name: "Round 2 capped" })
    const reps = screen.getByRole("spinbutton", {
      name: "Round 2 reps completed",
    })
    expect(capped).toBeChecked()
    expect(reps).toHaveValue(100)
    expect(
      screen.getByRole("textbox", { name: "Round 2 score" }),
    ).toBeDisabled()
    act(() => screen.getByRole("textbox", { name: "Round 1 score" }).focus())
    act(() => reps.focus())
    await flushBlur()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(reps, { target: { value: "150" } })
    act(() => screen.getByRole("button", { name: "Outside" }).focus())
    await flushBlur()
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        roundScores: [
          { score: "4:00", status: "scored", secondaryScore: null },
          { score: "10:00", status: "cap", secondaryScore: "150" },
        ],
      }),
    )
    act(() => capped.focus())
    fireEvent.click(capped)
    act(() => screen.getByRole("button", { name: "Outside" }).focus())
    await flushBlur()
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        roundScores: [
          { score: "4:00", status: "scored", secondaryScore: null },
          { score: "10:00", status: "scored", secondaryScore: null },
        ],
      }),
    )
  })
})
