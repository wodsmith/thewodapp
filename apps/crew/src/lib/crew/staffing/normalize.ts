// @lat: [[crew#Staffing Matrix Core]]
import { VOLUNTEER_ROLE_TYPES } from "../../../db/schemas/volunteers"
import type {
  CrewStaffingHeatInput,
  CrewStaffingHeatLaneAssignmentInput,
  CrewStaffingMatrixInput,
  CrewStaffingShiftInput,
  CrewStaffingVenueInput,
  CrewStaffingVolunteerInput,
  CrewStaffingWorkoutInput,
} from "./types"

export interface NormalizedCrewStaffingInput {
  input: CrewStaffingMatrixInput
  venueById: Map<string, CrewStaffingVenueInput>
  workoutById: Map<string, CrewStaffingWorkoutInput>
  heatById: Map<string, CrewStaffingHeatInput>
  rosterByMembershipId: Map<string, CrewStaffingVolunteerInput>
  occupiedLaneNumbersByHeatId: Map<string, number[]>
  shifts: CrewStaffingShiftInput[]
  heats: CrewStaffingHeatInput[]
}

export function normalizeCrewStaffingMatrixInput(
  input: CrewStaffingMatrixInput,
): NormalizedCrewStaffingInput {
  const venues = [...(input.venues ?? [])].sort(compareVenue)
  const workouts = [...(input.workouts ?? [])].sort(compareWorkout)
  const heats = [...(input.heats ?? [])].sort(compareHeat)
  const roster = [...(input.roster ?? [])].sort(compareVolunteer)
  const shifts = [...(input.shifts ?? [])].sort(compareShift)

  return {
    input: {
      ...input,
      venues,
      workouts,
      heats,
      roster,
      shifts,
      heatLaneAssignments: [...(input.heatLaneAssignments ?? [])].sort(
        compareHeatLaneAssignment,
      ),
      judgeAssignments: [...(input.judgeAssignments ?? [])].sort(
        (left, right) => compareText(left.id, right.id),
      ),
    },
    venueById: new Map(venues.map((venue) => [venue.id, venue])),
    workoutById: new Map(workouts.map((workout) => [workout.id, workout])),
    heatById: new Map(heats.map((heat) => [heat.id, heat])),
    rosterByMembershipId: new Map(
      roster.map((volunteer) => [volunteer.membershipId, volunteer]),
    ),
    occupiedLaneNumbersByHeatId: groupOccupiedLaneNumbers(
      input.heatLaneAssignments ?? [],
    ),
    shifts,
    heats,
  }
}

export function toDateOrNull(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getHeatLaneNumbers(
  heat: CrewStaffingHeatInput,
  context: Pick<
    NormalizedCrewStaffingInput,
    "occupiedLaneNumbersByHeatId" | "venueById"
  >,
) {
  const occupiedLanes = context.occupiedLaneNumbersByHeatId.get(heat.id)
  if (occupiedLanes?.length) return occupiedLanes

  const laneCount =
    positiveIntegerOrNull(heat.laneCount) ??
    positiveIntegerOrNull(
      heat.venueId ? context.venueById.get(heat.venueId)?.laneCount : null,
    ) ??
    0

  return Array.from({ length: laneCount }, (_, index) => index + 1)
}

export function getAssignmentRoleType(roleType: string | null | undefined) {
  return roleType === VOLUNTEER_ROLE_TYPES.HEAD_JUDGE
    ? VOLUNTEER_ROLE_TYPES.HEAD_JUDGE
    : VOLUNTEER_ROLE_TYPES.JUDGE
}

export function compareText(left: string, right: string) {
  return left.localeCompare(right)
}

export function compareDateThenText(
  leftDate: Date | null,
  rightDate: Date | null,
  leftText: string,
  rightText: string,
) {
  const leftTime = leftDate?.getTime() ?? Number.POSITIVE_INFINITY
  const rightTime = rightDate?.getTime() ?? Number.POSITIVE_INFINITY
  if (leftTime !== rightTime) return leftTime - rightTime
  return compareText(leftText, rightText)
}

function groupOccupiedLaneNumbers(
  assignments: CrewStaffingHeatLaneAssignmentInput[],
) {
  const grouped = new Map<string, Set<number>>()

  for (const assignment of assignments) {
    const laneNumber = positiveIntegerOrNull(assignment.laneNumber)
    if (!laneNumber) continue
    const existing = grouped.get(assignment.heatId) ?? new Set<number>()
    existing.add(laneNumber)
    grouped.set(assignment.heatId, existing)
  }

  return new Map(
    [...grouped.entries()].map(([heatId, laneNumbers]) => [
      heatId,
      [...laneNumbers].sort((left, right) => left - right),
    ]),
  )
}

function compareVenue(
  left: CrewStaffingVenueInput,
  right: CrewStaffingVenueInput,
) {
  const leftOrder = left.sortOrder ?? Number.POSITIVE_INFINITY
  const rightOrder = right.sortOrder ?? Number.POSITIVE_INFINITY
  if (leftOrder !== rightOrder) return leftOrder - rightOrder
  return compareText(left.name || left.id, right.name || right.id)
}

function compareWorkout(
  left: CrewStaffingWorkoutInput,
  right: CrewStaffingWorkoutInput,
) {
  const leftOrder = left.sortOrder ?? Number.POSITIVE_INFINITY
  const rightOrder = right.sortOrder ?? Number.POSITIVE_INFINITY
  if (leftOrder !== rightOrder) return leftOrder - rightOrder
  return compareText(left.name || left.id, right.name || right.id)
}

function compareHeat(
  left: CrewStaffingHeatInput,
  right: CrewStaffingHeatInput,
) {
  const leftTime =
    toDateOrNull(left.scheduledTime)?.getTime() ?? Number.POSITIVE_INFINITY
  const rightTime =
    toDateOrNull(right.scheduledTime)?.getTime() ?? Number.POSITIVE_INFINITY

  return (
    leftTime - rightTime ||
    left.heatNumber - right.heatNumber ||
    compareText(left.id, right.id)
  )
}

function compareShift(
  left: CrewStaffingShiftInput,
  right: CrewStaffingShiftInput,
) {
  return compareDateThenText(
    toDateOrNull(left.startTime),
    toDateOrNull(right.startTime),
    left.id,
    right.id,
  )
}

function compareVolunteer(
  left: CrewStaffingVolunteerInput,
  right: CrewStaffingVolunteerInput,
) {
  return (
    compareText(
      left.name || left.email || left.membershipId,
      right.name || right.email || right.membershipId,
    ) || compareText(left.membershipId, right.membershipId)
  )
}

function compareHeatLaneAssignment(
  left: CrewStaffingHeatLaneAssignmentInput,
  right: CrewStaffingHeatLaneAssignmentInput,
) {
  return (
    compareText(left.heatId, right.heatId) || left.laneNumber - right.laneNumber
  )
}

function positiveIntegerOrNull(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null
  const rounded = Math.floor(Number(value))
  return rounded > 0 ? rounded : null
}
