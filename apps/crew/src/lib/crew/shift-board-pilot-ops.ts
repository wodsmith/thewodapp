// @lat: [[crew#Shift Board Pilot Ops]]
import type { CrewAssignmentConfirmationStatus } from "../../db/schemas/crew-imports"
import {
  VOLUNTEER_ROLE_LABELS,
  type VolunteerAvailability,
  type VolunteerRoleType,
} from "../../db/schemas/volunteers"
import {
  type CrewAssignmentConfirmationOperationalState,
  getCrewAssignmentConfirmationOperationalState,
} from "./assignment-confirmations"
import {
  type CrewRosterVolunteer,
  getCrewRosterAssigneeId,
  isCrewRosterVolunteerStaffable,
  isVolunteerCompatibleWithShift,
} from "./roster-shifts"
import type {
  CrewStaffingConfirmationGap,
  CrewStaffingCredentialWarning,
  CrewStaffingMatrix,
  CrewStaffingOutsideAvailabilityAssignment,
} from "./staffing"

export type CrewShiftPilotStatus =
  | "ready"
  | "open_slots"
  | "responses_needed"
  | "blocked"

export type CrewShiftPilotWarningKind =
  | "open_capacity"
  | "confirmation_gap"
  | "outside_availability"
  | "credential_warning"
  | "double_booked"

export type CrewShiftPilotWarningSeverity = "critical" | "warning"

export type CrewShiftPilotStatusFilter =
  | "all"
  | "ready"
  | "open_slots"
  | "responses_needed"
  | "blocked"

export type CrewShiftPilotSourceFilter =
  | "all"
  | "imported_assignments"
  | "direct_assignments"

export interface CrewShiftBoardPilotFilters {
  roleType: VolunteerRoleType | "all"
  status: CrewShiftPilotStatusFilter
  source: CrewShiftPilotSourceFilter
  credentialQuery: string
}

export interface CrewShiftPilotOpsAssignment {
  id: string
  // Membership id for account-backed volunteers; null for invitation-based
  // (imported / manual) volunteers, who are identified by invitationId instead.
  membershipId?: string | null
  invitationId?: string | null
  confirmation?: {
    status: CrewAssignmentConfirmationStatus
    sentAt?: Date | string | null
  } | null
}

export interface CrewShiftPilotOpsShift {
  id: string
  name: string
  roleType: VolunteerRoleType
  capacity: number
  assignments: CrewShiftPilotOpsAssignment[]
  assignedCount: number
  openSlots: number
}

export interface CrewShiftPilotWarning {
  kind: CrewShiftPilotWarningKind
  severity: CrewShiftPilotWarningSeverity
  label: string
  detail: string
  assignmentId?: string
  membershipId?: string
}

export interface CrewShiftPilotShiftState {
  shiftId: string
  status: CrewShiftPilotStatus
  statusLabel: string
  severity: "covered" | "warning" | "critical"
  openSlots: number
  importedAssignmentCount: number
  directAssignmentCount: number
  confirmationCounts: Record<CrewAssignmentConfirmationOperationalState, number>
  warnings: CrewShiftPilotWarning[]
}

export interface CrewShiftBoardPilotOpsData {
  summary: {
    totalShifts: number
    readyShifts: number
    openShiftCount: number
    responsesNeededShiftCount: number
    blockedShiftCount: number
    openSlots: number
    warningCount: number
    criticalWarningCount: number
    importedRosterCount: number
    importedAssignmentCount: number
    credentialedAssignableCount: number
  }
  shiftsById: Record<string, CrewShiftPilotShiftState>
}

export function buildCrewShiftBoardPilotOps(input: {
  shifts: CrewShiftPilotOpsShift[]
  roster: CrewRosterVolunteer[]
  matrix: CrewStaffingMatrix
}): CrewShiftBoardPilotOpsData {
  const rosterByMembershipId = buildRosterByMembershipId(input.roster)
  const rowByShiftId = new Map(
    input.matrix.coverageRows
      .filter((row) => row.timeBlockId.startsWith("shift:"))
      .map((row) => [row.timeBlockId.slice("shift:".length), row]),
  )
  const confirmationGapsByShiftId = groupShiftWarnings(
    input.matrix.confirmationGaps,
  )
  const availabilityWarningsByShiftId = groupShiftWarnings(
    input.matrix.outsideAvailabilityAssignments,
  )
  const credentialWarningsByShiftId = groupShiftWarnings(
    input.matrix.credentialWarnings,
  )
  const doubleBookingsByShiftId = new Map<string, string[]>()

  for (const doubleBooking of input.matrix.doubleBookedVolunteers) {
    for (const timeBlockId of doubleBooking.timeBlockIds) {
      const shiftId = getShiftIdFromTimeBlock(timeBlockId)
      if (!shiftId) continue
      const existing = doubleBookingsByShiftId.get(shiftId) ?? []
      existing.push(doubleBooking.volunteerName)
      doubleBookingsByShiftId.set(shiftId, existing)
    }
  }

  const shiftsById: Record<string, CrewShiftPilotShiftState> = {}
  for (const shift of input.shifts) {
    const coverageRow = rowByShiftId.get(shift.id)
    const warnings = [
      ...buildOpenCapacityWarnings(shift, coverageRow?.open ?? shift.openSlots),
      ...buildConfirmationWarnings(
        confirmationGapsByShiftId.get(shift.id) ?? [],
      ),
      ...buildAvailabilityWarnings(
        availabilityWarningsByShiftId.get(shift.id) ?? [],
      ),
      ...buildCredentialWarnings(
        credentialWarningsByShiftId.get(shift.id) ?? [],
      ),
      ...buildDoubleBookingWarnings(
        doubleBookingsByShiftId.get(shift.id) ?? [],
      ),
    ]
    const importedAssignmentCount = shift.assignments.filter((assignment) =>
      isImportedAssignment(getAssignmentAssigneeId(assignment), rosterByMembershipId),
    ).length
    const confirmationCounts = countAssignmentConfirmations(shift.assignments)
    const status = getShiftPilotStatus(warnings)

    shiftsById[shift.id] = {
      shiftId: shift.id,
      status,
      statusLabel: getStatusLabel(status),
      severity: getStatusSeverity(status),
      openSlots: coverageRow?.open ?? shift.openSlots,
      importedAssignmentCount,
      directAssignmentCount: Math.max(
        shift.assignments.length - importedAssignmentCount,
        0,
      ),
      confirmationCounts,
      warnings,
    }
  }

  const states = Object.values(shiftsById)
  const warningCount = states.reduce(
    (total, state) => total + state.warnings.length,
    0,
  )
  const criticalWarningCount = states.reduce(
    (total, state) =>
      total +
      state.warnings.filter((warning) => warning.severity === "critical")
        .length,
    0,
  )

  return {
    summary: {
      totalShifts: input.shifts.length,
      readyShifts: states.filter((state) => state.status === "ready").length,
      openShiftCount: states.filter((state) => state.status === "open_slots")
        .length,
      responsesNeededShiftCount: states.filter(
        (state) => state.status === "responses_needed",
      ).length,
      blockedShiftCount: states.filter((state) => state.status === "blocked")
        .length,
      openSlots: states.reduce((total, state) => total + state.openSlots, 0),
      warningCount,
      criticalWarningCount,
      importedRosterCount: input.roster.filter(
        (volunteer) => volunteer.imported,
      ).length,
      importedAssignmentCount: states.reduce(
        (total, state) => total + state.importedAssignmentCount,
        0,
      ),
      credentialedAssignableCount: input.roster.filter(
        (volunteer) =>
          isCrewRosterVolunteerStaffable(volunteer) &&
          hasText(volunteer.credentials),
      ).length,
    },
    shiftsById,
  }
}

export function filterCrewShiftBoardPilotShifts<
  T extends CrewShiftPilotOpsShift,
>(input: {
  shifts: T[]
  roster: CrewRosterVolunteer[]
  pilotOps: CrewShiftBoardPilotOpsData
  filters: CrewShiftBoardPilotFilters
}): T[] {
  const rosterByMembershipId = buildRosterByMembershipId(input.roster)
  const credentialQuery = normalizeSearch(input.filters.credentialQuery)

  return input.shifts.filter((shift) => {
    if (
      input.filters.roleType !== "all" &&
      shift.roleType !== input.filters.roleType
    ) {
      return false
    }

    const state = input.pilotOps.shiftsById[shift.id]
    if (
      input.filters.status !== "all" &&
      state?.status !== input.filters.status
    ) {
      return false
    }

    if (
      input.filters.source === "imported_assignments" &&
      !shift.assignments.some((assignment) =>
        isImportedAssignment(getAssignmentAssigneeId(assignment), rosterByMembershipId),
      )
    ) {
      return false
    }

    if (
      input.filters.source === "direct_assignments" &&
      !shift.assignments.some(
        (assignment) =>
          !isImportedAssignment(getAssignmentAssigneeId(assignment), rosterByMembershipId),
      )
    ) {
      return false
    }

    if (
      credentialQuery &&
      !shiftMatchesCredentialQuery(shift, input.roster, credentialQuery)
    ) {
      return false
    }

    return true
  })
}

export function getRoleFilterOptions(shifts: CrewShiftPilotOpsShift[]) {
  return [...new Set(shifts.map((shift) => shift.roleType))]
    .sort((left, right) => formatRole(left).localeCompare(formatRole(right)))
    .map((roleType) => ({
      value: roleType,
      label: formatRole(roleType),
    }))
}

function buildOpenCapacityWarnings(
  shift: CrewShiftPilotOpsShift,
  openSlots: number,
): CrewShiftPilotWarning[] {
  if (openSlots <= 0) return []
  return [
    {
      kind: "open_capacity",
      severity: "critical",
      label: `${openSlots} open slot${plural(openSlots)}`,
      detail: `${formatRole(shift.roleType)} coverage is ${shift.assignedCount}/${shift.capacity}.`,
    },
  ]
}

function buildConfirmationWarnings(
  gaps: CrewStaffingConfirmationGap[],
): CrewShiftPilotWarning[] {
  return gaps.map((gap) => ({
    kind: "confirmation_gap",
    severity:
      gap.reason === "missing_confirmation" || gap.reason === "no_response"
        ? "warning"
        : "critical",
    label: getConfirmationGapLabel(gap),
    detail: gap.volunteerName,
    assignmentId: gap.assignmentId,
    membershipId: gap.membershipId,
  }))
}

function buildAvailabilityWarnings(
  warnings: CrewStaffingOutsideAvailabilityAssignment[],
): CrewShiftPilotWarning[] {
  return warnings.map((warning) => ({
    kind: "outside_availability",
    severity: "critical",
    label: "Outside availability",
    detail: `${warning.volunteerName} is marked ${formatAvailability(warning.availability)}.`,
    assignmentId: warning.assignmentId,
    membershipId: warning.membershipId,
  }))
}

function buildCredentialWarnings(
  warnings: CrewStaffingCredentialWarning[],
): CrewShiftPilotWarning[] {
  return warnings.map((warning) => ({
    kind: "credential_warning",
    severity: "critical",
    label: "Role warning",
    detail: `${warning.volunteerName} needs ${formatRole(warning.requiredRoleType)}.`,
    assignmentId: warning.assignmentId,
    membershipId: warning.membershipId,
  }))
}

function buildDoubleBookingWarnings(
  volunteerNames: string[],
): CrewShiftPilotWarning[] {
  return [...new Set(volunteerNames)].sort().map((volunteerName) => ({
    kind: "double_booked",
    severity: "critical",
    label: "Double booked",
    detail: volunteerName,
  }))
}

function getShiftPilotStatus(
  warnings: CrewShiftPilotWarning[],
): CrewShiftPilotStatus {
  if (
    warnings.some(
      (warning) =>
        warning.severity === "critical" && warning.kind !== "open_capacity",
    )
  ) {
    return "blocked"
  }
  if (warnings.some((warning) => warning.kind === "open_capacity")) {
    return "open_slots"
  }
  if (warnings.some((warning) => warning.kind === "confirmation_gap")) {
    return "responses_needed"
  }
  return "ready"
}

function getStatusLabel(status: CrewShiftPilotStatus) {
  if (status === "ready") return "Ready"
  if (status === "open_slots") return "Open slots"
  if (status === "responses_needed") return "Responses needed"
  return "Blocked"
}

function getStatusSeverity(status: CrewShiftPilotStatus) {
  if (status === "ready") return "covered"
  if (status === "responses_needed") return "warning"
  return "critical"
}

function countAssignmentConfirmations(
  assignments: CrewShiftPilotOpsAssignment[],
): CrewShiftPilotShiftState["confirmationCounts"] {
  return assignments.reduce<CrewShiftPilotShiftState["confirmationCounts"]>(
    (counts, assignment) => {
      const state = getCrewAssignmentConfirmationOperationalState(
        assignment.confirmation ?? null,
      )
      counts[state] += 1
      return counts
    },
    {
      missing: 0,
      pending: 0,
      sent: 0,
      confirmed: 0,
      checked_in: 0,
      declined: 0,
      change_requested: 0,
      no_show: 0,
      replaced: 0,
    },
  )
}

function groupShiftWarnings<T extends { timeBlockId: string }>(items: T[]) {
  const grouped = new Map<string, T[]>()
  for (const item of items) {
    const shiftId = getShiftIdFromTimeBlock(item.timeBlockId)
    if (!shiftId) continue
    const existing = grouped.get(shiftId) ?? []
    existing.push(item)
    grouped.set(shiftId, existing)
  }
  return grouped
}

function getShiftIdFromTimeBlock(timeBlockId: string) {
  return timeBlockId.startsWith("shift:")
    ? timeBlockId.slice("shift:".length)
    : null
}

function getAssignmentAssigneeId(assignment: CrewShiftPilotOpsAssignment) {
  return assignment.membershipId ?? assignment.invitationId ?? null
}

// Keyed by canonical assignee id so invitation-based (imported / manual)
// volunteers are matched as well as account-backed memberships.
function buildRosterByMembershipId(roster: CrewRosterVolunteer[]) {
  return new Map(
    roster.flatMap((volunteer) => {
      const assigneeId = getCrewRosterAssigneeId(volunteer)
      return assigneeId ? [[assigneeId, volunteer] as const] : []
    }),
  )
}

function isImportedAssignment(
  assigneeId: string | null,
  rosterByMembershipId: Map<string, CrewRosterVolunteer>,
) {
  if (!assigneeId) return false
  return rosterByMembershipId.get(assigneeId)?.imported === true
}

function shiftMatchesCredentialQuery(
  shift: CrewShiftPilotOpsShift,
  roster: CrewRosterVolunteer[],
  credentialQuery: string,
) {
  const assignedAssigneeIds = new Set(
    shift.assignments
      .map((assignment) => getAssignmentAssigneeId(assignment))
      .filter((id): id is string => Boolean(id)),
  )
  return roster.some((volunteer) => {
    const assigneeId = volunteer.membershipId ?? volunteer.invitationId
    if (!assigneeId) return false
    if (!normalizeSearch(volunteer.credentials).includes(credentialQuery)) {
      return false
    }
    if (assignedAssigneeIds.has(assigneeId)) return true
    return (
      isCrewRosterVolunteerStaffable(volunteer) &&
      isVolunteerCompatibleWithShift(shift.roleType, volunteer.roleTypes)
    )
  })
}

function getConfirmationGapLabel(gap: CrewStaffingConfirmationGap) {
  if (gap.reason === "missing_confirmation") return "Confirmation missing"
  if (gap.reason === "no_response") return "No response"
  if (gap.reason === "declined") return "Declined"
  if (gap.reason === "change_requested") return "Change requested"
  return "No-show"
}

function formatRole(roleType: VolunteerRoleType) {
  return VOLUNTEER_ROLE_LABELS[roleType] ?? roleType
}

function formatAvailability(availability: VolunteerAvailability) {
  if (availability === "morning") return "morning"
  if (availability === "afternoon") return "afternoon"
  return "all day"
}

function normalizeSearch(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim())
}

function plural(count: number) {
  return count === 1 ? "" : "s"
}
