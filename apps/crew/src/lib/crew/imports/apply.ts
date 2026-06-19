// @lat: [[crew#Import Apply#Confirmed Mutation]]
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_INVITE_SOURCE,
  VOLUNTEER_ROLE_LABELS,
  VOLUNTEER_ROLE_TYPES,
  type VolunteerAvailability,
  type VolunteerMembershipMetadata,
  type VolunteerRoleType,
} from "../../../db/schemas/volunteers"
import { parseTimeInTimezone } from "../../../utils/timezone-utils"
import type {
  HeatScheduleImportRow,
  ImportIssue,
  PreviewImportRow,
  VolunteerImportRow,
} from "./types"

export type CrewApplyAction = "create" | "update" | "skip" | "error"

export interface CrewApplySummary {
  createdCount: number
  updatedCount: number
  skippedCount: number
  errorRowCount: number
  warningCount: number
  errorCount: number
}

export interface ExistingVolunteerInvitation {
  id: string
  email: string
  acceptedAt?: Date | null
  status?: string | null
}

export interface ExistingVolunteerMembership {
  id: string
  email: string
  isActive?: boolean | null
}

export interface VolunteerApplyRowPlan {
  rowNumber: number
  action: CrewApplyAction
  targetType: "team_invitation" | "team_membership" | null
  targetId: string | null
  email: string
  metadata: string | null
  warnings: ImportIssue[]
  errors: ImportIssue[]
  operation:
    | "create_invitation"
    | "update_invitation"
    | "update_membership"
    | "skip"
    | "error"
}

export interface VolunteerApplyPlan {
  rows: VolunteerApplyRowPlan[]
  summary: CrewApplySummary
}

export interface HeatApplyTrackWorkout {
  id: string
  label: string
  trackOrder: number
}

export interface HeatApplyVenue {
  id: string
  name: string
}

export interface ExistingHeat {
  id: string
  trackWorkoutId: string
  heatNumber: number
  schedulePublishedAt?: Date | null
}

export interface HeatApplyContext {
  competitionStartDate: string
  timezone: string
  trackWorkouts: HeatApplyTrackWorkout[]
  divisions: Array<{ id: string; label: string }>
  venues: HeatApplyVenue[]
  existingHeats: ExistingHeat[]
}

export interface HeatApplyRowPlan {
  rowNumber: number
  action: CrewApplyAction
  targetType: "competition_heat" | null
  targetId: string | null
  trackWorkoutId: string | null
  heatNumber: number | null
  scheduledTime: Date | null
  venueId: string | null
  divisionId: string | null
  durationMinutes: number | null
  notes: string | null
  warnings: ImportIssue[]
  errors: ImportIssue[]
  operation: "create_heat" | "update_heat" | "skip" | "error"
}

export interface HeatApplyPlan {
  rows: HeatApplyRowPlan[]
  summary: CrewApplySummary
}

export interface HeatApplySupportTargets {
  trackWorkoutIds: Set<string>
  venueIds: Set<string>
}

const roleLabelToType = new Map<string, VolunteerRoleType>(
  Object.entries(VOLUNTEER_ROLE_LABELS).flatMap(([value, label]) => [
    [normalizeLookupValue(label), value as VolunteerRoleType],
    [normalizeLookupValue(value), value as VolunteerRoleType],
  ]),
)

roleLabelToType.set("headjudge", VOLUNTEER_ROLE_TYPES.HEAD_JUDGE)
roleLabelToType.set("lanejudge", VOLUNTEER_ROLE_TYPES.JUDGE)
roleLabelToType.set("lanejudges", VOLUNTEER_ROLE_TYPES.JUDGE)
roleLabelToType.set("scoring", VOLUNTEER_ROLE_TYPES.SCOREKEEPER)
roleLabelToType.set("scorekeeping", VOLUNTEER_ROLE_TYPES.SCOREKEEPER)
roleLabelToType.set("checkin", VOLUNTEER_ROLE_TYPES.CHECK_IN)

export function buildVolunteerApplyPlan(
  rows: PreviewImportRow[],
  context: {
    importId: string
    existingInvitations: ExistingVolunteerInvitation[]
    existingMemberships: ExistingVolunteerMembership[]
  },
): VolunteerApplyPlan {
  const invitationsByEmail = new Map(
    context.existingInvitations.map((invitation) => [
      normalizeEmail(invitation.email),
      invitation,
    ]),
  )
  const membershipsByEmail = new Map(
    context.existingMemberships.map((membership) => [
      normalizeEmail(membership.email),
      membership,
    ]),
  )
  const seenEmails = new Set<string>()

  const plannedRows = rows.map((row): VolunteerApplyRowPlan => {
    const volunteer = row.normalizedRow as VolunteerImportRow
    const email = normalizeEmail(volunteer.email)
    const warnings = cloneIssues(row.warnings)
    const errors = cloneIssues(row.errors)

    if (row.action === "error" || errors.length > 0) {
      return createVolunteerPlan(
        row.rowNumber,
        "error",
        email,
        warnings,
        errors,
      )
    }

    if (row.action === "skip") {
      return createVolunteerPlan(row.rowNumber, "skip", email, warnings, errors)
    }

    if (!email) {
      errors.push(
        createApplyIssue(
          row.rowNumber,
          "email",
          "missing_email",
          "Email is required to apply this volunteer.",
        ),
      )
      return createVolunteerPlan(
        row.rowNumber,
        "error",
        email,
        warnings,
        errors,
      )
    }

    if (seenEmails.has(email)) {
      warnings.push(
        createApplyIssue(
          row.rowNumber,
          "email",
          "duplicate_email_apply",
          "Email was already handled by another row in this apply run.",
        ),
      )
      return createVolunteerPlan(row.rowNumber, "skip", email, warnings, errors)
    }
    seenEmails.add(email)

    const metadata = buildVolunteerImportMetadata(volunteer, context.importId)
    const existingMembership = membershipsByEmail.get(email)
    if (existingMembership) {
      if (existingMembership.isActive === false) {
        warnings.push(
          createApplyIssue(
            row.rowNumber,
            "email",
            "inactive_existing_membership",
            "A matching inactive volunteer membership already exists.",
          ),
        )
        return createVolunteerPlan(
          row.rowNumber,
          "skip",
          email,
          warnings,
          errors,
        )
      }

      return {
        rowNumber: row.rowNumber,
        action: "update",
        targetType: "team_membership",
        targetId: existingMembership.id,
        email,
        metadata,
        warnings,
        errors,
        operation: "update_membership",
      }
    }

    const existingInvitation = invitationsByEmail.get(email)
    if (existingInvitation) {
      if (
        existingInvitation.acceptedAt ||
        existingInvitation.status === "accepted"
      ) {
        warnings.push(
          createApplyIssue(
            row.rowNumber,
            "email",
            "accepted_existing_invitation",
            "A matching accepted volunteer invitation already exists.",
          ),
        )
        return createVolunteerPlan(
          row.rowNumber,
          "skip",
          email,
          warnings,
          errors,
        )
      }

      return {
        rowNumber: row.rowNumber,
        action: "update",
        targetType: "team_invitation",
        targetId: existingInvitation.id,
        email,
        metadata,
        warnings,
        errors,
        operation: "update_invitation",
      }
    }

    return {
      rowNumber: row.rowNumber,
      action: "create",
      targetType: "team_invitation",
      targetId: null,
      email,
      metadata,
      warnings,
      errors,
      operation: "create_invitation",
    }
  })

  return { rows: plannedRows, summary: summarizeApplyRows(plannedRows) }
}

export function buildHeatScheduleApplyPlan(
  rows: PreviewImportRow[],
  context: HeatApplyContext,
): HeatApplyPlan {
  const trackWorkoutByLookup = buildTrackWorkoutLookup(context.trackWorkouts)
  const divisionByLookup = new Map(
    context.divisions.map((division) => [
      normalizeLookupValue(division.label),
      division,
    ]),
  )
  const venueByLookup = new Map(
    context.venues.map((venue) => [normalizeLookupValue(venue.name), venue]),
  )
  const existingHeatByKey = new Map(
    context.existingHeats.map((heat) => [
      heatKey(heat.trackWorkoutId, heat.heatNumber),
      heat,
    ]),
  )
  const seenHeatKeys = new Set<string>()

  const plannedRows = rows.map((row): HeatApplyRowPlan => {
    const heat = row.normalizedRow as HeatScheduleImportRow
    const warnings = cloneIssues(row.warnings)
    const errors = cloneIssues(row.errors)

    if (row.action === "error" || errors.length > 0) {
      return createHeatPlan(row.rowNumber, "error", warnings, errors)
    }

    if (row.action === "skip") {
      return createHeatPlan(row.rowNumber, "skip", warnings, errors)
    }

    const trackWorkout = trackWorkoutByLookup.get(
      normalizeLookupValue(heat.workout),
    )
    if (!trackWorkout) {
      errors.push(
        createApplyIssue(
          row.rowNumber,
          "workout",
          "unresolved_workout",
          "Workout could not be matched or created for this row.",
        ),
      )
    }

    if (heat.heatNumber === null) {
      errors.push(
        createApplyIssue(
          row.rowNumber,
          "heat",
          "unresolved_heat_number",
          "Heat number is required to apply this row.",
        ),
      )
    }

    const scheduledTime = parseImportedScheduledTime(
      heat.scheduledTime,
      context.competitionStartDate,
      context.timezone,
    )
    if (heat.scheduledTime && !scheduledTime) {
      errors.push(
        createApplyIssue(
          row.rowNumber,
          "scheduledTime",
          "invalid_scheduled_time",
          "Scheduled time could not be parsed in the event timezone.",
        ),
      )
    }

    const division = heat.division
      ? divisionByLookup.get(normalizeLookupValue(heat.division))
      : null
    if (heat.division && !division) {
      warnings.push(
        createApplyIssue(
          row.rowNumber,
          "division",
          "unmatched_division_for_apply",
          "Division was not matched, so this heat will remain mixed.",
        ),
      )
    }

    const venue = heat.venue
      ? venueByLookup.get(normalizeLookupValue(heat.venue))
      : null
    if (heat.venue && !venue) {
      warnings.push(
        createApplyIssue(
          row.rowNumber,
          "venue",
          "unmatched_venue_for_apply",
          "Venue was not matched, so this heat will not be assigned to a venue.",
        ),
      )
    }

    if (errors.length > 0 || !trackWorkout || heat.heatNumber === null) {
      return createHeatPlan(row.rowNumber, "error", warnings, errors)
    }

    const key = heatKey(trackWorkout.id, heat.heatNumber)
    if (seenHeatKeys.has(key)) {
      warnings.push(
        createApplyIssue(
          row.rowNumber,
          "heat",
          "duplicate_heat_apply",
          "This workout and heat number was already handled by another row in this apply run.",
        ),
      )
      return createHeatPlan(row.rowNumber, "skip", warnings, errors)
    }
    seenHeatKeys.add(key)

    const existingHeat = existingHeatByKey.get(key)
    if (existingHeat?.schedulePublishedAt) {
      warnings.push(
        createApplyIssue(
          row.rowNumber,
          "heat",
          "published_heat_not_updated",
          "A published heat already exists for this workout and heat number, so the import row was skipped.",
        ),
      )
      return createHeatPlan(row.rowNumber, "skip", warnings, errors)
    }

    return {
      rowNumber: row.rowNumber,
      action: existingHeat ? "update" : "create",
      targetType: "competition_heat",
      targetId: existingHeat?.id ?? null,
      trackWorkoutId: trackWorkout.id,
      heatNumber: heat.heatNumber,
      scheduledTime,
      venueId: venue?.id ?? null,
      divisionId: division?.id ?? null,
      durationMinutes: heat.durationMinutes,
      notes: heat.notes || null,
      warnings,
      errors,
      operation: existingHeat ? "update_heat" : "create_heat",
    }
  })

  return { rows: plannedRows, summary: summarizeApplyRows(plannedRows) }
}

export function buildTrackWorkoutLookup(
  trackWorkouts: HeatApplyTrackWorkout[],
) {
  return new Map(
    trackWorkouts.flatMap((workout) => [
      [normalizeLookupValue(workout.label), workout],
      [normalizeLookupValue(String(workout.trackOrder)), workout],
      [normalizeLookupValue(`event ${workout.trackOrder}`), workout],
      [normalizeLookupValue(`workout ${workout.trackOrder}`), workout],
    ]),
  )
}

export function getAppliedHeatSupportTargets(
  rows: HeatApplyRowPlan[],
): HeatApplySupportTargets {
  const trackWorkoutIds = new Set<string>()
  const venueIds = new Set<string>()

  for (const row of rows) {
    if (row.operation !== "create_heat" && row.operation !== "update_heat") {
      continue
    }

    if (row.trackWorkoutId) {
      trackWorkoutIds.add(row.trackWorkoutId)
    }

    if (row.venueId) {
      venueIds.add(row.venueId)
    }
  }

  return { trackWorkoutIds, venueIds }
}

export function mergeImportedJsonMetadata(
  existingMetadata: string | null | undefined,
  importedMetadata: string | null,
  options: { preserveExistingApprovedStatus?: boolean } = {},
) {
  if (!existingMetadata) return importedMetadata
  if (!importedMetadata) return existingMetadata

  try {
    const existing = JSON.parse(existingMetadata) as Record<string, unknown>
    const imported = JSON.parse(importedMetadata) as Record<string, unknown>
    const merged = { ...existing, ...imported }

    if (
      options.preserveExistingApprovedStatus &&
      existing.status === "approved"
    ) {
      merged.status = "approved"
    }

    return JSON.stringify(merged)
  } catch {
    return importedMetadata
  }
}

export function parseImportedScheduledTime(
  value: string,
  competitionStartDate: string,
  timezone: string,
) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const dateAndTime = splitImportedDateTime(trimmed, competitionStartDate)
  if (!dateAndTime) return null

  const time = normalizeImportedTime(dateAndTime.time)
  if (!time) return null

  return parseTimeInTimezone(time, dateAndTime.date, timezone)
}

export function normalizeLookupValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
}

function buildVolunteerImportMetadata(
  row: VolunteerImportRow,
  importId: string,
) {
  const displayName =
    row.name || [row.firstName, row.lastName].filter(Boolean).join(" ")
  const roleType = parseVolunteerRoleType(row.role)
  const availability = parseVolunteerAvailability(row.availability)
  const metadata: VolunteerMembershipMetadata & Record<string, unknown> = {
    volunteerRoleTypes: [roleType ?? VOLUNTEER_ROLE_TYPES.GENERAL],
    status: "pending",
    inviteSource: VOLUNTEER_INVITE_SOURCE.DIRECT,
    signupEmail: row.email,
    signupName: displayName || undefined,
    signupPhone: row.phone || undefined,
    availability,
    availabilityNotes: availability ? undefined : row.availability || undefined,
    internalNotes: buildVolunteerNotes(row),
    crewImportId: importId,
  }

  return JSON.stringify(removeUndefined(metadata))
}

function buildVolunteerNotes(row: VolunteerImportRow) {
  const parts = [
    row.notes,
    row.role ? `Imported role: ${row.role}` : "",
    row.division ? `Imported division: ${row.division}` : "",
  ].filter(Boolean)

  return parts.length > 0 ? parts.join("\n") : undefined
}

function parseVolunteerRoleType(value: string): VolunteerRoleType | null {
  if (!value) return null
  return roleLabelToType.get(normalizeLookupValue(value)) ?? null
}

function parseVolunteerAvailability(
  value: string,
): VolunteerAvailability | undefined {
  const normalized = normalizeLookupValue(value)
  if (!normalized) return undefined
  if (normalized === "morning" || normalized === "am") {
    return VOLUNTEER_AVAILABILITY.MORNING
  }
  if (normalized === "afternoon" || normalized === "pm") {
    return VOLUNTEER_AVAILABILITY.AFTERNOON
  }
  if (
    normalized === "allday" ||
    normalized === "full" ||
    normalized === "fullday"
  ) {
    return VOLUNTEER_AVAILABILITY.ALL_DAY
  }
  return undefined
}

function splitImportedDateTime(value: string, competitionStartDate: string) {
  const isoDateMatch = value.match(/^(\d{4}-\d{2}-\d{2})[ T]+(.+)$/)
  if (isoDateMatch) {
    return { date: isoDateMatch[1], time: isoDateMatch[2] }
  }

  const slashDateMatch = value.match(
    /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(.+)$/,
  )
  if (slashDateMatch) {
    const [, month, day, year, time] = slashDateMatch
    const competitionYear = competitionStartDate.slice(0, 4)
    const fullYear = year
      ? year.length === 2
        ? `20${year}`
        : year
      : competitionYear
    return {
      date: `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
      time,
    }
  }

  return { date: competitionStartDate, time: value }
}

function normalizeImportedTime(value: string) {
  const trimmed = value.trim().toLowerCase()
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2] ?? "0")
  const meridiem = match[3]?.replace(/\./g, "")

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    if (meridiem === "pm" && hours !== 12) hours += 12
    if (meridiem === "am" && hours === 12) hours = 0
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function summarizeApplyRows(
  rows: Array<{
    action: CrewApplyAction
    warnings: ImportIssue[]
    errors: ImportIssue[]
  }>,
): CrewApplySummary {
  return {
    createdCount: rows.filter((row) => row.action === "create").length,
    updatedCount: rows.filter((row) => row.action === "update").length,
    skippedCount: rows.filter((row) => row.action === "skip").length,
    errorRowCount: rows.filter((row) => row.action === "error").length,
    warningCount: rows.reduce((total, row) => total + row.warnings.length, 0),
    errorCount: rows.reduce((total, row) => total + row.errors.length, 0),
  }
}

function createVolunteerPlan(
  rowNumber: number,
  action: "skip" | "error",
  email: string,
  warnings: ImportIssue[],
  errors: ImportIssue[],
): VolunteerApplyRowPlan {
  return {
    rowNumber,
    action,
    targetType: null,
    targetId: null,
    email,
    metadata: null,
    warnings,
    errors,
    operation: action,
  }
}

function createHeatPlan(
  rowNumber: number,
  action: "skip" | "error",
  warnings: ImportIssue[],
  errors: ImportIssue[],
): HeatApplyRowPlan {
  return {
    rowNumber,
    action,
    targetType: null,
    targetId: null,
    trackWorkoutId: null,
    heatNumber: null,
    scheduledTime: null,
    venueId: null,
    divisionId: null,
    durationMinutes: null,
    notes: null,
    warnings,
    errors,
    operation: action,
  }
}

function createApplyIssue(
  rowNumber: number,
  field: string,
  code: string,
  message: string,
): ImportIssue {
  return {
    code,
    severity:
      code.startsWith("invalid") ||
      code.startsWith("missing") ||
      code.startsWith("unresolved")
        ? "error"
        : "warning",
    rowNumber,
    field,
    message,
  }
}

function cloneIssues(issues: ImportIssue[]) {
  return issues.map((issue) => ({ ...issue }))
}

function heatKey(trackWorkoutId: string, heatNumber: number) {
  return `${trackWorkoutId}:${heatNumber}`
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T
}
