// @lat: [[crew#Staffing Page Gap Report]]
import {
  VOLUNTEER_ROLE_LABELS,
  type VolunteerRoleType,
} from "../../../db/schemas/volunteers"
import type {
  CrewStaffingCoverageRow,
  CrewStaffingMatrix,
  CrewStaffingMatrixInput,
} from "./types"

export type CrewStaffingReportStatus =
  | "covered"
  | "needs_attention"
  | "critical"

export type CrewStaffingReportIssueKey =
  | "open_capacity"
  | "judge_lane_gaps"
  | "double_booked"
  | "outside_availability"
  | "credential_warnings"
  | "confirmation_no_responses"
  | "confirmation_declines"
  | "confirmation_change_requests"
  | "confirmation_no_shows"
  | "confirmation_replaced"

export interface CrewStaffingRoleSummary {
  roleType: VolunteerRoleType
  roleLabel: string
  needed: number
  filled: number
  open: number
  timeBlocks: number
}

export interface CrewStaffingReportIssueSummary {
  key: CrewStaffingReportIssueKey
  label: string
  count: number
  severity: "critical" | "warning"
}

export interface CrewStaffingReportSourceCounts {
  venues: number
  workouts: number
  heats: number
  heatLaneAssignments: number
  roster: number
  assignableRoster: number
  shifts: number
  shiftAssignments: number
  judgeAssignments: number
}

export interface CrewStaffingReport {
  status: CrewStaffingReportStatus
  summaryLabel: string
  summaryDetail: string
  sourceCounts: CrewStaffingReportSourceCounts
  roleSummaries: CrewStaffingRoleSummary[]
  issueSummary: CrewStaffingReportIssueSummary[]
  underfilledRows: CrewStaffingCoverageRow[]
}

export function buildCrewStaffingReport(
  input: CrewStaffingMatrixInput,
  matrix: CrewStaffingMatrix,
): CrewStaffingReport {
  const issueSummary = buildIssueSummary(matrix)
  const criticalIssues = issueSummary
    .filter((issue) => issue.severity === "critical")
    .reduce((total, issue) => total + issue.count, 0)
  const warningIssues = issueSummary
    .filter((issue) => issue.severity === "warning")
    .reduce((total, issue) => total + issue.count, 0)
  const hasStaffingBlocks =
    matrix.timeBlocks.length > 0 && matrix.summary.totalNeeded > 0

  return {
    status: getReportStatus({
      hasStaffingBlocks,
      criticalIssues,
      warningIssues,
    }),
    summaryLabel: getSummaryLabel({
      hasStaffingBlocks,
      criticalIssues,
      warningIssues,
    }),
    summaryDetail: getSummaryDetail({
      hasStaffingBlocks,
      criticalIssues,
      warningIssues,
    }),
    sourceCounts: buildSourceCounts(input),
    roleSummaries: buildRoleSummaries(matrix.coverageRows),
    issueSummary,
    underfilledRows: matrix.coverageRows.filter((row) => row.open > 0),
  }
}

function buildSourceCounts(
  input: CrewStaffingMatrixInput,
): CrewStaffingReportSourceCounts {
  const roster = input.roster ?? []
  const shifts = input.shifts ?? []

  return {
    venues: input.venues?.length ?? 0,
    workouts: input.workouts?.length ?? 0,
    heats: input.heats?.length ?? 0,
    heatLaneAssignments: input.heatLaneAssignments?.length ?? 0,
    roster: roster.length,
    assignableRoster: roster.filter((volunteer) => volunteer.isActive !== false)
      .length,
    shifts: shifts.length,
    shiftAssignments: shifts.reduce(
      (total, shift) => total + shift.assignments.length,
      0,
    ),
    judgeAssignments: input.judgeAssignments?.length ?? 0,
  }
}

function buildRoleSummaries(
  coverageRows: CrewStaffingCoverageRow[],
): CrewStaffingRoleSummary[] {
  const byRole = new Map<VolunteerRoleType, CrewStaffingRoleSummary>()

  for (const row of coverageRows) {
    const existing = byRole.get(row.roleType) ?? {
      roleType: row.roleType,
      roleLabel: VOLUNTEER_ROLE_LABELS[row.roleType] ?? row.roleType,
      needed: 0,
      filled: 0,
      open: 0,
      timeBlocks: 0,
    }

    existing.needed += row.needed
    existing.filled += row.filled
    existing.open += row.open
    existing.timeBlocks += 1
    byRole.set(row.roleType, existing)
  }

  return [...byRole.values()].sort(
    (left, right) =>
      right.open - left.open ||
      right.needed - left.needed ||
      left.roleLabel.localeCompare(right.roleLabel),
  )
}

function buildIssueSummary(
  matrix: CrewStaffingMatrix,
): CrewStaffingReportIssueSummary[] {
  return [
    {
      key: "open_capacity",
      label: "Open capacity",
      count: matrix.summary.openCapacity,
      severity: "critical",
    },
    {
      key: "judge_lane_gaps",
      label: "Judge lane gaps",
      count: matrix.summary.judgeLaneGaps,
      severity: "critical",
    },
    {
      key: "double_booked",
      label: "Double booked",
      count: matrix.summary.doubleBookedVolunteers,
      severity: "critical",
    },
    {
      key: "outside_availability",
      label: "Outside availability",
      count: matrix.summary.outsideAvailabilityAssignments,
      severity: "critical",
    },
    {
      key: "credential_warnings",
      label: "Role warnings",
      count: matrix.summary.credentialWarnings,
      severity: "critical",
    },
    {
      key: "confirmation_declines",
      label: "Declines",
      count: matrix.summary.confirmationDeclines,
      severity: "critical",
    },
    {
      key: "confirmation_change_requests",
      label: "Change requests",
      count: matrix.summary.confirmationChangeRequests,
      severity: "critical",
    },
    {
      key: "confirmation_no_shows",
      label: "No-shows",
      count: matrix.summary.confirmationNoShows,
      severity: "critical",
    },
    {
      key: "confirmation_replaced",
      label: "Replaced",
      count: matrix.summary.confirmationReplaced,
      severity: "critical",
    },
    {
      key: "confirmation_no_responses",
      label: "No responses",
      count: matrix.summary.confirmationNoResponses,
      severity: "warning",
    },
  ]
}

function getReportStatus(params: {
  hasStaffingBlocks: boolean
  criticalIssues: number
  warningIssues: number
}): CrewStaffingReportStatus {
  if (!params.hasStaffingBlocks) {
    return "needs_attention"
  }
  if (params.criticalIssues > 0) {
    return "critical"
  }
  if (params.warningIssues > 0) {
    return "needs_attention"
  }
  return "covered"
}

function getSummaryLabel(params: {
  hasStaffingBlocks: boolean
  criticalIssues: number
  warningIssues: number
}) {
  if (!params.hasStaffingBlocks) return "No staffing blocks"
  if (params.criticalIssues > 0) return "Critical gaps"
  if (params.warningIssues > 0) return "Responses needed"
  return "Staffing covered"
}

function getSummaryDetail(params: {
  hasStaffingBlocks: boolean
  criticalIssues: number
  warningIssues: number
}) {
  if (!params.hasStaffingBlocks) {
    return "Add shifts or scheduled heats before reviewing staffing."
  }
  if (params.criticalIssues > 0) {
    return `Resolve ${params.criticalIssues} high-priority issue${plural(params.criticalIssues)} before handoff.`
  }
  if (params.warningIssues > 0) {
    return `Collect ${params.warningIssues} outstanding assignment response${plural(params.warningIssues)}.`
  }
  return "All current staffing blocks are filled and confirmed."
}

function plural(count: number) {
  return count === 1 ? "" : "s"
}
