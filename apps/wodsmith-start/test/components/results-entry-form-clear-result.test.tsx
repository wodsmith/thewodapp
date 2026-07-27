import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ResultsEntryForm } from "@/components/organizer/results/results-entry-form"
import type { EventScoreEntryAthlete } from "@/types/competition-scores"

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate: vi.fn() }),
}))

const savedAthlete: EventScoreEntryAthlete = {
  registrationId: "registration-saved",
  userId: "athlete-saved",
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

const draftAthlete: EventScoreEntryAthlete = {
  ...savedAthlete,
  registrationId: "registration-draft",
  userId: "athlete-draft",
  firstName: "Ari",
  lastName: "Lopez",
  email: "ari@example.com",
  existingResult: null,
}

describe("ResultsEntryForm clear result", () => {
  it("preserves draft values in other rows", async () => {
    const clearScore = vi.fn().mockResolvedValue(undefined)

    render(
      <ResultsEntryForm
        competitionId="competition-1"
        organizingTeamId="team-1"
        events={[{ id: "event-1", name: "Event 1", trackOrder: 1 }]}
        selectedEventId="event-1"
        event={{
          id: "event-1",
          trackOrder: 1,
          pointsMultiplier: null,
          workout: {
            id: "workout-1",
            name: "Event 1",
            description: "",
            scheme: "time",
            scoreType: "min",
            tiebreakScheme: null,
            timeCap: null,
            repsPerRound: null,
            roundsToScore: 1,
          },
        }}
        athletes={[savedAthlete, draftAthlete]}
        heats={[]}
        unassignedRegistrationIds={[]}
        divisions={[{ id: "division-rx", label: "Women Rx" }]}
        selectedDivisionId="division-rx"
        saveScore={vi.fn()}
        clearScore={clearScore}
      />,
    )

    const scoreInputs = screen.getAllByPlaceholderText("90 (secs) or 1:30")
    fireEvent.change(scoreInputs[1], { target: { value: "1:" } })

    fireEvent.click(
      screen.getByRole("button", { name: "Clear result for Maya Chen" }),
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, clear result" }),
    )

    await waitFor(() => expect(clearScore).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(screen.getAllByPlaceholderText("90 (secs) or 1:30")[0]).toHaveValue(
        "",
      ),
    )
    expect(
      screen.getAllByPlaceholderText("90 (secs) or 1:30")[1],
    ).toHaveValue("1:")
  })
})
