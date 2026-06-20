// @lat: [[crew#Day Of Operations Board]]
import { describe, expect, it } from "vitest"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
} from "../../db/schemas/crew-imports"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_ROLE_TYPES,
} from "../../db/schemas/volunteers"
import { buildCrewDayOfOperationsBoard } from "./day-of-operations"
import {
  buildCrewStaffingMatrix,
  buildCrewStaffingReport,
  type CrewStaffingMatrixInput,
} from "./staffing"

describe("Crew day-of operations helpers", () => {
  it("derives current and next blocks from shifts and heats", () => {
    const board = buildBoard()

    expect(board.currentBlocks.map((block) => block.timeBlockId)).toEqual([
      "shift:vshf_checkin",
      "heat:heat_current",
    ])
    expect(board.nextBlocks.map((block) => block.timeBlockId)).toEqual([
      "shift:vshf_equipment",
      "heat:heat_next",
    ])
  })

  it("prioritizes critical gaps and due-soon no-responses", () => {
    const board = buildBoard()

    expect(board.summary.openRoles).toBe(2)
    expect(board.criticalGaps.map((gap) => gap.roleType)).toEqual([
      VOLUNTEER_ROLE_TYPES.CHECK_IN,
      VOLUNTEER_ROLE_TYPES.JUDGE,
    ])
    expect(board.noResponsesDueSoon).toHaveLength(3)
    expect(board.noResponsesDueSoon[0]).toMatchObject({
      volunteerName: "Casey Check-In",
      reason: "no_response",
      timing: "current",
    })
    expect(board.noResponsesDueSoon.slice(1)).toEqual([
      expect.objectContaining({
        volunteerName: "Jules Judge",
        reason: "missing_confirmation",
        timing: "next",
      }),
      expect.objectContaining({
        volunteerName: "Jules Judge",
        reason: "missing_confirmation",
        timing: "next",
      }),
    ])
  })

  it("separates decision and no-show replacement queues", () => {
    const board = buildBoard()

    expect(board.decisionQueue).toEqual([
      expect.objectContaining({
        volunteerName: "Jules Judge",
        reason: "declined",
        timing: "current",
      }),
    ])
    expect(board.noShowReplacementQueue).toEqual([
      expect.objectContaining({
        volunteerName: "Riley Equipment",
        reason: "replaced",
        timing: "next",
      }),
    ])
    expect(board.stateSummary).toMatchObject({
      checkedInTracked: false,
      noShow: 0,
      replaced: 1,
    })
  })

  it("summarizes active judge coverage without mutating versions", () => {
    const board = buildBoard()

    expect(board.judgeCoverage).toMatchObject({
      heatBlocks: 2,
      activeHeatBlocks: 2,
      lanesNeeded: 4,
      lanesFilled: 3,
      openLanes: 1,
    })
    expect(
      board.judgeCoverage.currentAndNext.map((block) => block.open),
    ).toEqual([1, 0])
  })
})

function buildBoard() {
  const input = createStaffingInput()
  const matrix = buildCrewStaffingMatrix(input)
  const report = buildCrewStaffingReport(input, matrix)
  return buildCrewDayOfOperationsBoard({
    matrix,
    report,
    now: new Date("2026-06-20T15:00:00.000Z"),
  })
}

function createStaffingInput(): CrewStaffingMatrixInput {
  return {
    event: {
      id: "comp_day_of",
      name: "Day-of Test",
      timezone: "UTC",
      startDate: "2026-06-20",
      endDate: "2026-06-20",
    },
    venues: [
      {
        id: "venue_floor_1",
        name: "Floor 1",
        laneCount: 2,
        sortOrder: 1,
      },
    ],
    workouts: [
      {
        id: "tw_event_1",
        name: "Workout 1",
        sortOrder: 1,
      },
    ],
    heats: [
      {
        id: "heat_current",
        trackWorkoutId: "tw_event_1",
        heatNumber: 1,
        venueId: "venue_floor_1",
        scheduledTime: new Date("2026-06-20T15:00:00.000Z"),
        durationMinutes: 20,
      },
      {
        id: "heat_next",
        trackWorkoutId: "tw_event_1",
        heatNumber: 2,
        venueId: "venue_floor_1",
        scheduledTime: new Date("2026-06-20T16:00:00.000Z"),
        durationMinutes: 20,
      },
    ],
    heatLaneAssignments: [
      { heatId: "heat_current", laneNumber: 1 },
      { heatId: "heat_current", laneNumber: 2 },
      { heatId: "heat_next", laneNumber: 1 },
      { heatId: "heat_next", laneNumber: 2 },
    ],
    roster: [
      {
        membershipId: "tmem_checkin",
        name: "Casey Check-In",
        roleTypes: [VOLUNTEER_ROLE_TYPES.CHECK_IN],
        availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
        isActive: true,
      },
      {
        membershipId: "tmem_judge",
        name: "Jules Judge",
        roleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
        availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
        isActive: true,
      },
      {
        membershipId: "tmem_equipment",
        name: "Riley Equipment",
        roleTypes: [VOLUNTEER_ROLE_TYPES.EQUIPMENT],
        availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
        isActive: true,
      },
    ],
    shifts: [
      {
        id: "vshf_checkin",
        name: "Check-in desk",
        roleType: VOLUNTEER_ROLE_TYPES.CHECK_IN,
        startTime: new Date("2026-06-20T14:30:00.000Z"),
        endTime: new Date("2026-06-20T15:30:00.000Z"),
        capacity: 2,
        location: "Front desk",
        assignments: [
          {
            id: "vsha_checkin_1",
            membershipId: "tmem_checkin",
            confirmation: {
              type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
              status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
              sentAt: new Date("2026-06-18T15:00:00.000Z"),
            },
          },
        ],
      },
      {
        id: "vshf_equipment",
        name: "Equipment reset",
        roleType: VOLUNTEER_ROLE_TYPES.EQUIPMENT,
        startTime: new Date("2026-06-20T16:00:00.000Z"),
        endTime: new Date("2026-06-20T17:00:00.000Z"),
        capacity: 1,
        location: "Floor 1",
        assignments: [
          {
            id: "vsha_equipment_1",
            membershipId: "tmem_equipment",
            confirmation: {
              type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
              status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
              sentAt: new Date("2026-06-18T15:00:00.000Z"),
              respondedAt: new Date("2026-06-19T15:00:00.000Z"),
            },
          },
        ],
      },
    ],
    judgeAssignments: [
      {
        id: "jha_current_1",
        heatId: "heat_current",
        membershipId: "tmem_judge",
        laneNumber: 1,
        position: VOLUNTEER_ROLE_TYPES.JUDGE,
        versionId: "jver_active",
        confirmation: {
          type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED,
          sentAt: new Date("2026-06-18T15:00:00.000Z"),
          respondedAt: new Date("2026-06-19T15:00:00.000Z"),
        },
      },
      {
        id: "jha_next_1",
        heatId: "heat_next",
        membershipId: "tmem_judge",
        laneNumber: 1,
        position: VOLUNTEER_ROLE_TYPES.JUDGE,
        versionId: "jver_active",
      },
      {
        id: "jha_next_2",
        heatId: "heat_next",
        membershipId: "tmem_judge",
        laneNumber: 2,
        position: VOLUNTEER_ROLE_TYPES.JUDGE,
        versionId: "jver_active",
      },
    ],
  }
}
