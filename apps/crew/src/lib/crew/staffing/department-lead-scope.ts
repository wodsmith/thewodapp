// @lat: [[crew#Department Leads]]
import {
  filterCrewDepartmentLeadShifts,
  type CrewDepartmentLeadAccess,
} from "../department-leads"
import type { CrewStaffingHeatInput, CrewStaffingMatrixInput } from "./types"

export function filterCrewStaffingInputForDepartmentLead(
  input: CrewStaffingMatrixInput,
  access: CrewDepartmentLeadAccess,
): CrewStaffingMatrixInput {
  if (access.kind === "full") return input

  const scopedShifts = filterCrewDepartmentLeadShifts(
    input.shifts ?? [],
    access,
  )
  const scopedHeats = filterCrewDepartmentLeadShifts(
    (input.heats ?? []).map((heat) => ({
      ...heat,
      roleType: "judge" as const,
      location: getHeatVenueName(input, heat),
      startTime: heat.scheduledTime ?? "",
      endTime: getHeatEndTime(heat) ?? heat.scheduledTime ?? "",
    })),
    access,
  )
  const scopedHeatIds = new Set(scopedHeats.map((heat) => heat.id))

  return {
    ...input,
    heats: scopedHeats,
    heatLaneAssignments: (input.heatLaneAssignments ?? []).filter(
      (assignment) => scopedHeatIds.has(assignment.heatId),
    ),
    shifts: scopedShifts,
    judgeAssignments: (input.judgeAssignments ?? []).filter((assignment) =>
      scopedHeatIds.has(assignment.heatId),
    ),
  }
}

function getHeatVenueName(
  input: CrewStaffingMatrixInput,
  heat: CrewStaffingHeatInput,
) {
  if (!heat.venueId) return null
  return input.venues?.find((venue) => venue.id === heat.venueId)?.name ?? null
}

function getHeatEndTime(heat: CrewStaffingHeatInput) {
  if (!heat.scheduledTime || !heat.durationMinutes) return null
  const startTime =
    heat.scheduledTime instanceof Date
      ? heat.scheduledTime
      : new Date(heat.scheduledTime)
  if (Number.isNaN(startTime.getTime())) return null
  return new Date(startTime.getTime() + heat.durationMinutes * 60_000)
}
