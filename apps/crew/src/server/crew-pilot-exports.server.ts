// @lat: [[crew#Pilot Exports]]
import {
  buildCrewPilotExports,
  type CrewPilotExports,
} from "../lib/crew/exports/pilot-exports"
import {
  loadCrewStaffingMatrixInput,
  requireCrewStaffingEvent,
  type CrewStaffingReportEvent,
} from "../server-fns/crew-staffing-fns.server"
import type {
  CrewStaffingJudgeAssignmentInput,
  CrewStaffingMatrixInput,
  CrewStaffingShiftInput,
  CrewStaffingVolunteerInput,
} from "../lib/crew/staffing"

export interface CrewPilotExportsPageData {
  event: CrewStaffingReportEvent
  exports: CrewPilotExports
  sources: {
    shifts: number
    shiftAssignments: number
    heats: number
    heatLaneAssignments: number
    judgeAssignments: number
    activeJudgeVersions: number
  }
}

export async function getCrewPilotExportsPage(data: {
  eventId: string
}): Promise<CrewPilotExportsPageData> {
  const event = await requireCrewStaffingEvent(data.eventId)
  const { input, activeJudgeVersions } =
    await loadCrewStaffingMatrixInput(event)
  const pilotExports = buildCrewPilotExports({
    event,
    generatedAt: new Date(),
    venues: input.venues,
    workouts: input.workouts,
    heats: input.heats,
    heatLaneAssignments: input.heatLaneAssignments,
    shifts: toExportShifts(input),
    judgeAssignments: toExportJudgeAssignments(input),
  })

  return {
    event,
    exports: pilotExports,
    sources: {
      shifts: input.shifts?.length ?? 0,
      shiftAssignments:
        input.shifts?.reduce(
          (total, shift) => total + shift.assignments.length,
          0,
        ) ?? 0,
      heats: input.heats?.length ?? 0,
      heatLaneAssignments: pilotExports.judgeHeatLaneSheets.reduce(
        (total, sheet) => total + sheet.rows.length,
        0,
      ),
      judgeAssignments: input.judgeAssignments?.length ?? 0,
      activeJudgeVersions,
    },
  }
}

function toExportShifts(input: CrewStaffingMatrixInput) {
  const rosterByMembershipId = buildRosterByMembershipId(input.roster ?? [])

  return (input.shifts ?? []).map((shift: CrewStaffingShiftInput) => ({
    id: shift.id,
    name: shift.name,
    roleType: shift.roleType,
    startTime: shift.startTime,
    endTime: shift.endTime,
    capacity: shift.capacity,
    location: shift.location,
    assignments: shift.assignments.map((assignment) => {
      const volunteer = rosterByMembershipId.get(assignment.membershipId)
      return {
        id: assignment.id,
        membershipId: assignment.membershipId,
        volunteerName:
          volunteer?.name || volunteer?.email || assignment.membershipId,
        email: volunteer?.email ?? "",
        confirmation: assignment.confirmation ?? null,
      }
    }),
  }))
}

function toExportJudgeAssignments(input: CrewStaffingMatrixInput) {
  const rosterByMembershipId = buildRosterByMembershipId(input.roster ?? [])

  return (input.judgeAssignments ?? []).map(
    (assignment: CrewStaffingJudgeAssignmentInput) => {
      const volunteer = rosterByMembershipId.get(assignment.membershipId)
      return {
        id: assignment.id,
        membershipId: assignment.membershipId,
        volunteerName:
          volunteer?.name || volunteer?.email || assignment.membershipId,
        email: volunteer?.email ?? "",
        heatId: assignment.heatId,
        laneNumber: assignment.laneNumber,
        position: assignment.position,
        confirmation: assignment.confirmation ?? null,
      }
    },
  )
}

function buildRosterByMembershipId(roster: CrewStaffingVolunteerInput[]) {
  return new Map(
    roster.map((volunteer) => [volunteer.membershipId, volunteer] as const),
  )
}
