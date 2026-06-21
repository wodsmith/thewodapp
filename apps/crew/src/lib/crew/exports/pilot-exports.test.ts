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

  it("groups role sheets with open shift slots and judge assignments", () => {
    const exports = buildCrewPilotExports(baseInput())

    const equipment = exports.roleSheets.find(
      (sheet) => sheet.roleType === VOLUNTEER_ROLE_TYPES.EQUIPMENT,
    )
    const judges = exports.roleSheets.find(
      (sheet) => sheet.roleType === VOLUNTEER_ROLE_TYPES.JUDGE,
    )

    expect(equipment?.rows).toMatchObject([
      { volunteerName: "Rae Reset", blockLabel: "Floor reset" },
      { volunteerName: "OPEN", confirmationStatus: "open" },
    ])
    expect(judges?.rows.map((row) => row.volunteerName)).toEqual([
      "Jules Judge",
      "Lane Two",
    ])
  })

  it("derives no-response and decline rows from confirmation states", () => {
    const exports = buildCrewPilotExports(baseInput())

    expect(
      exports.responseRows.map((row) => [
        row.volunteerName,
        row.status,
        row.reason,
      ]),
    ).toEqual([
      ["Casey Check", "pending", "no_response"],
      ["Lane Two", "declined", "declined"],
      ["Rae Reset", "missing", "missing_confirmation"],
    ])
    expect(exports.responseCsv).toContain(
      "heat,jha_lane2,Lane Two,lane2@example.com",
    )
  })

  it("generates judge heat lane sheets with open lanes", () => {
    const exports = buildCrewPilotExports(baseInput())
    const [sheet] = exports.judgeHeatLaneSheets

    expect(sheet?.label).toBe("Event 1 - Heat 1")
    expect(sheet?.rows.map((row) => [row.laneNumber, row.judgeName])).toEqual([
      [1, "Jules Judge"],
      [2, "Lane Two"],
      [3, "OPEN"],
    ])
  })

  it("assembles an event-day packet index with day, station, and lane cards", () => {
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
    input.shifts?.push({
      id: "shift_annex_briefing",
      name: "Annex briefing",
      roleType: VOLUNTEER_ROLE_TYPES.FLOOR_MANAGER,
      startTime: "2026-07-02T14:30:00.000Z",
      endTime: "2026-07-02T15:00:00.000Z",
      capacity: 1,
      location: "Annex floor",
      assignments: [],
    })

    const exports = buildCrewPilotExports(input)

    expect(exports.packetIndexItems.map((item) => item.id)).toEqual([
      "master-schedule",
      "station-cards",
      "role-sheets",
      "judge-cards",
      "response-list",
      "floor-lead-sheets",
    ])
    expect(exports.masterScheduleDaySections.map((section) => section.dayKey))
      .toEqual(["2026-07-01", "2026-07-02"])
    expect(
      exports.masterScheduleDaySections.map((section) =>
        section.rows.map((row) => row.label),
      ),
    ).toEqual([
      ["Check-in", "Event 1 - Heat 1", "Floor reset"],
      ["Annex briefing", "Event 2 - Heat 1"],
    ])
    expect(exports.stationCards.map((card) => card.stationName)).toEqual([
      "Annex floor",
      "Competition floor",
      "Front desk",
    ])
    expect(
      exports.stationCards.find((card) => card.stationName === "Annex floor"),
    ).toMatchObject({
      openBlocks: 2,
      laneCards: [
        { laneNumber: 1, rows: [{ workoutName: "Event 2" }] },
        { laneNumber: 2, rows: [{ judgeName: "OPEN" }] },
      ],
    })
    expect(exports.summary).toMatchObject({
      masterScheduleDaySections: 2,
      stationCards: 3,
      laneCards: 5,
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
