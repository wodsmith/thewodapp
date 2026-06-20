// @lat: [[crew#Staffing Matrix Core]]
import { describe, expect, it } from "vitest"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
} from "../../../db/schemas/crew-imports"
import { buildCrewStaffingMatrix } from "./matrix"
import type { CrewStaffingMatrixInput } from "./types"

describe("Crew staffing matrix core", () => {
  it("derives filled, needed, and open coverage by role and time block", () => {
    const matrix = buildCrewStaffingMatrix(baseInput())

    expect(matrix.timeBlocks.map((block) => block.id)).toEqual([
      "heat:heat_1",
      "shift:shift_medical",
      "heat:heat_2",
      "shift:shift_check_in",
    ])
    expect(
      matrix.coverageRows.map((row) => [
        row.timeBlockId,
        row.roleType,
        row.needed,
        row.filled,
        row.open,
      ]),
    ).toEqual([
      ["heat:heat_1", "judge", 2, 1, 1],
      ["shift:shift_medical", "medical", 2, 1, 1],
      ["heat:heat_2", "judge", 3, 1, 2],
      ["shift:shift_check_in", "check_in", 2, 1, 1],
    ])
    expect(matrix.summary).toMatchObject({
      timeBlocks: 4,
      roles: 3,
      totalNeeded: 9,
      totalFilled: 4,
      totalOpen: 5,
      underfilledRows: 4,
      openCapacity: 5,
    })
  })

  it("sorts heats with equal start times by heat number before id", () => {
    const matrix = buildCrewStaffingMatrix({
      event: { id: "comp_1" },
      heats: [
        {
          id: "heat_alpha",
          trackWorkoutId: "tw_final",
          heatNumber: 2,
          scheduledTime: "2026-07-04T15:00:00.000Z",
          durationMinutes: 12,
          laneCount: 1,
        },
        {
          id: "heat_zulu",
          trackWorkoutId: "tw_final",
          heatNumber: 1,
          scheduledTime: "2026-07-04T15:00:00.000Z",
          durationMinutes: 12,
          laneCount: 1,
        },
      ],
    })

    expect(matrix.timeBlocks.map((block) => block.id)).toEqual([
      "heat:heat_zulu",
      "heat:heat_alpha",
    ])
    expect(matrix.coverageRows.map((row) => row.timeBlockId)).toEqual([
      "heat:heat_zulu",
      "heat:heat_alpha",
    ])
  })

  it("reports judge lane gaps from occupied lanes and venue lane counts", () => {
    const matrix = buildCrewStaffingMatrix(baseInput())

    expect(matrix.judgeLaneGaps).toEqual([
      {
        heatId: "heat_1",
        heatNumber: 1,
        laneNumber: 2,
        timeBlockId: "heat:heat_1",
      },
      {
        heatId: "heat_2",
        heatNumber: 2,
        laneNumber: 2,
        timeBlockId: "heat:heat_2",
      },
      {
        heatId: "heat_2",
        heatNumber: 2,
        laneNumber: 3,
        timeBlockId: "heat:heat_2",
      },
    ])
    expect(matrix.summary.judgeLaneGaps).toBe(3)
  })

  it("flags overlaps, outside availability, role warnings, and confirmations", () => {
    const matrix = buildCrewStaffingMatrix(baseInput())

    expect(matrix.doubleBookedVolunteers).toEqual([
      {
        membershipId: "tmem_judge",
        volunteerName: "Judge One",
        assignmentIds: ["jha_1", "vsha_medical"],
        timeBlockIds: ["heat:heat_1", "shift:shift_medical"],
      },
    ])
    expect(matrix.outsideAvailabilityAssignments).toEqual([
      {
        membershipId: "tmem_check",
        volunteerName: "Check In Morning",
        availability: "morning",
        assignmentId: "vsha_check",
        timeBlockId: "shift:shift_check_in",
      },
    ])
    expect(
      matrix.credentialWarnings.map((warning) => [
        warning.assignmentId,
        warning.membershipId,
        warning.requiredRoleType,
        warning.reason,
      ]),
    ).toEqual([["jha_2", "tmem_equipment", "judge", "role_mismatch"]])
    expect(
      matrix.confirmationGaps.map((gap) => [
        gap.assignmentId,
        gap.reason,
        gap.status,
      ]),
    ).toEqual([
      ["vsha_check", "no_response", "pending"],
      ["jha_2", "declined", "declined"],
    ])
    expect(matrix.summary).toMatchObject({
      doubleBookedVolunteers: 1,
      outsideAvailabilityAssignments: 1,
      credentialWarnings: 1,
      confirmationNoResponses: 1,
      confirmationDeclines: 1,
    })
  })

  it("flags morning and afternoon volunteers assigned across the noon boundary", () => {
    const matrix = buildCrewStaffingMatrix({
      event: {
        id: "comp_1",
        timezone: "America/Denver",
      },
      roster: [
        {
          membershipId: "tmem_morning",
          name: "Morning Volunteer",
          roleTypes: ["staff"],
          availability: "morning",
          isActive: true,
        },
        {
          membershipId: "tmem_afternoon",
          name: "Afternoon Volunteer",
          roleTypes: ["staff"],
          availability: "afternoon",
          isActive: true,
        },
      ],
      shifts: [
        {
          id: "shift_noon_crossing",
          name: "Noon crossing",
          roleType: "staff",
          startTime: "2026-07-04T17:30:00.000Z",
          endTime: "2026-07-04T18:30:00.000Z",
          capacity: 2,
          assignments: [
            {
              id: "vsha_morning_crossing",
              membershipId: "tmem_morning",
            },
            {
              id: "vsha_afternoon_crossing",
              membershipId: "tmem_afternoon",
            },
          ],
        },
      ],
    })

    expect(
      matrix.outsideAvailabilityAssignments.map((assignment) => [
        assignment.assignmentId,
        assignment.availability,
      ]),
    ).toEqual([
      ["vsha_afternoon_crossing", "afternoon"],
      ["vsha_morning_crossing", "morning"],
    ])
    expect(matrix.summary.outsideAvailabilityAssignments).toBe(2)
  })

  it("reports every later assignment overlapped by a long assignment", () => {
    const matrix = buildCrewStaffingMatrix({
      event: { id: "comp_1" },
      roster: [
        {
          membershipId: "tmem_staff",
          name: "Staff One",
          roleTypes: ["staff"],
          isActive: true,
        },
      ],
      shifts: [
        {
          id: "shift_long",
          name: "Long block",
          roleType: "staff",
          startTime: "2026-07-04T15:00:00.000Z",
          endTime: "2026-07-04T18:00:00.000Z",
          capacity: 1,
          assignments: [
            {
              id: "vsha_long",
              membershipId: "tmem_staff",
            },
          ],
        },
        {
          id: "shift_middle",
          name: "Middle block",
          roleType: "staff",
          startTime: "2026-07-04T15:30:00.000Z",
          endTime: "2026-07-04T16:00:00.000Z",
          capacity: 1,
          assignments: [
            {
              id: "vsha_middle",
              membershipId: "tmem_staff",
            },
          ],
        },
        {
          id: "shift_late",
          name: "Late block",
          roleType: "staff",
          startTime: "2026-07-04T16:30:00.000Z",
          endTime: "2026-07-04T17:00:00.000Z",
          capacity: 1,
          assignments: [
            {
              id: "vsha_late",
              membershipId: "tmem_staff",
            },
          ],
        },
      ],
    })

    expect(
      matrix.doubleBookedVolunteers.map((booking) => booking.assignmentIds),
    ).toEqual([
      ["vsha_late", "vsha_long"],
      ["vsha_long", "vsha_middle"],
    ])
    expect(matrix.summary.doubleBookedVolunteers).toBe(2)
  })

  it("falls back to UTC availability checks when event timezone is invalid", () => {
    const matrix = buildCrewStaffingMatrix({
      event: {
        id: "comp_1",
        timezone: "Not/AZone",
      },
      roster: [
        {
          membershipId: "tmem_morning",
          name: "Morning Volunteer",
          roleTypes: ["staff"],
          availability: "morning",
          isActive: true,
        },
      ],
      shifts: [
        {
          id: "shift_invalid_timezone",
          name: "Invalid timezone block",
          roleType: "staff",
          startTime: "2026-07-04T13:00:00.000Z",
          endTime: "2026-07-04T14:00:00.000Z",
          capacity: 1,
          assignments: [
            {
              id: "vsha_invalid_timezone",
              membershipId: "tmem_morning",
            },
          ],
        },
      ],
    })

    expect(matrix.outsideAvailabilityAssignments).toHaveLength(1)
    expect(matrix.outsideAvailabilityAssignments[0]).toMatchObject({
      assignmentId: "vsha_invalid_timezone",
      availability: "morning",
    })
  })

  it("keeps missing and change-request confirmation gaps typed by assignment kind", () => {
    const matrix = buildCrewStaffingMatrix({
      event: { id: "comp_1" },
      roster: [
        {
          membershipId: "tmem_judge",
          name: "Judge One",
          roleTypes: ["judge"],
          isActive: true,
        },
        {
          membershipId: "tmem_staff",
          name: "Staff One",
          roleTypes: ["staff"],
          isActive: true,
        },
      ],
      shifts: [
        {
          id: "shift_staff",
          name: "Staff block",
          roleType: "staff",
          startTime: "2026-07-04T15:00:00.000Z",
          endTime: "2026-07-04T16:00:00.000Z",
          capacity: 1,
          assignments: [
            {
              id: "vsha_missing",
              membershipId: "tmem_staff",
            },
          ],
        },
      ],
      heats: [
        {
          id: "heat_1",
          trackWorkoutId: "tw_final",
          heatNumber: 1,
          scheduledTime: "2026-07-04T16:00:00.000Z",
          durationMinutes: 12,
          laneCount: 1,
        },
      ],
      judgeAssignments: [
        {
          id: "jha_change",
          heatId: "heat_1",
          membershipId: "tmem_judge",
          laneNumber: 1,
          confirmation: {
            type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
            status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED,
          },
        },
      ],
    })

    expect(
      matrix.confirmationGaps.map((gap) => [
        gap.assignmentId,
        gap.type,
        gap.reason,
      ]),
    ).toEqual([
      ["jha_change", "judge_heat", "change_requested"],
      ["vsha_missing", "volunteer_shift", "missing_confirmation"],
    ])
    expect(matrix.summary).toMatchObject({
      confirmationNoResponses: 1,
      confirmationChangeRequests: 1,
    })
  })

  it("treats cancelled confirmation rows as replaced assignment gaps", () => {
    const matrix = buildCrewStaffingMatrix({
      event: { id: "comp_1" },
      roster: [
        {
          membershipId: "tmem_staff",
          name: "Staff One",
          roleTypes: ["staff"],
          isActive: true,
        },
      ],
      shifts: [
        {
          id: "shift_staff",
          name: "Staff block",
          roleType: "staff",
          startTime: "2026-07-04T15:00:00.000Z",
          endTime: "2026-07-04T16:00:00.000Z",
          capacity: 1,
          assignments: [
            {
              id: "vsha_replaced",
              membershipId: "tmem_staff",
              confirmation: {
                type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
                status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
              },
            },
          ],
        },
      ],
    })

    expect(matrix.confirmationGaps).toMatchObject([
      {
        assignmentId: "vsha_replaced",
        type: "volunteer_shift",
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
        reason: "replaced",
      },
    ])
    expect(matrix.summary).toMatchObject({
      confirmationReplaced: 1,
    })
  })
})

function baseInput(): CrewStaffingMatrixInput {
  return {
    event: {
      id: "comp_1",
      name: "Mountain West Throwdown",
      timezone: "America/Denver",
    },
    venues: [
      {
        id: "venue_main",
        name: "Main floor",
        laneCount: 3,
      },
    ],
    workouts: [
      {
        id: "tw_final",
        name: "Final",
      },
    ],
    heats: [
      {
        id: "heat_2",
        trackWorkoutId: "tw_final",
        heatNumber: 2,
        venueId: "venue_main",
        scheduledTime: "2026-07-04T16:00:00.000Z",
        durationMinutes: 12,
      },
      {
        id: "heat_1",
        trackWorkoutId: "tw_final",
        heatNumber: 1,
        venueId: "venue_main",
        scheduledTime: "2026-07-04T15:00:00.000Z",
        durationMinutes: 12,
      },
    ],
    heatLaneAssignments: [
      {
        heatId: "heat_1",
        laneNumber: 1,
      },
      {
        heatId: "heat_1",
        laneNumber: 2,
      },
    ],
    roster: [
      {
        membershipId: "tmem_check",
        name: "Check In Morning",
        roleTypes: ["check_in"],
        availability: "morning",
        isActive: true,
      },
      {
        membershipId: "tmem_equipment",
        name: "Equipment Only",
        roleTypes: ["equipment"],
        availability: "all_day",
        isActive: true,
      },
      {
        membershipId: "tmem_judge",
        name: "Judge One",
        roleTypes: ["judge", "medical"],
        availability: "all_day",
        isActive: true,
      },
    ],
    shifts: [
      {
        id: "shift_check_in",
        name: "Check-in desk",
        roleType: "check_in",
        startTime: "2026-07-04T19:00:00.000Z",
        endTime: "2026-07-04T21:00:00.000Z",
        capacity: 2,
        assignments: [
          {
            id: "vsha_check",
            membershipId: "tmem_check",
            confirmation: {
              type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
              status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
            },
          },
        ],
      },
      {
        id: "shift_medical",
        name: "Medical station",
        roleType: "medical",
        startTime: "2026-07-04T15:05:00.000Z",
        endTime: "2026-07-04T16:05:00.000Z",
        capacity: 2,
        assignments: [
          {
            id: "vsha_medical",
            membershipId: "tmem_judge",
            confirmation: {
              type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
              status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
            },
          },
        ],
      },
    ],
    judgeAssignments: [
      {
        id: "jha_2",
        heatId: "heat_2",
        membershipId: "tmem_equipment",
        laneNumber: 1,
        confirmation: {
          type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED,
        },
      },
      {
        id: "jha_1",
        heatId: "heat_1",
        membershipId: "tmem_judge",
        laneNumber: 1,
        confirmation: {
          type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
        },
      },
    ],
  }
}
