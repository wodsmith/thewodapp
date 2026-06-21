// @lat: [[crew#Copy Prior Event Setup]]
import {
  parseCrewSettings,
  serializeCrewSettings,
  type CrewSetupState,
} from "../crew-event-setup"
import {
  formatDateTimeInTimezone,
  parseTimeInTimezone,
} from "../../utils/timezone-utils"

export type CrewCopyPriorEventApplyMode = "empty_target_only"

export type CrewCopyPriorEventCategory =
  | "venues"
  | "tracks"
  | "heats"
  | "shifts"
  | "setup_assumptions"
  | "judge_assignments"
  | "volunteer_identity"
  | "imports"
  | "payments"
  | "messages"

export type CrewCopyPriorEventPreviewStatus = "copy" | "skip" | "deny"

export interface CrewCopyPriorEventSummary {
  category: CrewCopyPriorEventCategory
  label: string
  status: CrewCopyPriorEventPreviewStatus
  count: number
  reason: string
}

export interface CrewCopyPriorEventCandidate {
  id: string
  name: string
  organizingTeamId: string
  startDate: string | null
  endDate: string | null
  timezone: string
  lifecycle: string
}

export interface CrewCopyPriorEventSettingsPreview {
  willCopyAssumptions: boolean
  sourceAssumptions: string
  targetHasAssumptions: boolean
}

export interface CrewCopyPriorEventEventSnapshot {
  id: string
  name: string
  organizingTeamId: string
  startDate: string | null
  endDate: string | null
  timezone: string
  settingsText: string | null
}

export interface CrewCopyPriorEventSourceVenue {
  id: string
  name: string
  laneCount: number
  transitionMinutes: number
  sortOrder: number
}

export interface CrewCopyPriorEventSourceTrack {
  id: string
  name: string
  description: string | null
  type: string
  scalingGroupId: string | null
  isPublic: number
}

export interface CrewCopyPriorEventSourceTrackWorkout {
  id: string
  trackId: string
  workoutId: string
  workoutName: string
  workoutDescription: string
  workoutScope: string
  workoutScheme: string
  workoutScoreType: string | null
  workoutRepsPerRound: number | null
  workoutRoundsToScore: number | null
  workoutTiebreakScheme: string | null
  workoutTimeCap: number | null
  workoutScalingGroupId: string | null
  parentEventId: string | null
  trackOrder: number
  notes: string | null
  pointsMultiplier: number | null
  defaultHeatsCount: number | null
  defaultLaneShiftPattern: string | null
  minHeatBuffer: number | null
}

export interface CrewCopyPriorEventSourceHeat {
  id: string
  trackWorkoutId: string
  venueId: string | null
  heatNumber: number
  scheduledTime: Date | string | null
  durationMinutes: number | null
  notes: string | null
}

export interface CrewCopyPriorEventSourceShift {
  id: string
  name: string
  roleType: string
  startTime: Date | string
  endTime: Date | string
  location: string | null
  capacity: number
  notes: string | null
}

export interface CrewCopyPriorEventExistingCounts {
  venues: number
  tracks: number
  heats: number
  shifts: number
}

export interface CrewCopyPriorEventDeniedCounts {
  volunteerIdentities: number
  judgeAssignments: number
  imports: number
  payments: number
  messages: number
}

export interface CrewCopyPriorEventPlanInput {
  mode: CrewCopyPriorEventApplyMode
  sourceEvent: CrewCopyPriorEventEventSnapshot
  targetEvent: CrewCopyPriorEventEventSnapshot
  source: {
    venues: CrewCopyPriorEventSourceVenue[]
    tracks: CrewCopyPriorEventSourceTrack[]
    trackWorkouts: CrewCopyPriorEventSourceTrackWorkout[]
    heats: CrewCopyPriorEventSourceHeat[]
    shifts: CrewCopyPriorEventSourceShift[]
    deniedCounts: CrewCopyPriorEventDeniedCounts
  }
  targetExistingCounts: CrewCopyPriorEventExistingCounts
}

export interface CrewCopyPriorEventVenuePlan
  extends CrewCopyPriorEventSourceVenue {
  sourceVenueId: string
}

export interface CrewCopyPriorEventTrackPlan
  extends CrewCopyPriorEventSourceTrack {
  sourceTrackId: string
}

export interface CrewCopyPriorEventTrackWorkoutPlan
  extends CrewCopyPriorEventSourceTrackWorkout {
  sourceTrackWorkoutId: string
  sourceParentEventId: string | null
}

export interface CrewCopyPriorEventHeatPlan
  extends Omit<CrewCopyPriorEventSourceHeat, "scheduledTime"> {
  sourceHeatId: string
  sourceVenueId: string | null
  sourceTrackWorkoutId: string
  scheduledTime: Date | null
}

export interface CrewCopyPriorEventShiftPlan
  extends Omit<CrewCopyPriorEventSourceShift, "startTime" | "endTime"> {
  sourceShiftId: string
  startTime: Date | null
  endTime: Date | null
}

export interface CrewCopyPriorEventApplyPlan {
  mode: CrewCopyPriorEventApplyMode
  sourceEventId: string
  targetEventId: string
  dateShiftDays: number | null
  venuesToCreate: CrewCopyPriorEventVenuePlan[]
  tracksToCreate: CrewCopyPriorEventTrackPlan[]
  trackWorkoutsToCreate: CrewCopyPriorEventTrackWorkoutPlan[]
  heatsToCreate: CrewCopyPriorEventHeatPlan[]
  shiftsToCreate: CrewCopyPriorEventShiftPlan[]
  assumptionsToWrite: string | null
}

export interface CrewCopyPriorEventPreview {
  mode: CrewCopyPriorEventApplyMode
  sourceEvent: CrewCopyPriorEventCandidate
  targetEvent: CrewCopyPriorEventCandidate
  dateShiftDays: number | null
  settings: CrewCopyPriorEventSettingsPreview
  summary: CrewCopyPriorEventSummary[]
  plan: CrewCopyPriorEventApplyPlan
  canApply: boolean
}

export function filterEligibleCrewCopyPriorEvents(
  targetEvent: CrewCopyPriorEventCandidate,
  candidates: CrewCopyPriorEventCandidate[],
) {
  return candidates
    .filter((candidate) => {
      if (candidate.id === targetEvent.id) return false
      if (candidate.organizingTeamId !== targetEvent.organizingTeamId) {
        return false
      }
      if (candidate.lifecycle === "archived") return false
      if (targetEvent.startDate && candidate.startDate) {
        return candidate.startDate < targetEvent.startDate
      }
      return true
    })
    .sort((left, right) => {
      const dateCompare = compareNullableDateDesc(
        left.startDate,
        right.startDate,
      )
      return dateCompare || left.name.localeCompare(right.name)
    })
}

export function buildCrewCopyPriorEventPreview(
  input: CrewCopyPriorEventPlanInput,
): CrewCopyPriorEventPreview {
  const plan = buildCrewCopyPriorEventApplyPlan(input)
  const sourceSettings = parseCrewSettings(input.sourceEvent.settingsText)
  const targetSettings = parseCrewSettings(input.targetEvent.settingsText)
  const targetHasAssumptions =
    targetSettings.setup.assumptions.trim().length > 0
  const sourceAssumptions = sourceSettings.setup.assumptions.trim()
  const summary = buildSummary(input, plan, {
    sourceAssumptions,
    targetHasAssumptions,
  })

  return {
    mode: input.mode,
    sourceEvent: eventToCandidate(input.sourceEvent, "source"),
    targetEvent: eventToCandidate(input.targetEvent, "target"),
    dateShiftDays: plan.dateShiftDays,
    settings: {
      willCopyAssumptions: plan.assumptionsToWrite !== null,
      sourceAssumptions,
      targetHasAssumptions,
    },
    summary,
    plan,
    canApply: summary.some((item) => item.status === "copy" && item.count > 0),
  }
}

export function buildCrewCopyPriorEventApplyPlan(
  input: CrewCopyPriorEventPlanInput,
): CrewCopyPriorEventApplyPlan {
  const dateShiftDays = diffDateStrings(
    input.sourceEvent.startDate,
    input.targetEvent.startDate,
  )
  const sourceSettings = parseCrewSettings(input.sourceEvent.settingsText)
  const targetSettings = parseCrewSettings(input.targetEvent.settingsText)
  const canCopyVenues = input.targetExistingCounts.venues === 0
  const canCopyTracks = input.targetExistingCounts.tracks === 0
  const canCopyHeats =
    input.targetExistingCounts.heats === 0 && canCopyTracks && canCopyVenues
  const canCopyShifts = input.targetExistingCounts.shifts === 0
  const copiedSourceTrackIds = new Set(
    input.source.trackWorkouts.map((trackWorkout) => trackWorkout.trackId),
  )

  return {
    mode: input.mode,
    sourceEventId: input.sourceEvent.id,
    targetEventId: input.targetEvent.id,
    dateShiftDays,
    venuesToCreate: canCopyVenues
      ? input.source.venues.map((venue) => ({
          ...venue,
          sourceVenueId: venue.id,
        }))
      : [],
    tracksToCreate: canCopyTracks
      ? input.source.tracks
          .filter((track) => copiedSourceTrackIds.has(track.id))
          .map((track) => ({
            ...track,
            sourceTrackId: track.id,
          }))
      : [],
    trackWorkoutsToCreate: canCopyTracks
      ? input.source.trackWorkouts.map((trackWorkout) => ({
          ...trackWorkout,
          sourceTrackWorkoutId: trackWorkout.id,
          sourceParentEventId: trackWorkout.parentEventId,
        }))
      : [],
    heatsToCreate: canCopyHeats
      ? input.source.heats.map((heat) => ({
          ...heat,
          sourceHeatId: heat.id,
          sourceVenueId: heat.venueId,
          sourceTrackWorkoutId: heat.trackWorkoutId,
          scheduledTime: shiftDateTimeBetweenEvents({
            value: heat.scheduledTime,
            sourceEvent: input.sourceEvent,
            targetEvent: input.targetEvent,
          }),
        }))
      : [],
    shiftsToCreate: canCopyShifts
      ? input.source.shifts.map((shift) => ({
          ...shift,
          sourceShiftId: shift.id,
          startTime: shiftDateTimeBetweenEvents({
            value: shift.startTime,
            sourceEvent: input.sourceEvent,
            targetEvent: input.targetEvent,
          }),
          endTime: shiftDateTimeBetweenEvents({
            value: shift.endTime,
            sourceEvent: input.sourceEvent,
            targetEvent: input.targetEvent,
          }),
        }))
      : [],
    assumptionsToWrite:
      targetSettings.setup.assumptions.trim().length === 0
        ? sourceSettings.setup.assumptions.trim() || null
        : null,
  }
}

export function serializeCrewCopyPriorEventSettings(
  settingsText: string | null,
  input: {
    sourceEventId: string
    sourceEventName: string
    appliedAt: string
    mode: CrewCopyPriorEventApplyMode
    assumptionsToWrite: string | null
    counts: {
      venues: number
      tracks: number
      trackWorkouts: number
      heats: number
      shifts: number
    }
  },
) {
  const parsed = parseCrewSettings(settingsText)
  const setup: CrewSetupState = input.assumptionsToWrite
    ? {
        ...parsed.setup,
        assumptions: input.assumptionsToWrite,
        checklist: {
          ...parsed.setup.checklist,
          staffingPlanDrafted: true,
        },
      }
    : parsed.setup
  const serialized = JSON.parse(
    serializeCrewSettings(settingsText, setup),
  ) as Record<string, unknown> | null

  return JSON.stringify(
    {
      ...(serialized ?? {}),
      copyPriorEvent: {
        sourceEventId: input.sourceEventId,
        sourceEventName: input.sourceEventName,
        appliedAt: input.appliedAt,
        mode: input.mode,
        counts: input.counts,
      },
    },
    null,
    2,
  )
}

export function shiftDateTimeBetweenEvents(input: {
  value: Date | string | null
  sourceEvent: Pick<CrewCopyPriorEventEventSnapshot, "startDate" | "timezone">
  targetEvent: Pick<CrewCopyPriorEventEventSnapshot, "startDate" | "timezone">
}) {
  const value = toDate(input.value)
  if (!value || !input.sourceEvent.startDate || !input.targetEvent.startDate) {
    return null
  }

  const sourceLocalDate = formatDateTimeInTimezone(
    value,
    input.sourceEvent.timezone,
    "yyyy-MM-dd",
  )
  const sourceLocalTime = formatDateTimeInTimezone(
    value,
    input.sourceEvent.timezone,
    "HH:mm",
  )
  const dayOffset = diffDateStrings(
    input.sourceEvent.startDate,
    sourceLocalDate,
  )
  const targetLocalDate =
    dayOffset === null
      ? null
      : addDaysToDateString(input.targetEvent.startDate, dayOffset)

  return parseTimeInTimezone(
    sourceLocalTime,
    targetLocalDate,
    input.targetEvent.timezone,
  )
}

function buildSummary(
  input: CrewCopyPriorEventPlanInput,
  plan: CrewCopyPriorEventApplyPlan,
  settings: {
    sourceAssumptions: string
    targetHasAssumptions: boolean
  },
): CrewCopyPriorEventSummary[] {
  return [
    structuralSummary({
      category: "venues",
      label: "Venues and floors",
      sourceCount: input.source.venues.length,
      copiedCount: plan.venuesToCreate.length,
      targetCount: input.targetExistingCounts.venues,
    }),
    structuralSummary({
      category: "tracks",
      label: "Workout/event structure",
      sourceCount: input.source.trackWorkouts.length,
      copiedCount: plan.trackWorkoutsToCreate.length,
      targetCount: input.targetExistingCounts.tracks,
    }),
    structuralSummary({
      category: "heats",
      label: "Heat schedule shell",
      sourceCount: input.source.heats.length,
      copiedCount: plan.heatsToCreate.length,
      targetCount: input.targetExistingCounts.heats,
      blockedBy:
        input.targetExistingCounts.venues > 0 ||
        input.targetExistingCounts.tracks > 0
          ? "Target already has venue or event structure, so heat rows are not merged."
          : undefined,
    }),
    structuralSummary({
      category: "shifts",
      label: "Shift templates",
      sourceCount: input.source.shifts.length,
      copiedCount: plan.shiftsToCreate.length,
      targetCount: input.targetExistingCounts.shifts,
    }),
    {
      category: "setup_assumptions",
      label: "Setup assumptions",
      status: plan.assumptionsToWrite ? "copy" : "skip",
      count: plan.assumptionsToWrite ? 1 : 0,
      reason: plan.assumptionsToWrite
        ? "Target assumptions are empty, so source setup assumptions will be copied."
        : settings.sourceAssumptions.length === 0
          ? "Source event has no setup assumptions to copy."
          : settings.targetHasAssumptions
            ? "Target setup assumptions are already filled and will not be overwritten."
            : "No setup assumptions will be copied.",
    },
    deniedSummary(
      "volunteer_identity",
      "Volunteer identity and roster data",
      input.source.deniedCounts.volunteerIdentities,
    ),
    deniedSummary(
      "judge_assignments",
      "Judge rotations and assignments",
      input.source.deniedCounts.judgeAssignments,
    ),
    deniedSummary(
      "imports",
      "Import history and payloads",
      input.source.deniedCounts.imports,
    ),
    deniedSummary(
      "payments",
      "Registrations and payments",
      input.source.deniedCounts.payments,
    ),
    deniedSummary(
      "messages",
      "Broadcasts, reminders, and queues",
      input.source.deniedCounts.messages,
    ),
  ]
}

function structuralSummary(input: {
  category: CrewCopyPriorEventCategory
  label: string
  sourceCount: number
  copiedCount: number
  targetCount: number
  blockedBy?: string
}): CrewCopyPriorEventSummary {
  if (input.copiedCount > 0) {
    return {
      category: input.category,
      label: input.label,
      status: "copy",
      count: input.copiedCount,
      reason: "Target has no existing rows in this category.",
    }
  }
  if (input.sourceCount === 0) {
    return {
      category: input.category,
      label: input.label,
      status: "skip",
      count: 0,
      reason: "Source event has no rows in this category.",
    }
  }
  return {
    category: input.category,
    label: input.label,
    status: "skip",
    count: input.sourceCount,
    reason:
      input.blockedBy ??
      `Target already has ${input.targetCount} row${input.targetCount === 1 ? "" : "s"} in this category.`,
  }
}

function deniedSummary(
  category: CrewCopyPriorEventCategory,
  label: string,
  count: number,
): CrewCopyPriorEventSummary {
  return {
    category,
    label,
    status: "deny",
    count,
    reason:
      count > 0
        ? "Explicitly excluded from copy-prior-event setup."
        : "Excluded by policy; no source rows found.",
  }
}

function eventToCandidate(
  event: CrewCopyPriorEventEventSnapshot,
  fallbackName: string,
): CrewCopyPriorEventCandidate {
  return {
    id: event.id,
    name: event.name || fallbackName,
    organizingTeamId: event.organizingTeamId,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    lifecycle: "setup",
  }
}

function diffDateStrings(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const leftDate = dateStringToUtcDay(left)
  const rightDate = dateStringToUtcDay(right)
  if (leftDate === null || rightDate === null) return null
  return Math.round((rightDate - leftDate) / 86_400_000)
}

function addDaysToDateString(date: string | null | undefined, days: number) {
  const parsed = parseDateParts(date)
  if (!parsed) return null
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return formatDateTimeInTimezone(shifted, "UTC", "yyyy-MM-dd")
}

function dateStringToUtcDay(date: string | null | undefined) {
  const parsed = parseDateParts(date)
  if (!parsed) return null
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day)
}

function parseDateParts(date: string | null | undefined) {
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const check = new Date(Date.UTC(year, month - 1, day))
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

function toDate(value: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function compareNullableDateDesc(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  if (left && right) return right.localeCompare(left)
  if (left) return -1
  if (right) return 1
  return 0
}
