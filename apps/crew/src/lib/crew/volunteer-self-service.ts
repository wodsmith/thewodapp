// @lat: [[crew#Volunteer Self Service]]
import type { CrewAssignmentConfirmationStatus } from "../../db/schemas/crew-imports"
import type {
  VolunteerAvailability,
  VolunteerRoleType,
} from "../../db/schemas/volunteers"
import {
  normalizeCrewRosterVolunteerEmail,
  parseCrewRosterMetadata,
  type CrewRosterMetadata,
} from "./roster-shifts"

export interface CrewVolunteerSelfServiceConfirmation {
  id: string
  status: CrewAssignmentConfirmationStatus
  sentAt: Date | string | null
  respondedAt: Date | string | null
  expiresAt: Date | string | null
  responseNote: string | null
}

export interface CrewVolunteerSelfServiceAssignmentRecord {
  id: string
  // Canonical assignee id (membership id, or invitation id for imported /
  // manual volunteers without an account).
  assigneeId: string
  shiftId: string
  name: string
  roleType: VolunteerRoleType
  roleLabel: string
  startTime: Date | string
  endTime: Date | string
  location: string | null
  notes: string | null
  confirmation: CrewVolunteerSelfServiceConfirmation | null
}

export interface CrewVolunteerSelfServiceScheduleItem
  extends Omit<
    CrewVolunteerSelfServiceAssignmentRecord,
    "assigneeId" | "startTime" | "endTime"
  > {
  startTime: Date
  endTime: Date
  isTokenAssignment: boolean
}

export interface CrewVolunteerSelfServiceContactInput {
  email: string
  name?: string
  phone?: string
  availability?: VolunteerAvailability
  availabilityNotes?: string
  credentials?: string
}

export function buildCrewVolunteerSelfServiceSchedule({
  assignments,
  assigneeId,
  tokenAssignmentId,
}: {
  assignments: CrewVolunteerSelfServiceAssignmentRecord[]
  assigneeId: string
  tokenAssignmentId: string
}): CrewVolunteerSelfServiceScheduleItem[] {
  const byAssignmentId = new Map<string, CrewVolunteerSelfServiceScheduleItem>()

  for (const assignment of assignments) {
    if (assignment.assigneeId !== assigneeId) continue
    if (byAssignmentId.has(assignment.id)) continue

    const startTime = toValidDate(assignment.startTime)
    const endTime = toValidDate(assignment.endTime)
    if (!startTime || !endTime) continue

    byAssignmentId.set(assignment.id, {
      id: assignment.id,
      shiftId: assignment.shiftId,
      name: assignment.name,
      roleType: assignment.roleType,
      roleLabel: assignment.roleLabel,
      startTime,
      endTime,
      location: assignment.location,
      notes: assignment.notes,
      confirmation: assignment.confirmation,
      isTokenAssignment: assignment.id === tokenAssignmentId,
    })
  }

  return [...byAssignmentId.values()].sort((a, b) => {
    const timeDiff = a.startTime.getTime() - b.startTime.getTime()
    if (timeDiff !== 0) return timeDiff
    return a.name.localeCompare(b.name)
  })
}

export function resolveCrewVolunteerSelfServiceContactUpdate(
  existingMetadata: string | null | undefined,
  input: CrewVolunteerSelfServiceContactInput,
) {
  const existing = removeUndefined(parseCrewRosterMetadata(existingMetadata))
  const next: CrewRosterMetadata = removeUndefined({
    ...existing,
    signupEmail: normalizeCrewRosterVolunteerEmail(input.email),
    signupName: emptyToUndefined(input.name),
    signupPhone: emptyToUndefined(input.phone),
    availability: input.availability,
    availabilityNotes: emptyToUndefined(input.availabilityNotes),
    credentials: emptyToUndefined(input.credentials),
  })

  return {
    metadata: next,
    changed: JSON.stringify(existing) !== JSON.stringify(next),
  }
}

export function buildCrewVolunteerSelfServiceIcs(params: {
  eventName: string
  assignments: CrewVolunteerSelfServiceScheduleItem[]
  generatedAt?: Date
}) {
  const generatedAt =
    params.generatedAt ?? params.assignments[0]?.startTime ?? new Date(0)
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WODsmith//Crew//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(`${params.eventName} Crew Schedule`)}`,
  ]

  for (const assignment of params.assignments) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(`${assignment.id}@crew.wodsmith.com`)}`,
      `DTSTAMP:${formatIcsDate(generatedAt)}`,
      `DTSTART:${formatIcsDate(assignment.startTime)}`,
      `DTEND:${formatIcsDate(assignment.endTime)}`,
      `SUMMARY:${escapeIcsText(`${params.eventName}: ${assignment.name}`)}`,
    )
    if (assignment.location) {
      lines.push(`LOCATION:${escapeIcsText(assignment.location)}`)
    }
    lines.push(
      `DESCRIPTION:${escapeIcsText(
        [
          `Role: ${assignment.roleLabel}`,
          assignment.notes ? `Notes: ${assignment.notes}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      )}`,
      "END:VEVENT",
    )
  }

  lines.push("END:VCALENDAR")
  return `${lines.join("\r\n")}\r\n`
}

export function buildCrewVolunteerSelfServiceGoogleCalendarUrl(params: {
  eventName: string
  assignment: CrewVolunteerSelfServiceScheduleItem
}) {
  const searchParams = new URLSearchParams({
    action: "TEMPLATE",
    text: `${params.eventName}: ${params.assignment.name}`,
    dates: `${formatGoogleCalendarDate(
      params.assignment.startTime,
    )}/${formatGoogleCalendarDate(params.assignment.endTime)}`,
    details: [
      `Role: ${params.assignment.roleLabel}`,
      params.assignment.notes ? `Notes: ${params.assignment.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  })

  if (params.assignment.location) {
    searchParams.set("location", params.assignment.location)
  }

  return `https://calendar.google.com/calendar/render?${searchParams.toString()}`
}

export function buildCrewVolunteerSelfServiceIcsFilename(eventName: string) {
  const slug = eventName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `${slug || "crew"}-schedule.ics`
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatIcsDate(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

function formatGoogleCalendarDate(date: Date) {
  return formatIcsDate(date)
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

function emptyToUndefined(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function removeUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T
}
