import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { VOLUNTEER_ROLE_TYPES } from "@/db/schemas/volunteers"
import {
  buildCrewPilotExports,
  type CrewPilotExportInput,
} from "@/lib/crew/exports/pilot-exports"
import { EventPilotExportsView } from "@/routes/events/$eventId/exports"

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useLoaderData: vi.fn(),
  }),
  getRouteApi: () => ({
    useParams: () => ({ eventId: "comp_packet" }),
  }),
  useSearch: () => ({}),
}))

vi.mock("@/server-fns/crew-pilot-export-fns", () => ({
  getCrewPilotExportsPageFn: vi.fn(),
}))

function renderView() {
  const exports = buildCrewPilotExports(packetInput())

  render(
    <EventPilotExportsView
      eventId="comp_packet"
      event={{
        id: "comp_packet",
        name: "Packet Classic",
        slug: "packet-classic",
        organizingTeamId: "team_org",
        competitionTeamId: "team_comp",
        timezone: "Pacific/Kiritimati",
        startDate: "2026-07-01",
        endDate: "2026-07-02",
      }}
      exports={exports}
      sources={{
        shifts: 1,
        shiftAssignments: 1,
        heats: 1,
        judgeAssignments: 1,
      }}
    />,
  )
}

describe("EventPilotExportsView", () => {
  // @lat: [[crew#Event Day Export Packet]]
  it("renders schedule, judges, and shifts tabs and switches between them", () => {
    renderView()

    expect(
      screen.getByRole("heading", { name: "Print packet" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument()

    // Master schedule tab is active by default.
    expect(screen.getByText("Jul 1, 2026")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Master CSV" }),
    ).toBeInTheDocument()

    // Judges tab groups heats by event.
    fireEvent.click(screen.getByRole("tab", { name: /Judges/ }))
    expect(screen.getByText("Event 1")).toBeInTheDocument()
    expect(screen.getByText(/Heat 1 \/ Competition floor/)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Master CSV" }),
    ).not.toBeInTheDocument()

    // Shifts tab lists each shift as its own section.
    fireEvent.click(screen.getByRole("tab", { name: /Shifts/ }))
    expect(screen.getByText("Floor reset")).toBeInTheDocument()
    expect(screen.getByText("Rae Reset")).toBeInTheDocument()
  })
})

function packetInput(): CrewPilotExportInput {
  return {
    event: {
      id: "comp_packet",
      name: "Packet Classic",
      timezone: "America/Denver",
    },
    generatedAt: "2026-07-01T12:00:00.000Z",
    venues: [{ id: "venue_floor", name: "Competition floor", laneCount: 2 }],
    workouts: [{ id: "tw_event1", name: "Event 1", sortOrder: 1 }],
    heats: [
      {
        id: "heat_1",
        trackWorkoutId: "tw_event1",
        heatNumber: 1,
        venueId: "venue_floor",
        scheduledTime: "2026-07-01T15:00:00.000Z",
        durationMinutes: 12,
      },
    ],
    heatLaneAssignments: [
      { heatId: "heat_1", laneNumber: 1 },
      { heatId: "heat_1", laneNumber: 2 },
    ],
    shifts: [
      {
        id: "shift_floor",
        name: "Floor reset",
        roleType: VOLUNTEER_ROLE_TYPES.EQUIPMENT,
        startTime: "2026-07-01T16:00:00.000Z",
        endTime: "2026-07-01T17:00:00.000Z",
        capacity: 2,
        location: "Competition floor",
        assignments: [
          {
            id: "vsa_reset",
            membershipId: "tm_reset",
            volunteerName: "Rae Reset",
            email: "reset@example.com",
          },
        ],
      },
    ],
    judgeAssignments: [
      {
        id: "jha_lane1",
        membershipId: "tm_judge",
        volunteerName: "Jules Judge",
        email: "jules@example.com",
        heatId: "heat_1",
        laneNumber: 1,
        position: VOLUNTEER_ROLE_TYPES.JUDGE,
      },
    ],
  }
}
