// @lat: [[crew#Guided Setup State]]
import { parseCrewSettings, type CrewSetupState } from "../crew-event-setup"
import type {
  CrewReadinessChecklist,
  CrewReadinessEventInput,
  CrewReadinessImportInput,
  CrewReadinessJudgeInput,
  CrewReadinessScheduleInput,
  CrewReadinessSetupInput,
  CrewReadinessShiftInput,
  CrewReadinessSummary,
  CrewReadinessVenueInput,
} from "./readiness"
import type { CrewRosterSummary } from "./roster-shifts"

export const crewGuidedSetupStepKeys = [
  "event_basics",
  "days_floors",
  "imports",
  "roles",
  "staffing_assumptions",
  "schedule_publish",
  "reminders",
  "exports",
] as const

export type CrewGuidedSetupStepKey = (typeof crewGuidedSetupStepKeys)[number]

export type CrewGuidedSetupStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "complete"

export type CrewGuidedSetupOperatorStatus = CrewGuidedSetupStatus

export type CrewGuidedSetupActionTo =
  | "/events/$eventId/setup"
  | "/events/$eventId/schedule"
  | "/events/$eventId/volunteers"
  | "/events/$eventId/staffing"
  | "/events/$eventId/shifts"
  | "/events/$eventId/readiness"
  | "/events/$eventId/exports"

export interface CrewGuidedSetupPersistedStep {
  status?: CrewGuidedSetupOperatorStatus
  note: string
  updatedAt: string | null
}

export interface CrewGuidedSetupPersistedState {
  activeStep: CrewGuidedSetupStepKey | null
  steps: Partial<Record<CrewGuidedSetupStepKey, CrewGuidedSetupPersistedStep>>
}

export interface CrewGuidedSetupStep {
  key: CrewGuidedSetupStepKey
  label: string
  summary: string
  details: string[]
  action: {
    label: string
    to: CrewGuidedSetupActionTo
  }
  status: CrewGuidedSetupStatus
  systemStatus: CrewGuidedSetupStatus
  operatorStatus: CrewGuidedSetupOperatorStatus | null
  note: string
  updatedAt: string | null
}

export interface CrewGuidedSetupSummary {
  total: number
  complete: number
  inProgress: number
  blocked: number
  notStarted: number
  progressPercent: number
  highestStatus: CrewGuidedSetupStatus
}

export interface CrewGuidedSetupState {
  activeStep: CrewGuidedSetupStepKey
  steps: CrewGuidedSetupStep[]
  summary: CrewGuidedSetupSummary
}

export interface CrewGuidedSetupFacts {
  setup: CrewReadinessSetupInput
  venues: CrewReadinessVenueInput
  schedule: CrewReadinessScheduleInput
  imports: CrewReadinessImportInput
  roster: CrewRosterSummary
  shifts: CrewReadinessShiftInput
  judge: CrewReadinessJudgeInput
}

export interface BuildCrewGuidedSetupInput {
  event: CrewReadinessEventInput
  setup: CrewSetupState
  facts: CrewGuidedSetupFacts
  readiness: CrewReadinessChecklist
  persisted: CrewGuidedSetupPersistedState
}

export interface UpdateCrewGuidedSetupStepInput {
  stepKey: CrewGuidedSetupStepKey
  status: CrewGuidedSetupOperatorStatus | null
  note?: string
  updatedAt: string
}

export const crewGuidedSetupStatusLabels: Record<
  CrewGuidedSetupStatus,
  string
> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  complete: "Complete",
}

const defaultGuidedSetupState: CrewGuidedSetupPersistedState = {
  activeStep: null,
  steps: {},
}

export function parseCrewGuidedSetupSettings(
  settingsText: string | null,
): CrewGuidedSetupPersistedState {
  const parsed = parseCrewSettings(settingsText)
  return readPersistedGuidedSetup(parsed.baseSettings.guidedSetup)
}

export function serializeCrewGuidedSetupSettings(
  settingsText: string | null,
  guidedSetup: CrewGuidedSetupPersistedState,
) {
  const parsed = parseCrewSettings(settingsText)

  return JSON.stringify(
    {
      ...parsed.baseSettings,
      guidedSetup: normalizePersistedGuidedSetup(guidedSetup),
    },
    null,
    2,
  )
}

export function updateCrewGuidedSetupStepState(
  state: CrewGuidedSetupPersistedState,
  input: UpdateCrewGuidedSetupStepInput,
): CrewGuidedSetupPersistedState {
  const steps = { ...state.steps }
  const current = steps[input.stepKey] ?? {
    note: "",
    updatedAt: null,
  }
  const nextStep: CrewGuidedSetupPersistedStep = {
    ...current,
    note: input.note !== undefined ? input.note.trim() : current.note,
    updatedAt: input.updatedAt,
  }

  if (input.status === null) {
    delete nextStep.status
  } else {
    nextStep.status = input.status
  }

  if (!nextStep.status && !nextStep.note) {
    delete steps[input.stepKey]
  } else {
    steps[input.stepKey] = nextStep
  }

  return {
    activeStep: input.stepKey,
    steps,
  }
}

export function buildCrewGuidedSetupState(
  input: BuildCrewGuidedSetupInput,
): CrewGuidedSetupState {
  const steps = [
    buildEventBasicsStep(input),
    buildDaysFloorsStep(input),
    buildImportsStep(input),
    buildRolesStep(input),
    buildStaffingAssumptionsStep(input),
    buildSchedulePublishStep(input),
    buildRemindersStep(input),
    buildExportsStep(input),
  ].map((step) => applyPersistedStep(step, input.persisted.steps[step.key]))

  const firstOpenStep =
    steps.find((step) => step.status !== "complete")?.key ?? steps[0].key
  const activeStep =
    input.persisted.activeStep &&
    crewGuidedSetupStepKeys.includes(input.persisted.activeStep)
      ? input.persisted.activeStep
      : firstOpenStep

  return {
    activeStep,
    steps,
    summary: summarizeGuidedSetupSteps(steps),
  }
}

function buildEventBasicsStep(
  input: BuildCrewGuidedSetupInput,
): CrewGuidedSetupStep {
  const hasDates = Boolean(input.event.startDate && input.event.endDate)
  const hasTimezone = Boolean(input.event.timezone)
  const eventBasicsConfirmed =
    input.setup.checklist.eventBasicsConfirmed === true
  const status = !hasDates
    ? "blocked"
    : hasTimezone && eventBasicsConfirmed
      ? "complete"
      : "in_progress"

  return createBaseStep({
    key: "event_basics",
    label: "Event basics",
    status,
    summary: hasDates
      ? `${input.event.startDate} to ${input.event.endDate}`
      : "Event dates are missing.",
    details: [
      hasTimezone
        ? `Timezone: ${input.event.timezone}`
        : "Timezone is not set.",
      eventBasicsConfirmed
        ? "Operator basics check is complete."
        : "Confirm dates, timezone, source contact, and Crew-only plan.",
    ],
    action: { label: "Edit setup", to: "/events/$eventId/setup" },
  })
}

function buildDaysFloorsStep(
  input: BuildCrewGuidedSetupInput,
): CrewGuidedSetupStep {
  const { venues } = input.facts
  const status =
    venues.venueCount === 0 || venues.totalLaneCount === 0
      ? "blocked"
      : "complete"

  return createBaseStep({
    key: "days_floors",
    label: "Days and floors",
    status,
    summary:
      venues.venueCount > 0
        ? `${venues.venueCount} venue${plural(venues.venueCount)}, ${venues.totalLaneCount} lane${plural(venues.totalLaneCount)}`
        : "No venues or floors are configured.",
    details: [
      venues.totalLaneCount > 0
        ? "Floor and lane counts are available for shift planning."
        : "Add floors or venue lane counts before staffing the event.",
    ],
    action: { label: "Open schedule", to: "/events/$eventId/schedule" },
  })
}

function buildImportsStep(
  input: BuildCrewGuidedSetupInput,
): CrewGuidedSetupStep {
  const { imports, roster, schedule } = input.facts
  const hasVolunteerSource =
    roster.total > 0 || imports.appliedVolunteerImportCount > 0
  const hasScheduleSource =
    schedule.heatCount > 0 || imports.appliedHeatScheduleImportCount > 0
  const totalImports =
    imports.volunteerImportCount + imports.heatScheduleImportCount
  const appliedImports =
    imports.appliedVolunteerImportCount + imports.appliedHeatScheduleImportCount
  const status =
    hasVolunteerSource && hasScheduleSource
      ? "complete"
      : totalImports === 0 && roster.total === 0 && schedule.heatCount === 0
        ? "not_started"
        : "in_progress"

  return createBaseStep({
    key: "imports",
    label: "Imports",
    status,
    summary: `${appliedImports}/${totalImports} imports applied`,
    details: [
      `${imports.appliedVolunteerImportCount}/${imports.volunteerImportCount} volunteer imports applied.`,
      `${imports.appliedHeatScheduleImportCount}/${imports.heatScheduleImportCount} heat schedule imports applied.`,
      `${roster.total} volunteer${plural(roster.total)} and ${schedule.heatCount} heat${plural(schedule.heatCount)} available after import or manual setup.`,
    ],
    action: { label: "Review imports", to: "/events/$eventId/volunteers" },
  })
}

function buildRolesStep(input: BuildCrewGuidedSetupInput): CrewGuidedSetupStep {
  const { roster, shifts } = input.facts
  const status =
    roster.total === 0
      ? "blocked"
      : roster.assignable > 0 && shifts.totalShifts > 0
        ? "complete"
        : "in_progress"

  return createBaseStep({
    key: "roles",
    label: "Roles",
    status,
    summary: `${roster.assignable}/${roster.total} assignable volunteers, ${shifts.totalShifts} shift${plural(shifts.totalShifts)}`,
    details: [
      `${roster.active} active, ${roster.pending} pending, ${roster.accepted} accepted.`,
      shifts.totalShifts > 0
        ? "Role shifts exist for staffing."
        : "Create shifts for the roles this event needs.",
    ],
    action: { label: "Open staffing", to: "/events/$eventId/staffing" },
  })
}

function buildStaffingAssumptionsStep(
  input: BuildCrewGuidedSetupInput,
): CrewGuidedSetupStep {
  const hasChecklist = input.setup.checklist.staffingPlanDrafted === true
  const status = hasChecklist ? "complete" : "not_started"

  return createBaseStep({
    key: "staffing_assumptions",
    label: "Staffing assumptions",
    status,
    summary: hasChecklist
      ? "Floors, lanes, and staffing assumptions marked ready."
      : "Staffing assumptions not yet marked ready.",
    details: [
      hasChecklist
        ? "Operator staffing plan check is complete."
        : "Mark the staffing plan check once floors, lanes, and roles are mapped out.",
    ],
    action: { label: "Edit setup", to: "/events/$eventId/setup" },
  })
}

function buildSchedulePublishStep(
  input: BuildCrewGuidedSetupInput,
): CrewGuidedSetupStep {
  const { schedule } = input.facts
  const hasCoreSchedule = schedule.workoutCount > 0 && schedule.heatCount > 0
  const allPublished =
    hasCoreSchedule &&
    schedule.publishedWorkoutCount === schedule.workoutCount &&
    schedule.scheduledHeatCount === schedule.heatCount &&
    schedule.publishedHeatCount === schedule.heatCount
  const status = !hasCoreSchedule
    ? "blocked"
    : allPublished
      ? "complete"
      : "in_progress"

  return createBaseStep({
    key: "schedule_publish",
    label: "Schedule publish",
    status,
    summary: `${schedule.publishedWorkoutCount}/${schedule.workoutCount} workouts, ${schedule.publishedHeatCount}/${schedule.heatCount} heat schedules published`,
    details: [
      `${schedule.scheduledHeatCount}/${schedule.heatCount} heats scheduled.`,
      `${schedule.publishedHeatCount}/${schedule.heatCount} heat schedules published.`,
    ],
    action: { label: "Open schedule", to: "/events/$eventId/schedule" },
  })
}

function buildRemindersStep(
  input: BuildCrewGuidedSetupInput,
): CrewGuidedSetupStep {
  const { shifts } = input.facts
  const operational = shifts.confirmationOperationalSummary
  const confirmations = shifts.confirmationSummary
  const notSent = operational.missing + operational.pending
  const responseIssues =
    notSent +
    operational.sent +
    confirmations.declined +
    confirmations.changeRequested +
    confirmations.noShow +
    operational.replaced
  const status =
    shifts.assignedSlots === 0
      ? "blocked"
      : responseIssues === 0
        ? "complete"
        : "in_progress"

  return createBaseStep({
    key: "reminders",
    label: "Reminders",
    status,
    summary: `${confirmations.confirmed}/${shifts.assignedSlots} assignments confirmed`,
    details: [
      `${notSent} assignment${plural(notSent)} not sent.`,
      `${operational.sent} sent confirmation${plural(operational.sent)} awaiting response.`,
      `${confirmations.declined + confirmations.changeRequested + confirmations.noShow} response issue${plural(confirmations.declined + confirmations.changeRequested + confirmations.noShow)}.`,
    ],
    action: { label: "Review shifts", to: "/events/$eventId/shifts" },
  })
}

function buildExportsStep(
  input: BuildCrewGuidedSetupInput,
): CrewGuidedSetupStep {
  const readinessSummary = input.readiness.summary
  const status = mapReadinessSummaryToSetupStatus(readinessSummary)

  return createBaseStep({
    key: "exports",
    label: "Exports",
    status,
    summary: `${readinessSummary.ready}/${readinessSummary.total} readiness checks ready`,
    details: [
      `${readinessSummary.blocked} blocked readiness check${plural(readinessSummary.blocked)}.`,
      `${readinessSummary.needsAttention} readiness check${plural(readinessSummary.needsAttention)} needs attention.`,
      `${input.facts.judge.activeVersionCount} active judge assignment version${plural(input.facts.judge.activeVersionCount)}.`,
    ],
    action: { label: "Open exports", to: "/events/$eventId/exports" },
  })
}

function createBaseStep(
  step: Pick<
    CrewGuidedSetupStep,
    "key" | "label" | "summary" | "details" | "action" | "status"
  >,
): CrewGuidedSetupStep {
  return {
    ...step,
    systemStatus: step.status,
    operatorStatus: null,
    note: "",
    updatedAt: null,
  }
}

function applyPersistedStep(
  step: CrewGuidedSetupStep,
  persisted: CrewGuidedSetupPersistedStep | undefined,
): CrewGuidedSetupStep {
  if (!persisted) return step

  const operatorStatus = persisted.status ?? null
  return {
    ...step,
    status:
      step.systemStatus === "blocked"
        ? "blocked"
        : (operatorStatus ?? step.systemStatus),
    operatorStatus,
    note: persisted.note,
    updatedAt: persisted.updatedAt,
  }
}

function summarizeGuidedSetupSteps(
  steps: CrewGuidedSetupStep[],
): CrewGuidedSetupSummary {
  const complete = steps.filter((step) => step.status === "complete").length
  const inProgress = steps.filter(
    (step) => step.status === "in_progress",
  ).length
  const blocked = steps.filter((step) => step.status === "blocked").length
  const notStarted = steps.filter(
    (step) => step.status === "not_started",
  ).length
  const total = steps.length

  return {
    total,
    complete,
    inProgress,
    blocked,
    notStarted,
    progressPercent: total === 0 ? 0 : Math.round((complete / total) * 100),
    highestStatus:
      blocked > 0
        ? "blocked"
        : inProgress > 0
          ? "in_progress"
          : notStarted > 0
            ? "not_started"
            : "complete",
  }
}

function mapReadinessSummaryToSetupStatus(
  summary: CrewReadinessSummary,
): CrewGuidedSetupStatus {
  if (summary.blocked > 0) return "blocked"
  if (summary.needsAttention > 0) return "in_progress"
  return "complete"
}

function readPersistedGuidedSetup(
  value: unknown,
): CrewGuidedSetupPersistedState {
  if (!isPlainObject(value)) return { ...defaultGuidedSetupState }

  const activeStep = isCrewGuidedSetupStepKey(value.activeStep)
    ? value.activeStep
    : null
  const rawSteps = isPlainObject(value.steps) ? value.steps : {}
  const steps: CrewGuidedSetupPersistedState["steps"] = {}

  for (const stepKey of crewGuidedSetupStepKeys) {
    const rawStep = rawSteps[stepKey]
    if (!isPlainObject(rawStep)) continue

    const status = isCrewGuidedSetupStatus(rawStep.status)
      ? rawStep.status
      : undefined
    const note = typeof rawStep.note === "string" ? rawStep.note : ""
    const updatedAt =
      typeof rawStep.updatedAt === "string" ? rawStep.updatedAt : null

    if (status || note || updatedAt) {
      steps[stepKey] = { status, note, updatedAt }
    }
  }

  return { activeStep, steps }
}

function normalizePersistedGuidedSetup(
  state: CrewGuidedSetupPersistedState,
): CrewGuidedSetupPersistedState {
  return readPersistedGuidedSetup(state)
}

function isCrewGuidedSetupStepKey(
  value: unknown,
): value is CrewGuidedSetupStepKey {
  return (
    typeof value === "string" &&
    crewGuidedSetupStepKeys.includes(value as CrewGuidedSetupStepKey)
  )
}

function isCrewGuidedSetupStatus(
  value: unknown,
): value is CrewGuidedSetupStatus {
  return (
    value === "not_started" ||
    value === "in_progress" ||
    value === "blocked" ||
    value === "complete"
  )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function plural(count: number) {
  return count === 1 ? "" : "s"
}
