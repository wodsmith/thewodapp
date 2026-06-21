import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
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
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock("@/server-fns/crew-pilot-export-fns", () => ({
  getCrewPilotExportsPageFn: vi.fn(),
}))

describe("EventPilotExportsView", () => {
  // @lat: [[crew#Event Day Export Packet]]
  it("renders packet index, station cards, and print packet sections", () => {
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
          heatLaneAssignments: 2,
          judgeAssignments: 1,
          activeJudgeVersions: 1,
        }}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Event-day export packet" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Print packet" }),
    ).toBeInTheDocument()
    expect(screen.getAllByText("Packet index").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Station cards").length).toBeGreaterThan(0)
    expect(
      screen.getByText("Competition floor station card"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Competition floor lane 1 card"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Master schedule / Jul 1, 2026"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Master schedule / Jul 2, 2026"),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Master schedule / all days")).toBeInTheDocument()
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
