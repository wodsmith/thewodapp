// @lat: [[crew#Staffing Page Gap Report]]
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
} from "../../../db/schemas/crew-imports"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_ROLE_TYPES,
} from "../../../db/schemas/volunteers"
import { buildCrewStaffingMatrix } from "./matrix"
import { buildCrewStaffingReport } from "./report"
import type { CrewStaffingMatrixInput } from "./types"

describe("Crew staffing report", () => {
  it("summarizes actionable gaps over the staffing matrix", () => {
    const input = createStaffingInput()
    const matrix = buildCrewStaffingMatrix(input)
    const report = buildCrewStaffingReport(input, matrix)

    expect(report.status).toBe("critical")
    expect(report.summaryLabel).toBe("Critical gaps")
    expect(report.sourceCounts).toMatchObject({
      venues: 1,
      workouts: 1,
      heats: 1,
      heatLaneAssignments: 2,
      roster: 2,
      assignableRoster: 2,
      shifts: 1,
      shiftAssignments: 2,
      judgeAssignments: 1,
    })
    expect(report.roleSummaries).toEqual([
      {
        roleType: VOLUNTEER_ROLE_TYPES.CHECK_IN,
        roleLabel: "Check-In",
        needed: 3,
        filled: 2,
        open: 1,
        timeBlocks: 1,
      },
      {
        roleType: VOLUNTEER_ROLE_TYPES.JUDGE,
        roleLabel: "Judge",
        needed: 2,
        filled: 1,
        open: 1,
        timeBlocks: 1,
      },
    ])
    expect(
      Object.fromEntries(
        report.issueSummary.map((issue) => [issue.key, issue.count]),
      ),
    ).toMatchObject({
      open_capacity: 2,
      judge_lane_gaps: 1,
      double_booked: 1,
      outside_availability: 2,
      credential_warnings: 1,
      confirmation_declines: 1,
      confirmation_change_requests: 1,
      confirmation_no_responses: 1,
    })
    expect(report.underfilledRows).toHaveLength(2)
  })

  it("marks fully covered and confirmed staffing as covered", () => {
    const input: CrewStaffingMatrixInput = {
      event: { id: "comp_1", timezone: "UTC" },
      roster: [
        {
          membershipId: "tmem_1",
          name: "Alex Judge",
          roleTypes: [VOLUNTEER_ROLE_TYPES.JUDGE],
          availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
          isActive: true,
        },
      ],
      venues: [{ id: "venue_1", name: "Floor 1", laneCount: 1 }],
      workouts: [{ id: "tw_1", name: "Workout 1", sortOrder: 1 }],
      heats: [
        {
          id: "heat_1",
          trackWorkoutId: "tw_1",
          heatNumber: 1,
          venueId: "venue_1",
          scheduledTime: "2026-06-19T15:00:00.000Z",
          durationMinutes: 30,
        },
      ],
      judgeAssignments: [
        {
          id: "jha_1",
          heatId: "heat_1",
          membershipId: "tmem_1",
          laneNumber: 1,
          confirmation: {
            type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
            status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
          },
        },
      ],
    }

    const report = buildCrewStaffingReport(
      input,
      buildCrewStaffingMatrix(input),
    )

    expect(report.status).toBe("covered")
    expect(report.summaryLabel).toBe("Staffing covered")
    expect(report.summaryDetail).toBe(
      "All current staffing blocks are filled and confirmed.",
    )
  })
})

function createStaffingInput(): CrewStaffingMatrixInput {
  return {
    event: { id: "comp_1", timezone: "UTC" },
    venues: [{ id: "venue_1", name: "Floor 1", laneCount: 2 }],
    workouts: [{ id: "tw_1", name: "Workout 1", sortOrder: 1 }],
    heats: [
      {
        id: "heat_1",
        trackWorkoutId: "tw_1",
        heatNumber: 1,
        venueId: "venue_1",
        scheduledTime: "2026-06-19T13:00:00.000Z",
        durationMinutes: 60,
      },
    ],
    heatLaneAssignments: [
      { heatId: "heat_1", laneNumber: 1 },
      { heatId: "heat_1", laneNumber: 2 },
    ],
    roster: [
      {
        membershipId: "tmem_1",
        name: "Avery Lead",
        roleTypes: [VOLUNTEER_ROLE_TYPES.GENERAL],
        availability: VOLUNTEER_AVAILABILITY.ALL_DAY,
        isActive: true,
      },
      {
        membershipId: "tmem_2",
        name: "Blake Check-In",
        roleTypes: [VOLUNTEER_ROLE_TYPES.CHECK_IN],
        availability: VOLUNTEER_AVAILABILITY.MORNING,
        isActive: true,
      },
    ],
    shifts: [
      {
        id: "vshf_1",
        name: "Afternoon check-in",
        roleType: VOLUNTEER_ROLE_TYPES.CHECK_IN,
        startTime: "2026-06-19T13:00:00.000Z",
        endTime: "2026-06-19T15:00:00.000Z",
        capacity: 3,
        assignments: [
          {
            id: "vsha_1",
            membershipId: "tmem_1",
            confirmation: {
              type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
              status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED,
            },
          },
          {
            id: "vsha_2",
            membershipId: "tmem_2",
            confirmation: {
              type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
              status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
            },
          },
        ],
      },
    ],
    judgeAssignments: [
      {
        id: "jha_1",
        heatId: "heat_1",
        membershipId: "tmem_2",
        laneNumber: 1,
        position: VOLUNTEER_ROLE_TYPES.JUDGE,
        confirmation: {
          type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED,
        },
      },
    ],
  }
}
