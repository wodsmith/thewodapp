import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { JudgesScheduleContent } from "@/routes/compete/$slug/-components/judges-schedule-content"
import type { JudgesScheduleEvent } from "@/server-fns/judge-scheduling-fns"

describe("JudgesScheduleContent", () => {
  // @lat: [[organizer-dashboard#Volunteers#Judge Schedule Printouts]]
  it("renders a roster-rich master grid and selectable individual judge packets", () => {
    render(
      <JudgesScheduleContent
        competitionName="Mountain Throwdown"
        events={scheduleEvents()}
        timezone="America/Denver"
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Judge schedules" }),
    ).toBeInTheDocument()
    expect(screen.getAllByText("Team Thunder").length).toBeGreaterThan(0)
    expect(
      screen.getAllByText("Avery Athlete / Riley Runner").length,
    ).toBeGreaterThan(0)
    expect(screen.getByText("Floor: Rae Reserve")).toBeInTheDocument()
    expect(
      screen.getAllByLabelText("WODsmith Compete").length,
    ).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole("button", { name: "Judge packets" }))

    expect(screen.getByLabelText("Print sheets for")).toHaveValue("all")
    expect(
      screen.getAllByRole("heading", { name: "Jamie Judge" }).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText("3 Rounds for Time").length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText("Print sheets for"), {
      target: { value: "tmem_judge_2" },
    })

    expect(
      screen.queryByRole("heading", { name: "Jamie Judge" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("heading", { name: "Morgan Marshal" }).length,
    ).toBeGreaterThan(0)
  })
})

function scheduleEvents(): JudgesScheduleEvent[] {
  return [
    {
      trackWorkoutId: "tw_event_1",
      eventName: "Event One",
      workoutDescription: "3 Rounds for Time",
      workoutScheme: "time-with-cap",
      timeCapSeconds: 720,
      trackOrder: 1,
      heats: [
        {
          id: "heat_1",
          heatNumber: 1,
          scheduledTime: new Date("2026-08-08T15:00:00.000Z"),
          durationMinutes: 12,
          venue: {
            id: "venue_floor",
            name: "Main Floor",
            laneCount: 2,
          },
          division: null,
          judges: [
            {
              assignmentId: "jha_1",
              laneNumber: 1,
              membershipId: "tmem_judge_1",
              userId: "user_judge_1",
              firstName: "Jamie",
              lastName: "Judge",
              position: "judge",
            },
            {
              assignmentId: "jha_2",
              laneNumber: 2,
              membershipId: "tmem_judge_2",
              userId: "user_judge_2",
              firstName: "Morgan",
              lastName: "Marshal",
              position: "judge",
            },
            {
              assignmentId: "jha_3",
              laneNumber: null,
              membershipId: "tmem_judge_3",
              userId: "user_judge_3",
              firstName: "Rae",
              lastName: "Reserve",
              position: "judge",
            },
          ],
          laneAssignments: [
            {
              laneNumber: 1,
              division: { id: "division_rx", label: "RX Team" },
              registration: {
                id: "creg_team_1",
                teamName: "Team Thunder",
                athleteNames: ["Avery Athlete", "Riley Runner"],
              },
            },
            {
              laneNumber: 2,
              division: { id: "division_rx", label: "RX Team" },
              registration: {
                id: "creg_team_2",
                teamName: "Barbell Club",
                athleteNames: ["Casey Clean", "Sam Snatch"],
              },
            },
          ],
        },
      ],
    },
  ]
}
