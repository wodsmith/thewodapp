// @lat: [[crew#Department Leads]]
import { describe, expect, it } from "vitest"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
} from "../../../db/schemas/crew-imports"
import { normalizeCrewDepartmentLeadScope } from "../department-leads"
import { buildCrewStaffingMatrix } from "./matrix"
import { buildCrewStaffingReport } from "./report"
import { filterCrewStaffingInputForDepartmentLead } from "./department-lead-scope"
import type { CrewStaffingMatrixInput } from "./types"

describe("Crew staffing department-lead scope", () => {
  it("removes out-of-scope judge assignment membership and status data", () => {
    const input: CrewStaffingMatrixInput = {
      event: { id: "comp_1", timezone: "UTC" },
      venues: [
        { id: "venue_north", name: "North Floor", laneCount: 2 },
        { id: "venue_south", name: "South Floor", laneCount: 2 },
      ],
      workouts: [{ id: "tw_1", name: "Workout 1", sortOrder: 1 }],
      heats: [
        {
          id: "heat_south_hidden",
          trackWorkoutId: "tw_1",
          heatNumber: 1,
          venueId: "venue_south",
          scheduledTime: "2026-07-01T15:00:00.000Z",
          durationMinutes: 30,
        },
      ],
      heatLaneAssignments: [
        { heatId: "heat_south_hidden", laneNumber: 1 },
        { heatId: "heat_south_hidden", laneNumber: 2 },
      ],
      roster: [
        {
          membershipId: "tmem_visible",
          name: "Visible Lead Volunteer",
          roleTypes: ["judge"],
          isActive: true,
        },
        {
          membershipId: "tmem_hidden",
          name: "Hidden Judge",
          roleTypes: ["judge"],
          isActive: true,
        },
      ],
      shifts: [
        {
          id: "shift_north_visible",
          name: "North judge shift",
          roleType: "judge",
          location: "North Floor",
          startTime: "2026-07-01T15:00:00.000Z",
          endTime: "2026-07-01T16:00:00.000Z",
          capacity: 1,
          assignments: [
            {
              id: "vsha_visible",
              membershipId: "tmem_hidden",
            },
          ],
        },
      ],
      judgeAssignments: [
        {
          id: "jha_hidden_declined",
          heatId: "heat_south_hidden",
          membershipId: "tmem_hidden",
          laneNumber: 1,
          position: "judge",
          confirmation: {
            type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
            status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED,
          },
        },
      ],
    }
    const scopedInput = filterCrewStaffingInputForDepartmentLead(input, {
      kind: "department_lead",
      scopes: [
        normalizeCrewDepartmentLeadScope({
          id: "cdlead_north_judge",
          roleType: "judge",
          startsAt: "2026-07-01T14:00:00.000Z",
          endsAt: "2026-07-01T18:00:00.000Z",
          scope: { floors: ["North Floor"] },
        }),
      ],
    })
    const matrix = buildCrewStaffingMatrix(scopedInput)
    const report = buildCrewStaffingReport(scopedInput, matrix)

    expect(scopedInput.heats).toEqual([])
    expect(scopedInput.heatLaneAssignments).toEqual([])
    expect(scopedInput.judgeAssignments).toEqual([])
    expect(report.sourceCounts.judgeAssignments).toBe(0)
    expect(matrix.doubleBookedVolunteers).toEqual([])
    expect(
      matrix.credentialWarnings.map((warning) => warning.assignmentId),
    ).not.toContain("jha_hidden_declined")
    expect(
      matrix.confirmationGaps.map((gap) => gap.assignmentId),
    ).not.toContain("jha_hidden_declined")
    expect(matrix.summary.confirmationDeclines).toBe(0)
  })
})
