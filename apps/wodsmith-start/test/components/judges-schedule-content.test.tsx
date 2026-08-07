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
      screen.getAllByText("Avery Athlete, Riley Runner").length,
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
    expect(
      screen.getAllByText("RX team workout brief").length,
    ).toBeGreaterThan(0)

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

  it("falls back to an athlete name when a team name is empty", () => {
    const events = scheduleEvents()
    const lane = events[0]?.heats[0]?.laneAssignments[0]
    if (lane?.registration) lane.registration.teamName = ""

    render(
      <JudgesScheduleContent
        competitionName="Mountain Throwdown"
        events={events}
        timezone="America/Denver"
      />,
    )

    expect(screen.getAllByText("Avery Athlete").length).toBeGreaterThan(0)
  })

  it("shows all packets when the selected judge disappears after refresh", () => {
    const { rerender } = render(
      <JudgesScheduleContent
        competitionName="Mountain Throwdown"
        events={scheduleEvents()}
        timezone="America/Denver"
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Judge packets" }))
    fireEvent.change(screen.getByLabelText("Print sheets for"), {
      target: { value: "tmem_judge_2" },
    })

    const refreshedEvents = scheduleEvents()
    const refreshedHeat = refreshedEvents[0]?.heats[0]
    if (refreshedHeat) {
      refreshedHeat.judges = refreshedHeat.judges.filter(
        (judge) => judge.membershipId === "tmem_judge_1",
      )
    }
    rerender(
      <JudgesScheduleContent
        competitionName="Mountain Throwdown"
        events={refreshedEvents}
        timezone="America/Denver"
      />,
    )

    expect(screen.getByLabelText("Print sheets for")).toHaveValue("all")
    expect(
      screen.getAllByRole("heading", { name: "Jamie Judge" }).length,
    ).toBeGreaterThan(0)
  })

  it("keeps invitation-backed judges in separate printable packets", () => {
    const events = scheduleEvents()
    const heat = events[0]?.heats[0]
    if (heat) {
      heat.judges = [
        {
          assignmentId: "jha_invite_1",
          laneNumber: null,
          assigneeId: "tinv_judge_1",
          membershipId: null,
          invitationId: "tinv_judge_1",
          userId: "",
          firstName: "Taylor Temp",
          lastName: null,
          position: "judge",
        },
        {
          assignmentId: "jha_invite_2",
          laneNumber: null,
          assigneeId: "tinv_judge_2",
          membershipId: null,
          invitationId: "tinv_judge_2",
          userId: "",
          firstName: "Jordan Guest",
          lastName: null,
          position: "judge",
        },
      ]
    }

    render(
      <JudgesScheduleContent
        competitionName="Mountain Throwdown"
        events={events}
        timezone="America/Denver"
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Judge packets" }))

    expect(screen.getByLabelText("Print sheets for")).toHaveTextContent(
      "All judges (2 sheets)",
    )
    expect(screen.getAllByText("Taylor Temp").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Jordan Guest").length).toBeGreaterThan(0)
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
              assigneeId: "tmem_judge_1",
              membershipId: "tmem_judge_1",
              invitationId: null,
              userId: "user_judge_1",
              firstName: "Jamie",
              lastName: "Judge",
              position: "judge",
            },
            {
              assignmentId: "jha_2",
              laneNumber: 2,
              assigneeId: "tmem_judge_2",
              membershipId: "tmem_judge_2",
              invitationId: null,
              userId: "user_judge_2",
              firstName: "Morgan",
              lastName: "Marshal",
              position: "judge",
            },
            {
              assignmentId: "jha_3",
              laneNumber: null,
              assigneeId: "tmem_judge_3",
              membershipId: "tmem_judge_3",
              invitationId: null,
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
              workoutDescription: "RX team workout brief",
              registration: {
                id: "creg_team_1",
                teamName: "Team Thunder",
                athleteNames: ["Avery Athlete", "Riley Runner"],
              },
            },
            {
              laneNumber: 2,
              division: { id: "division_rx", label: "RX Team" },
              workoutDescription: "RX team workout brief",
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
