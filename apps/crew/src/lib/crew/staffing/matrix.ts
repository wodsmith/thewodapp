// @lat: [[crew#Staffing Matrix Core]]
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
} from "../../../db/schemas/crew-imports"
import { VOLUNTEER_AVAILABILITY } from "../../../db/schemas/volunteers"
import { isVolunteerCompatibleWithShift } from "../roster-shifts"
import {
  compareDateThenText,
  compareText,
  getAssignmentRoleType,
  getHeatLaneNumbers,
  normalizeCrewStaffingMatrixInput,
  toDateOrNull,
  type NormalizedCrewStaffingInput,
} from "./normalize"
import type {
  CrewStaffingConfirmationGap,
  CrewStaffingConfirmationInput,
  CrewStaffingCoverageRow,
  CrewStaffingCredentialWarning,
  CrewStaffingDoubleBookedVolunteer,
  CrewStaffingJudgeLaneGap,
  CrewStaffingMatrix,
  CrewStaffingMatrixInput,
  CrewStaffingOutsideAvailabilityAssignment,
  CrewStaffingShiftInput,
  CrewStaffingTimeBlock,
  CrewStaffingVolunteerInput,
} from "./types"

interface AssignmentWindow {
  assignmentId: string
  membershipId: string
  timeBlockId: string
  startTime: Date | null
  endTime: Date | null
}

export function buildCrewStaffingMatrix(
  input: CrewStaffingMatrixInput,
): CrewStaffingMatrix {
  const context = normalizeCrewStaffingMatrixInput(input)
  const timeBlocks = buildTimeBlocks(context)
  const timeBlockById = new Map(timeBlocks.map((block) => [block.id, block]))
  const coverageRows = buildCoverageRows(context, timeBlocks)
  const judgeLaneGaps = buildJudgeLaneGaps(context)
  const assignmentWindows = buildAssignmentWindows(context)
  const doubleBookedVolunteers = buildDoubleBookedVolunteers(
    assignmentWindows,
    context,
  )
  const outsideAvailabilityAssignments = buildOutsideAvailabilityAssignments(
    assignmentWindows,
    timeBlockById,
    context,
  )
  const credentialWarnings = buildCredentialWarnings(context)
  const confirmationGaps = buildConfirmationGaps(context)

  return {
    timeBlocks,
    coverageRows,
    judgeLaneGaps,
    doubleBookedVolunteers,
    outsideAvailabilityAssignments,
    credentialWarnings,
    confirmationGaps,
    summary: summarizeMatrix({
      coverageRows,
      timeBlocks,
      judgeLaneGaps,
      doubleBookedVolunteers,
      outsideAvailabilityAssignments,
      credentialWarnings,
      confirmationGaps,
    }),
  }
}

function buildTimeBlocks(context: NormalizedCrewStaffingInput) {
  const shiftBlocks = context.shifts.map<CrewStaffingTimeBlock>((shift) => ({
    id: `shift:${shift.id}`,
    source: "shift",
    sourceId: shift.id,
    label: shift.name,
    startTime: toDateOrNull(shift.startTime),
    endTime: toDateOrNull(shift.endTime),
    workoutId: null,
    heatId: null,
    venueId: null,
  }))

  const heatBlocks = context.heats.map<CrewStaffingTimeBlock>((heat) => {
    const startTime = toDateOrNull(heat.scheduledTime)
    return {
      id: `heat:${heat.id}`,
      source: "heat",
      sourceId: heat.id,
      label: getHeatLabel(heat, context),
      startTime,
      endTime:
        startTime && heat.durationMinutes
          ? new Date(startTime.getTime() + heat.durationMinutes * 60_000)
          : null,
      workoutId: heat.trackWorkoutId,
      heatId: heat.id,
      venueId: heat.venueId ?? null,
    }
  })

  return [...shiftBlocks, ...heatBlocks]
    .map((block, index) => ({ block, index }))
    .sort(
      (left, right) =>
        compareTimeBlockDate(left.block, right.block) ||
        left.index - right.index,
    )
    .map(({ block }) => block)
}

function buildCoverageRows(
  context: NormalizedCrewStaffingInput,
  timeBlocks: CrewStaffingTimeBlock[],
): CrewStaffingCoverageRow[] {
  const timeBlockOrder = new Map(
    timeBlocks.map((block, index) => [block.id, index]),
  )
  const shiftRows = context.shifts.map((shift) => buildShiftCoverageRow(shift))
  const heatRows = context.heats.map((heat) => {
    const laneNumbers = getHeatLaneNumbers(heat, context)
    const judgeAssignments = (context.input.judgeAssignments ?? []).filter(
      (assignment) => assignment.heatId === heat.id,
    )
    const coveredLaneNumbers = new Set(
      judgeAssignments
        .map((assignment) => assignment.laneNumber)
        .filter((laneNumber): laneNumber is number =>
          laneNumber ? laneNumbers.includes(laneNumber) : false,
        ),
    )

    return {
      id: `coverage:heat:${heat.id}:judge`,
      timeBlockId: `heat:${heat.id}`,
      roleType: getAssignmentRoleType("judge"),
      needed: laneNumbers.length,
      filled: coveredLaneNumbers.size,
      open: Math.max(laneNumbers.length - coveredLaneNumbers.size, 0),
      assignmentIds: judgeAssignments.map((assignment) => assignment.id).sort(),
    }
  })

  return [...shiftRows, ...heatRows].sort((left, right) =>
    compareCoverageRow(left, right, timeBlockOrder),
  )
}

function buildShiftCoverageRow(
  shift: CrewStaffingShiftInput,
): CrewStaffingCoverageRow {
  const filled = shift.assignments.length
  return {
    id: `coverage:shift:${shift.id}:${shift.roleType}`,
    timeBlockId: `shift:${shift.id}`,
    roleType: shift.roleType,
    needed: shift.capacity,
    filled,
    open: Math.max(shift.capacity - filled, 0),
    assignmentIds: shift.assignments
      .map((assignment) => assignment.id)
      .sort(compareText),
  }
}

function buildJudgeLaneGaps(
  context: NormalizedCrewStaffingInput,
): CrewStaffingJudgeLaneGap[] {
  const gaps: CrewStaffingJudgeLaneGap[] = []

  for (const heat of context.heats) {
    const laneNumbers = getHeatLaneNumbers(heat, context)
    const coveredLaneNumbers = new Set(
      (context.input.judgeAssignments ?? [])
        .filter((assignment) => assignment.heatId === heat.id)
        .map((assignment) => assignment.laneNumber)
        .filter((laneNumber): laneNumber is number =>
          laneNumber ? laneNumbers.includes(laneNumber) : false,
        ),
    )

    for (const laneNumber of laneNumbers) {
      if (!coveredLaneNumbers.has(laneNumber)) {
        gaps.push({
          heatId: heat.id,
          heatNumber: heat.heatNumber,
          laneNumber,
          timeBlockId: `heat:${heat.id}`,
        })
      }
    }
  }

  return gaps.sort(
    (left, right) =>
      compareText(left.heatId, right.heatId) ||
      left.laneNumber - right.laneNumber,
  )
}

function buildAssignmentWindows(
  context: NormalizedCrewStaffingInput,
): AssignmentWindow[] {
  const shiftWindows = context.shifts.flatMap((shift) =>
    shift.assignments.map<AssignmentWindow>((assignment) => ({
      assignmentId: assignment.id,
      membershipId: assignment.membershipId,
      timeBlockId: `shift:${shift.id}`,
      startTime: toDateOrNull(shift.startTime),
      endTime: toDateOrNull(shift.endTime),
    })),
  )

  const judgeWindows = (context.input.judgeAssignments ?? []).map(
    (assignment) => {
      const heat = context.heatById.get(assignment.heatId)
      const startTime = toDateOrNull(heat?.scheduledTime)
      return {
        assignmentId: assignment.id,
        membershipId: assignment.membershipId,
        timeBlockId: `heat:${assignment.heatId}`,
        startTime,
        endTime:
          startTime && heat?.durationMinutes
            ? new Date(startTime.getTime() + heat.durationMinutes * 60_000)
            : null,
      }
    },
  )

  return [...shiftWindows, ...judgeWindows].sort(compareAssignmentWindow)
}

function buildDoubleBookedVolunteers(
  assignmentWindows: AssignmentWindow[],
  context: NormalizedCrewStaffingInput,
) {
  const byMembershipId = new Map<string, AssignmentWindow[]>()
  const doubleBooked: CrewStaffingDoubleBookedVolunteer[] = []

  for (const assignmentWindow of assignmentWindows) {
    if (!assignmentWindow.startTime || !assignmentWindow.endTime) continue
    const existing = byMembershipId.get(assignmentWindow.membershipId) ?? []
    existing.push(assignmentWindow)
    byMembershipId.set(assignmentWindow.membershipId, existing)
  }

  for (const [membershipId, windows] of byMembershipId.entries()) {
    const sortedWindows = [...windows].sort(compareAssignmentWindow)
    for (let index = 0; index < sortedWindows.length; index++) {
      const current = sortedWindows[index]
      if (!current) continue

      for (
        let nextIndex = index + 1;
        nextIndex < sortedWindows.length;
        nextIndex++
      ) {
        const next = sortedWindows[nextIndex]
        if (!next) continue
        if (
          current.endTime &&
          next.startTime &&
          next.startTime >= current.endTime
        ) {
          break
        }
        if (overlaps(current, next)) {
          const volunteer = context.rosterByMembershipId.get(membershipId)
          doubleBooked.push({
            membershipId,
            volunteerName: getVolunteerName(volunteer, membershipId),
            assignmentIds: [current.assignmentId, next.assignmentId].sort(
              compareText,
            ),
            timeBlockIds: [current.timeBlockId, next.timeBlockId].sort(
              compareText,
            ),
          })
        }
      }
    }
  }

  return dedupeDoubleBookings(doubleBooked)
}

function buildOutsideAvailabilityAssignments(
  assignmentWindows: AssignmentWindow[],
  timeBlockById: Map<string, CrewStaffingTimeBlock>,
  context: NormalizedCrewStaffingInput,
) {
  const warnings: CrewStaffingOutsideAvailabilityAssignment[] = []

  for (const assignmentWindow of assignmentWindows) {
    const volunteer = context.rosterByMembershipId.get(
      assignmentWindow.membershipId,
    )
    const availability = volunteer?.availability
    if (!availability || availability === VOLUNTEER_AVAILABILITY.ALL_DAY) {
      continue
    }
    const timeBlock = timeBlockById.get(assignmentWindow.timeBlockId)
    if (!timeBlock?.startTime || !timeBlock.endTime) continue

    if (!isWithinAvailability(timeBlock, availability, context)) {
      warnings.push({
        membershipId: assignmentWindow.membershipId,
        volunteerName: getVolunteerName(
          volunteer,
          assignmentWindow.membershipId,
        ),
        availability,
        assignmentId: assignmentWindow.assignmentId,
        timeBlockId: assignmentWindow.timeBlockId,
      })
    }
  }

  return warnings.sort(compareAvailabilityWarning)
}

function buildCredentialWarnings(context: NormalizedCrewStaffingInput) {
  const warnings: CrewStaffingCredentialWarning[] = []

  for (const shift of context.shifts) {
    for (const assignment of shift.assignments) {
      const volunteer = context.rosterByMembershipId.get(
        assignment.membershipId,
      )
      const warning = getCredentialWarning({
        volunteer,
        membershipId: assignment.membershipId,
        assignmentId: assignment.id,
        timeBlockId: `shift:${shift.id}`,
        requiredRoleType: shift.roleType,
      })
      if (warning) warnings.push(warning)
    }
  }

  for (const assignment of context.input.judgeAssignments ?? []) {
    const volunteer = context.rosterByMembershipId.get(assignment.membershipId)
    const warning = getCredentialWarning({
      volunteer,
      membershipId: assignment.membershipId,
      assignmentId: assignment.id,
      timeBlockId: `heat:${assignment.heatId}`,
      requiredRoleType: getAssignmentRoleType(assignment.position),
    })
    if (warning) warnings.push(warning)
  }

  return warnings.sort(compareCredentialWarning)
}

function buildConfirmationGaps(context: NormalizedCrewStaffingInput) {
  const gaps: CrewStaffingConfirmationGap[] = []

  for (const shift of context.shifts) {
    for (const assignment of shift.assignments) {
      const gap = getConfirmationGap({
        assignmentId: assignment.id,
        membershipId: assignment.membershipId,
        timeBlockId: `shift:${shift.id}`,
        confirmation: assignment.confirmation ?? null,
        fallbackType: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        context,
      })
      if (gap) gaps.push(gap)
    }
  }

  for (const assignment of context.input.judgeAssignments ?? []) {
    const gap = getConfirmationGap({
      assignmentId: assignment.id,
      membershipId: assignment.membershipId,
      timeBlockId: `heat:${assignment.heatId}`,
      confirmation: assignment.confirmation ?? null,
      fallbackType: CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
      context,
    })
    if (gap) gaps.push(gap)
  }

  return gaps.sort(compareConfirmationGap)
}

function getCredentialWarning(params: {
  volunteer: CrewStaffingVolunteerInput | undefined
  membershipId: string
  assignmentId: string
  timeBlockId: string
  requiredRoleType: CrewStaffingCredentialWarning["requiredRoleType"]
}): CrewStaffingCredentialWarning | null {
  const { volunteer } = params
  if (!volunteer) {
    return {
      membershipId: params.membershipId,
      volunteerName: params.membershipId,
      assignmentId: params.assignmentId,
      timeBlockId: params.timeBlockId,
      requiredRoleType: params.requiredRoleType,
      volunteerRoleTypes: [],
      reason: "missing_volunteer",
    }
  }

  if (volunteer.isActive === false) {
    return {
      membershipId: volunteer.membershipId,
      volunteerName: getVolunteerName(volunteer, volunteer.membershipId),
      assignmentId: params.assignmentId,
      timeBlockId: params.timeBlockId,
      requiredRoleType: params.requiredRoleType,
      volunteerRoleTypes: volunteer.roleTypes,
      reason: "inactive_volunteer",
    }
  }

  if (
    !isVolunteerCompatibleWithShift(
      params.requiredRoleType,
      volunteer.roleTypes,
    )
  ) {
    return {
      membershipId: volunteer.membershipId,
      volunteerName: getVolunteerName(volunteer, volunteer.membershipId),
      assignmentId: params.assignmentId,
      timeBlockId: params.timeBlockId,
      requiredRoleType: params.requiredRoleType,
      volunteerRoleTypes: volunteer.roleTypes,
      reason: "role_mismatch",
    }
  }

  return null
}

function getConfirmationGap(params: {
  assignmentId: string
  membershipId: string
  timeBlockId: string
  confirmation: CrewStaffingConfirmationInput | null
  fallbackType: CrewStaffingConfirmationGap["type"]
  context: NormalizedCrewStaffingInput
}): CrewStaffingConfirmationGap | null {
  const volunteer = params.context.rosterByMembershipId.get(params.membershipId)
  const base = {
    assignmentId: params.assignmentId,
    membershipId: params.membershipId,
    volunteerName: getVolunteerName(volunteer, params.membershipId),
    timeBlockId: params.timeBlockId,
  }

  if (!params.confirmation) {
    return {
      ...base,
      type: params.fallbackType,
      status: null,
      reason: "missing_confirmation",
    }
  }

  if (
    params.confirmation.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING
  ) {
    return {
      ...base,
      type: params.confirmation.type,
      status: params.confirmation.status,
      reason: "no_response",
    }
  }
  if (
    params.confirmation.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED
  ) {
    return {
      ...base,
      type: params.confirmation.type,
      status: params.confirmation.status,
      reason: "declined",
    }
  }
  if (
    params.confirmation.status ===
    CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED
  ) {
    return {
      ...base,
      type: params.confirmation.type,
      status: params.confirmation.status,
      reason: "change_requested",
    }
  }
  if (
    params.confirmation.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.NO_SHOW
  ) {
    return {
      ...base,
      type: params.confirmation.type,
      status: params.confirmation.status,
      reason: "no_show",
    }
  }

  return null
}

function summarizeMatrix(input: {
  timeBlocks: CrewStaffingTimeBlock[]
  coverageRows: CrewStaffingCoverageRow[]
  judgeLaneGaps: CrewStaffingJudgeLaneGap[]
  doubleBookedVolunteers: CrewStaffingDoubleBookedVolunteer[]
  outsideAvailabilityAssignments: CrewStaffingOutsideAvailabilityAssignment[]
  credentialWarnings: CrewStaffingCredentialWarning[]
  confirmationGaps: CrewStaffingConfirmationGap[]
}) {
  const roles = new Set(input.coverageRows.map((row) => row.roleType))
  const confirmationNoResponses = input.confirmationGaps.filter(
    (gap) =>
      gap.reason === "missing_confirmation" || gap.reason === "no_response",
  ).length

  return {
    timeBlocks: input.timeBlocks.length,
    roles: roles.size,
    totalNeeded: sumRows(input.coverageRows, "needed"),
    totalFilled: sumRows(input.coverageRows, "filled"),
    totalOpen: sumRows(input.coverageRows, "open"),
    underfilledRows: input.coverageRows.filter((row) => row.open > 0).length,
    openCapacity: sumRows(input.coverageRows, "open"),
    judgeLaneGaps: input.judgeLaneGaps.length,
    doubleBookedVolunteers: input.doubleBookedVolunteers.length,
    outsideAvailabilityAssignments: input.outsideAvailabilityAssignments.length,
    credentialWarnings: input.credentialWarnings.length,
    confirmationNoResponses,
    confirmationDeclines: input.confirmationGaps.filter(
      (gap) => gap.reason === "declined",
    ).length,
    confirmationChangeRequests: input.confirmationGaps.filter(
      (gap) => gap.reason === "change_requested",
    ).length,
    confirmationNoShows: input.confirmationGaps.filter(
      (gap) => gap.reason === "no_show",
    ).length,
  }
}

function getHeatLabel(
  heat: NormalizedCrewStaffingInput["heats"][number],
  context: NormalizedCrewStaffingInput,
) {
  const workout = context.workoutById.get(heat.trackWorkoutId)
  const venue = heat.venueId ? context.venueById.get(heat.venueId) : null
  return [workout?.name ?? "Workout", `Heat ${heat.heatNumber}`, venue?.name]
    .filter(Boolean)
    .join(" - ")
}

function isWithinAvailability(
  timeBlock: Pick<CrewStaffingTimeBlock, "startTime" | "endTime">,
  availability: CrewStaffingOutsideAvailabilityAssignment["availability"],
  context: NormalizedCrewStaffingInput,
) {
  if (!timeBlock.startTime || !timeBlock.endTime) return true
  const startMinute = getLocalMinuteOfDay(
    timeBlock.startTime,
    context.input.event.timezone,
  )
  const endMinute = getLocalMinuteOfDay(
    timeBlock.endTime,
    context.input.event.timezone,
  )

  if (availability === VOLUNTEER_AVAILABILITY.MORNING) {
    return startMinute < NOON_MINUTE && endMinute <= NOON_MINUTE
  }
  if (availability === VOLUNTEER_AVAILABILITY.AFTERNOON) {
    return startMinute >= NOON_MINUTE && endMinute > NOON_MINUTE
  }
  return true
}

const NOON_MINUTE = 12 * 60

function getLocalMinuteOfDay(date: Date, timezone: string | null | undefined) {
  if (!timezone) return date.getUTCHours() * 60 + date.getUTCMinutes()
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      hourCycle: "h23",
    })
    const parts = formatter.formatToParts(date)
    const hourPart = parts.find((part) => part.type === "hour")?.value
    const minutePart = parts.find((part) => part.type === "minute")?.value
    const hour = Number(hourPart)
    const minute = Number(minutePart)
    return Number.isFinite(hour) && Number.isFinite(minute)
      ? (hour % 24) * 60 + minute
      : date.getUTCHours() * 60 + date.getUTCMinutes()
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes()
  }
}

function getVolunteerName(
  volunteer: CrewStaffingVolunteerInput | undefined,
  fallback: string,
) {
  return volunteer?.name || volunteer?.email || fallback
}

function overlaps(left: AssignmentWindow, right: AssignmentWindow) {
  if (!left.startTime || !left.endTime || !right.startTime || !right.endTime) {
    return false
  }
  return left.startTime < right.endTime && right.startTime < left.endTime
}

function dedupeDoubleBookings(
  doubleBooked: CrewStaffingDoubleBookedVolunteer[],
) {
  const byKey = new Map<string, CrewStaffingDoubleBookedVolunteer>()
  for (const booking of doubleBooked) {
    byKey.set(
      `${booking.membershipId}:${booking.assignmentIds.join(":")}`,
      booking,
    )
  }
  return [...byKey.values()].sort(compareDoubleBooking)
}

function compareTimeBlockDate(
  left: CrewStaffingTimeBlock,
  right: CrewStaffingTimeBlock,
) {
  return compareDateThenText(left.startTime, right.startTime, "", "")
}

function compareCoverageRow(
  left: CrewStaffingCoverageRow,
  right: CrewStaffingCoverageRow,
  timeBlockOrder: Map<string, number>,
) {
  const leftOrder = timeBlockOrder.get(left.timeBlockId)
  const rightOrder = timeBlockOrder.get(right.timeBlockId)

  return (
    (leftOrder ?? Number.POSITIVE_INFINITY) -
      (rightOrder ?? Number.POSITIVE_INFINITY) ||
    compareText(left.roleType, right.roleType) ||
    compareText(left.id, right.id)
  )
}

function compareAssignmentWindow(
  left: AssignmentWindow,
  right: AssignmentWindow,
) {
  return (
    compareDateThenText(
      left.startTime,
      right.startTime,
      left.assignmentId,
      right.assignmentId,
    ) || compareText(left.membershipId, right.membershipId)
  )
}

function compareDoubleBooking(
  left: CrewStaffingDoubleBookedVolunteer,
  right: CrewStaffingDoubleBookedVolunteer,
) {
  return (
    compareText(left.membershipId, right.membershipId) ||
    compareText(left.assignmentIds.join(":"), right.assignmentIds.join(":"))
  )
}

function compareAvailabilityWarning(
  left: CrewStaffingOutsideAvailabilityAssignment,
  right: CrewStaffingOutsideAvailabilityAssignment,
) {
  return (
    compareText(left.membershipId, right.membershipId) ||
    compareText(left.assignmentId, right.assignmentId)
  )
}

function compareCredentialWarning(
  left: CrewStaffingCredentialWarning,
  right: CrewStaffingCredentialWarning,
) {
  return (
    compareText(left.membershipId, right.membershipId) ||
    compareText(left.assignmentId, right.assignmentId)
  )
}

function compareConfirmationGap(
  left: CrewStaffingConfirmationGap,
  right: CrewStaffingConfirmationGap,
) {
  return (
    compareText(left.membershipId, right.membershipId) ||
    compareText(left.assignmentId, right.assignmentId)
  )
}

function sumRows(
  rows: CrewStaffingCoverageRow[],
  key: "needed" | "filled" | "open",
) {
  return rows.reduce((total, row) => total + row[key], 0)
}
