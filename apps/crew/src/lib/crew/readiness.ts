// @lat: [[crew#Pilot Readiness Checklist]]
import type {
  CrewAssignmentConfirmationOperationalSummary,
  CrewAssignmentConfirmationStatusSummary,
} from "./assignment-confirmations"
import type { CrewRosterSummary } from "./roster-shifts"

export type CrewReadinessStatus = "ready" | "needs_attention" | "blocked"

export type CrewReadinessCategory =
  | "event_basics"
  | "venues_lanes"
  | "workouts_heats"
  | "volunteers"
  | "shifts_assignments"
  | "judge_publishing"
  | "assignment_confirmations"

export type CrewReadinessActionTo =
  | "/events/$eventId/setup"
  | "/events/$eventId/imports"
  | "/events/$eventId/volunteers"
  | "/events/$eventId/shifts"
  | "/events/$eventId/schedule"

export interface CrewReadinessAction {
  label: string
  to: CrewReadinessActionTo
}

export interface CrewReadinessChecklistItem {
  category: CrewReadinessCategory
  label: string
  status: CrewReadinessStatus
  summary: string
  details: string[]
  action: CrewReadinessAction
}

export interface CrewReadinessSummary {
  total: number
  ready: number
  needsAttention: number
  blocked: number
  progressPercent: number
  highestStatus: CrewReadinessStatus
}

export interface CrewReadinessEventInput {
  startDate: string | null
  endDate: string | null
  timezone: string | null
}

export interface CrewReadinessSetupInput {
  completed: number
  total: number
}

export interface CrewReadinessVenueInput {
  venueCount: number
  totalLaneCount: number
}

export interface CrewReadinessScheduleInput {
  workoutCount: number
  publishedWorkoutCount: number
  heatCount: number
  scheduledHeatCount: number
  publishedHeatCount: number
}

export interface CrewReadinessImportInput {
  volunteerImportCount: number
  appliedVolunteerImportCount: number
  heatScheduleImportCount: number
  appliedHeatScheduleImportCount: number
}

export interface CrewReadinessShiftInput {
  totalShifts: number
  assignedSlots: number
  capacity: number
  openSlots: number
  confirmationSummary: CrewAssignmentConfirmationStatusSummary
  confirmationOperationalSummary: CrewAssignmentConfirmationOperationalSummary
}

export interface CrewReadinessJudgeInput {
  rotationCount: number
  assignmentCount: number
  activeVersionCount: number
}

export interface CrewReadinessInput {
  event: CrewReadinessEventInput
  setup: CrewReadinessSetupInput
  venues: CrewReadinessVenueInput
  schedule: CrewReadinessScheduleInput
  imports: CrewReadinessImportInput
  roster: CrewRosterSummary
  shifts: CrewReadinessShiftInput
  judge: CrewReadinessJudgeInput
}

export interface CrewReadinessChecklist {
  items: CrewReadinessChecklistItem[]
  summary: CrewReadinessSummary
}

export const crewReadinessStatusLabels: Record<CrewReadinessStatus, string> = {
  ready: "Ready",
  needs_attention: "Needs attention",
  blocked: "Blocked",
}

export function buildCrewReadinessChecklist(
  input: CrewReadinessInput,
): CrewReadinessChecklist {
  const items = [
    buildEventBasicsItem(input),
    buildVenuesLanesItem(input),
    buildWorkoutsHeatsItem(input),
    buildVolunteersItem(input),
    buildShiftsAssignmentsItem(input),
    buildJudgePublishingItem(input),
    buildAssignmentConfirmationsItem(input),
  ]

  return {
    items,
    summary: summarizeCrewReadiness(items),
  }
}

export function summarizeCrewReadiness(
  items: CrewReadinessChecklistItem[],
): CrewReadinessSummary {
  const ready = items.filter((item) => item.status === "ready").length
  const needsAttention = items.filter(
    (item) => item.status === "needs_attention",
  ).length
  const blocked = items.filter((item) => item.status === "blocked").length
  const total = items.length

  return {
    total,
    ready,
    needsAttention,
    blocked,
    progressPercent: total === 0 ? 0 : Math.round((ready / total) * 100),
    highestStatus:
      blocked > 0
        ? "blocked"
        : needsAttention > 0
          ? "needs_attention"
          : "ready",
  }
}

function buildEventBasicsItem(
  input: CrewReadinessInput,
): CrewReadinessChecklistItem {
  const hasDates = Boolean(input.event.startDate && input.event.endDate)
  const hasTimezone = Boolean(input.event.timezone)
  const setupComplete =
    input.setup.total > 0 && input.setup.completed === input.setup.total
  const status = !hasDates
    ? "blocked"
    : hasTimezone && setupComplete
      ? "ready"
      : "needs_attention"

  return {
    category: "event_basics",
    label: "Event dates and timezone",
    status,
    summary: hasDates
      ? `${input.event.startDate} to ${input.event.endDate}`
      : "Event dates are missing.",
    details: [
      hasTimezone
        ? `Timezone: ${input.event.timezone}`
        : "Timezone is not set.",
      `${input.setup.completed}/${input.setup.total} operator setup checks complete.`,
    ],
    action: { label: "Review setup", to: "/events/$eventId/setup" },
  }
}

function buildVenuesLanesItem(
  input: CrewReadinessInput,
): CrewReadinessChecklistItem {
  const status =
    input.venues.venueCount === 0 || input.venues.totalLaneCount === 0
      ? "blocked"
      : "ready"

  return {
    category: "venues_lanes",
    label: "Venues, floors, and lanes",
    status,
    summary:
      input.venues.venueCount > 0
        ? `${input.venues.venueCount} venue${plural(input.venues.venueCount)}, ${input.venues.totalLaneCount} total lane${plural(input.venues.totalLaneCount)}`
        : "No venues are configured.",
    details: [
      input.venues.totalLaneCount > 0
        ? "Lane counts are available for schedule planning."
        : "Add at least one floor or venue with lanes.",
    ],
    action: { label: "Open schedule", to: "/events/$eventId/schedule" },
  }
}

function buildWorkoutsHeatsItem(
  input: CrewReadinessInput,
): CrewReadinessChecklistItem {
  const { schedule } = input
  const status =
    schedule.workoutCount === 0 || schedule.heatCount === 0
      ? "blocked"
      : schedule.publishedWorkoutCount < schedule.workoutCount ||
          schedule.scheduledHeatCount < schedule.heatCount ||
          schedule.publishedHeatCount < schedule.heatCount
        ? "needs_attention"
        : "ready"
  const unpublishedWorkoutCount =
    schedule.workoutCount - schedule.publishedWorkoutCount

  return {
    category: "workouts_heats",
    label: "Workouts and heats",
    status,
    summary: `${schedule.publishedWorkoutCount}/${schedule.workoutCount} workouts published, ${schedule.heatCount} heat${plural(schedule.heatCount)}`,
    details: [
      `${schedule.publishedWorkoutCount}/${schedule.workoutCount} workouts published.`,
      `${unpublishedWorkoutCount} unpublished workout${plural(unpublishedWorkoutCount)} remaining.`,
      `${schedule.scheduledHeatCount}/${schedule.heatCount} heats scheduled.`,
      `${schedule.publishedHeatCount}/${schedule.heatCount} heat schedules published.`,
      `${input.imports.appliedHeatScheduleImportCount}/${input.imports.heatScheduleImportCount} heat schedule imports applied.`,
    ],
    action: { label: "Review imports", to: "/events/$eventId/imports" },
  }
}

function buildVolunteersItem(
  input: CrewReadinessInput,
): CrewReadinessChecklistItem {
  const status =
    input.roster.total === 0
      ? "blocked"
      : input.roster.assignable === 0
        ? "needs_attention"
        : "ready"

  return {
    category: "volunteers",
    label: "Volunteer roster",
    status,
    summary: `${input.roster.total} volunteer${plural(input.roster.total)}, ${input.roster.assignable} assignable`,
    details: [
      `${input.roster.active} active, ${input.roster.pending} pending, ${input.roster.accepted} accepted.`,
      `${input.imports.appliedVolunteerImportCount}/${input.imports.volunteerImportCount} volunteer imports applied.`,
    ],
    action: { label: "Open volunteers", to: "/events/$eventId/volunteers" },
  }
}

function buildShiftsAssignmentsItem(
  input: CrewReadinessInput,
): CrewReadinessChecklistItem {
  const status =
    input.shifts.totalShifts === 0 || input.shifts.assignedSlots === 0
      ? "blocked"
      : input.shifts.openSlots > 0
        ? "needs_attention"
        : "ready"

  return {
    category: "shifts_assignments",
    label: "Shifts and assignments",
    status,
    summary: `${input.shifts.assignedSlots}/${input.shifts.capacity} shift slots assigned`,
    details: [
      `${input.shifts.totalShifts} shift${plural(input.shifts.totalShifts)} configured.`,
      `${input.shifts.openSlots} open slot${plural(input.shifts.openSlots)} remaining.`,
    ],
    action: { label: "Manage shifts", to: "/events/$eventId/shifts" },
  }
}

function buildJudgePublishingItem(
  input: CrewReadinessInput,
): CrewReadinessChecklistItem {
  const status =
    input.judge.activeVersionCount > 0 ? "ready" : "needs_attention"
  const summary =
    input.judge.activeVersionCount > 0
      ? `${input.judge.activeVersionCount} active judge assignment version${plural(input.judge.activeVersionCount)}`
      : "Judge rotation publishing is not ready in Crew yet."

  return {
    category: "judge_publishing",
    label: "Judge rotation publishing",
    status,
    summary,
    details: [
      `${input.judge.rotationCount} rotation${plural(input.judge.rotationCount)} drafted.`,
      `${input.judge.assignmentCount} judge assignment${plural(input.judge.assignmentCount)} found.`,
      "Use this as a manual pilot checkpoint until the Crew judge rotation UI lands.",
    ],
    action: { label: "Open schedule", to: "/events/$eventId/schedule" },
  }
}

function buildAssignmentConfirmationsItem(
  input: CrewReadinessInput,
): CrewReadinessChecklistItem {
  const confirmations = input.shifts.confirmationSummary
  const operational = input.shifts.confirmationOperationalSummary
  const notSent = operational.missing + operational.pending
  const responseIssues =
    notSent +
    operational.sent +
    confirmations.declined +
    confirmations.changeRequested +
    confirmations.noShow +
    operational.replaced
  const status =
    input.shifts.assignedSlots === 0
      ? "needs_attention"
      : responseIssues > 0
        ? "needs_attention"
        : "ready"

  return {
    category: "assignment_confirmations",
    label: "Assignment confirmations",
    status,
    summary: `${confirmations.confirmed}/${input.shifts.assignedSlots} assignments confirmed`,
    details: [
      `${notSent} not sent.`,
      `${operational.sent} sent.`,
      `${confirmations.declined} declined.`,
      `${confirmations.changeRequested} change requested.`,
      `${confirmations.noShow} no-show.`,
      `${operational.replaced} replaced.`,
    ],
    action: { label: "Review shifts", to: "/events/$eventId/shifts" },
  }
}

function plural(count: number) {
  return count === 1 ? "" : "s"
}
