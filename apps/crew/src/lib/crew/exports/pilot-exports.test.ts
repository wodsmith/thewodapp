// @lat: [[crew#Pilot Exports]]
// @lat: [[crew#Event Day Export Packet]]
import { describe, expect, it } from "vitest"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
} from "../../../db/schemas/crew-imports"
import { VOLUNTEER_ROLE_TYPES } from "../../../db/schemas/volunteers"
import { buildCrewPilotExports } from "./pilot-exports"
import type { CrewPilotExportInput } from "./pilot-exports"

describe("Crew pilot exports", () => {
  it("requires explicit generatedAt input for deterministic output", () => {
    expect(() =>
      buildCrewPilotExports({
        ...baseInput(),
        generatedAt: "",
      }),
    ).toThrow("generatedAt is required")
  })

  it("builds deterministic master schedule CSV rows sorted by start time", () => {
    const exports = buildCrewPilotExports(baseInput())

    expect(exports.masterScheduleRows.map((row) => row.label)).toEqual([
      "Check-in",
      "Event 1 - Heat 1",
      "Floor reset",
    ])
    expect(exports.masterScheduleCsv).toContain(
      "shift,2026-07-01T14:00:00.000Z,2026-07-01T16:00:00.000Z,Check-in,Front desk,Check-In,2,2,0",
    )
    expect(exports.summary.masterScheduleRows).toBe(3)
  })

  it("neutralizes spreadsheet formula-leading CSV cells", () => {
    const input = baseInput()
    input.shifts = [
      {
        id: "shift_formula",
        name: "=SUM(1,1)",
        roleType: VOLUNTEER_ROLE_TYPES.EQUIPMENT,
        startTime: "2026-07-01T13:00:00.000Z",
        endTime: "2026-07-01T14:00:00.000Z",
        capacity: 1,
        location: " @floor",
        assignments: [
          {
            id: "vsa_formula",
            membershipId: "tm_formula",
            volunteerName: "+Mallory",
            email: "-mallory@example.com",
          },
        ],
      },
    ]
    input.heats = []
    input.heatLaneAssignments = []
    input.judgeAssignments = []

    const exports = buildCrewPilotExports(input)

    expect(exports.masterScheduleCsv).toContain("shift,")
    expect(exports.masterScheduleCsv).toContain(`,"'=SUM(1,1)",`)
    expect(exports.masterScheduleCsv).toContain(",' @floor,")
    expect(exports.masterScheduleCsv).toContain("'+Mallory")
  })

  it("builds flat time-ordered shift sheets with open slots and statuses", () => {
    const exports = buildCrewPilotExports(baseInput())

    expect(exports.shiftSheets.map((sheet) => sheet.name)).toEqual([
      "Check-in",
      "Floor reset",
    ])

    const checkIn = exports.shiftSheets.find(
      (sheet) => sheet.name === "Check-in",
    )
    expect(
      checkIn?.rows.map((row) => [row.volunteerName, row.confirmationStatus]),
    ).toEqual([
      ["Ari Arrivals", "confirmed"],
      ["Casey Check", "pending"],
    ])

    const floorReset = exports.shiftSheets.find(
      (sheet) => sheet.name === "Floor reset",
    )
    expect(floorReset?.open).toBe(1)
    expect(
      floorReset?.rows.map((row) => [row.volunteerName, row.isOpen]),
    ).toEqual([
      ["Rae Reset", false],
      ["OPEN", true],
    ])
  })

  it("groups judge event sections by workout with open lanes per heat", () => {
    const exports = buildCrewPilotExports(baseInput())
    const [section] = exports.judgeEventSections

    expect(section?.workoutName).toBe("Event 1")
    const [heat] = section?.heats ?? []
    expect(heat?.label).toBe("Event 1 - Heat 1")
    expect(heat?.rows.map((row) => [row.laneNumber, row.judgeName])).toEqual([
      [1, "Jules Judge"],
      [2, "Lane Two"],
      [3, "OPEN"],
    ])
  })

  it("orders day sections and judge event sections across multiple events", () => {
    const input = baseInput()
    input.venues?.push({
      id: "venue_annex",
      name: "Annex floor",
      laneCount: 2,
      sortOrder: 2,
    })
    input.workouts?.push({ id: "tw_event2", name: "Event 2", sortOrder: 2 })
    input.heats?.push({
      id: "heat_2",
      trackWorkoutId: "tw_event2",
      heatNumber: 1,
      venueId: "venue_annex",
      scheduledTime: "2026-07-02T15:00:00.000Z",
      durationMinutes: 10,
    })
    input.heatLaneAssignments?.push(
      { heatId: "heat_2", laneNumber: 1 },
      { heatId: "heat_2", laneNumber: 2 },
    )

    const exports = buildCrewPilotExports(input)

    expect(exports.masterScheduleDaySections.map((section) => section.dayKey))
      .toEqual(["2026-07-01", "2026-07-02"])
    expect(
      exports.masterScheduleDaySections.map((section) =>
        section.rows.map((row) => row.label),
      ),
    ).toEqual([
      ["Check-in", "Event 1 - Heat 1", "Floor reset"],
      ["Event 2 - Heat 1"],
    ])
    expect(
      exports.judgeEventSections.map((section) => section.workoutName),
    ).toEqual(["Event 1", "Event 2"])
    expect(exports.summary).toMatchObject({
      masterScheduleDaySections: 2,
      judgeEventSections: 2,
      judgeHeatSheets: 2,
      shiftSheets: 2,
    })
  })
})

function baseInput(): CrewPilotExportInput {
  return {
    event: {
      id: "comp_1",
      name: "Pilot Throwdown",
      timezone: "America/Denver",
    },
    generatedAt: "2026-07-01T12:00:00.000Z",
    venues: [
      { id: "venue_floor", name: "Competition floor", laneCount: 3 },
      { id: "venue_check", name: "Front desk", laneCount: 0 },
    ],
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
      { heatId: "heat_1", laneNumber: 3 },
    ],
    shifts: [
      {
        id: "shift_reset",
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
      {
        id: "shift_check",
        name: "Check-in",
        roleType: VOLUNTEER_ROLE_TYPES.CHECK_IN,
        startTime: "2026-07-01T14:00:00.000Z",
        endTime: "2026-07-01T16:00:00.000Z",
        capacity: 2,
        location: "Front desk",
        assignments: [
          {
            id: "vsa_check_2",
            membershipId: "tm_check_2",
            volunteerName: "Casey Check",
            email: "casey@example.com",
            confirmation: {
              type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
              status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
              sentAt: "2026-06-30T12:00:00.000Z",
            },
          },
          {
            id: "vsa_check_1",
            membershipId: "tm_check_1",
            volunteerName: "Ari Arrivals",
            email: "ari@example.com",
            confirmation: {
              type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
              status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
              respondedAt: "2026-06-30T14:00:00.000Z",
            },
          },
        ],
      },
    ],
    judgeAssignments: [
      {
        id: "jha_lane2",
        membershipId: "tm_lane2",
        volunteerName: "Lane Two",
        email: "lane2@example.com",
        heatId: "heat_1",
        laneNumber: 2,
        position: VOLUNTEER_ROLE_TYPES.JUDGE,
        confirmation: {
          type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED,
          responseNote: "Can't make it.",
        },
      },
      {
        id: "jha_lane1",
        membershipId: "tm_judge",
        volunteerName: "Jules Judge",
        email: "jules@example.com",
        heatId: "heat_1",
        laneNumber: 1,
        position: VOLUNTEER_ROLE_TYPES.JUDGE,
        confirmation: {
          type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
        },
      },
    ],
  }
}
