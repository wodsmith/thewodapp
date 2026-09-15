// @lat: [[crew#Published Volunteer Schedule]]
import { z } from "zod"
import { VOLUNTEER_ROLE_LABELS } from "../../db/schemas/volunteers"
import type { CrewStaffingMatrixInput } from "./staffing"

const isoDate = z.string().datetime()
const publicAssignmentSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(["shift", "judge"]),
  title: z.string().max(500),
  roleLabel: z.string().max(100),
  startTime: isoDate.nullable(),
  endTime: isoDate.nullable(),
  location: z.string().max(500).nullable(),
  heatNumber: z.number().int().nonnegative().nullable(),
  laneNumber: z.number().int().nonnegative().nullable(),
})

// Parse every persisted snapshot through this allowlist before public delivery.
// In particular, never return roster records or confirmation/token objects.
export const crewPublishedScheduleSchema = z.object({
  version: z.literal(1),
  publishedAt: isoDate,
  event: z.object({
    name: z.string().min(1).max(500),
    slug: z.string().min(1).max(255),
    timezone: z.string().min(1).max(100),
    startDate: z.string().max(30).nullable(),
    endDate: z.string().max(30).nullable(),
  }),
  volunteers: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        name: z.string().min(1).max(500),
        assignments: z.array(publicAssignmentSchema).max(10000),
      }),
    )
    .max(5000),
})

export type CrewPublishedSchedule = z.infer<typeof crewPublishedScheduleSchema>
export type CrewPublishedScheduleAssignment = z.infer<
  typeof publicAssignmentSchema
>

export function buildCrewPublishedSchedule(params: {
  event: {
    name: string
    slug: string
    timezone: string | null
    startDate: string | null
    endDate: string | null
  }
  input: CrewStaffingMatrixInput
  publishedAt: Date
  publicId: (sourceId: string) => string
}): CrewPublishedSchedule {
  const { input, publicId } = params
  const inactiveAssignees = new Set(
    (input.roster ?? [])
      .filter((person) => person.isActive === false)
      .map((person) => person.membershipId),
  )
  const volunteers = new Map(
    (input.roster ?? [])
      .filter((person) => !inactiveAssignees.has(person.membershipId))
      .map((person) => [
        person.membershipId,
        {
          id: publicId(`person:${person.membershipId}`),
          // Older roster hydration may fall back to the email for an unnamed person.
          name: publicVolunteerName(person.name, person.email),
          assignments: [] as CrewPublishedScheduleAssignment[],
        },
      ]),
  )
  const addAssignment = (
    assigneeId: string,
    assignment: CrewPublishedScheduleAssignment,
  ) => {
    if (inactiveAssignees.has(assigneeId)) return
    const volunteer = volunteers.get(assigneeId)
    if (!volunteer) {
      throw new Error(
        "A scheduled volunteer is missing from the roster. Review the assignments before publishing.",
      )
    }
    volunteer.assignments.push(assignment)
  }

  for (const shift of input.shifts ?? []) {
    for (const assignment of shift.assignments) {
      if (isInactiveDuty(assignment.confirmation?.status)) continue
      addAssignment(assignment.membershipId, {
        id: publicId(`shift:${assignment.id}`),
        kind: "shift",
        title: shift.name,
        roleLabel: VOLUNTEER_ROLE_LABELS[shift.roleType] ?? "Volunteer",
        startTime: toIso(shift.startTime),
        endTime: toIso(shift.endTime),
        location: shift.location ?? null,
        heatNumber: null,
        laneNumber: null,
      })
    }
  }

  const heats = new Map((input.heats ?? []).map((heat) => [heat.id, heat]))
  const workouts = new Map(
    (input.workouts ?? []).map((workout) => [workout.id, workout]),
  )
  const venues = new Map((input.venues ?? []).map((venue) => [venue.id, venue]))
  for (const assignment of input.judgeAssignments ?? []) {
    if (isInactiveDuty(assignment.confirmation?.status)) continue
    const heat = heats.get(assignment.heatId)
    if (!heat)
      throw new Error(
        "A judge assignment has no heat. Review judge assignments before publishing.",
      )
    const startTime = toIso(heat.scheduledTime)
    const duration = heat.durationMinutes
    const endTime =
      startTime &&
      typeof duration === "number" &&
      Number.isFinite(duration) &&
      duration > 0
        ? new Date(Date.parse(startTime) + duration * 60_000).toISOString()
        : null
    addAssignment(assignment.membershipId, {
      id: publicId(`judge:${assignment.id}`),
      kind: "judge",
      title: workouts.get(heat.trackWorkoutId)?.name ?? "Competition event",
      roleLabel: assignment.position
        ? (VOLUNTEER_ROLE_LABELS[assignment.position] ?? "Judge")
        : "Judge",
      startTime,
      endTime,
      location: heat.venueId ? (venues.get(heat.venueId)?.name ?? null) : null,
      heatNumber: heat.heatNumber,
      laneNumber: assignment.laneNumber ?? null,
    })
  }

  return crewPublishedScheduleSchema.parse({
    version: 1,
    publishedAt: params.publishedAt.toISOString(),
    event: {
      ...params.event,
      timezone: publicScheduleTimezone(params.event.timezone),
    },
    volunteers: [...volunteers.values()]
      .map((person) => ({
        ...person,
        assignments: person.assignments.sort(
          (a, b) =>
            (a.startTime ?? "~").localeCompare(b.startTime ?? "~") ||
            a.id.localeCompare(b.id),
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
  })
}

export function crewPublishedScheduleContent(schedule: CrewPublishedSchedule) {
  return JSON.stringify({
    event: schedule.event,
    volunteers: schedule.volunteers,
  })
}

/** Resolve claimed invitation duties without changing assignment/token storage. */
export function resolveCrewPublishedScheduleIdentities(params: {
  input: CrewStaffingMatrixInput
  invitations: {
    id: string
    email: string
    acceptedBy: string | null
    status: string
  }[]
  memberships: { id: string; userId: string; email: string | null }[]
}): CrewStaffingMatrixInput {
  const { input, invitations, memberships } = params
  const rosterIds = new Set(input.roster?.map((person) => person.membershipId))
  const aliases = new Map<string, string>()
  const cancelled = new Set(
    invitations
      .filter((invite) => invite.status === "cancelled")
      .map((invite) => invite.id),
  )
  const normalizedEmail = (email: string | null) =>
    email?.trim().toLowerCase() ?? ""
  const membershipByUser = new Map<string, typeof memberships>()
  const membershipByEmail = new Map<string, typeof memberships>()
  const invitationEmailCounts = new Map<string, number>()
  for (const member of memberships) {
    membershipByUser.set(member.userId, [
      ...(membershipByUser.get(member.userId) ?? []),
      member,
    ])
    const email = normalizedEmail(member.email)
    membershipByEmail.set(email, [
      ...(membershipByEmail.get(email) ?? []),
      member,
    ])
  }
  for (const invite of invitations) {
    const email = normalizedEmail(invite.email)
    invitationEmailCounts.set(
      email,
      (invitationEmailCounts.get(email) ?? 0) + 1,
    )
  }

  for (const invitation of invitations) {
    if (cancelled.has(invitation.id)) continue
    let matches = invitation.acceptedBy
      ? (membershipByUser.get(invitation.acceptedBy) ?? [])
      : []
    if (!invitation.acceptedBy) {
      const email = normalizedEmail(invitation.email)
      // Shared emails do not establish which volunteer claimed an invitation.
      // An explicit acceptedBy link above remains authoritative after an email change.
      if (!email || invitationEmailCounts.get(email) !== 1) continue
      matches = membershipByEmail.get(email) ?? []
    }
    if (matches.length === 1 && rosterIds.has(matches[0].id)) {
      aliases.set(invitation.id, matches[0].id)
    }
  }

  const resolveAssignee = (id: string) => aliases.get(id) ?? id
  return {
    ...input,
    roster: input.roster?.filter(
      (person) =>
        !aliases.has(person.membershipId) &&
        !cancelled.has(person.membershipId),
    ),
    shifts: input.shifts?.map((shift) => ({
      ...shift,
      assignments: shift.assignments
        .filter((assignment) => !cancelled.has(assignment.membershipId))
        .map((assignment) => ({
          ...assignment,
          membershipId: resolveAssignee(assignment.membershipId),
        })),
    })),
    judgeAssignments: input.judgeAssignments
      ?.filter((assignment) => !cancelled.has(assignment.membershipId))
      .map((assignment) => ({
        ...assignment,
        membershipId: resolveAssignee(assignment.membershipId),
      })),
  }
}

function publicVolunteerName(name: string, email?: string | null) {
  const value = name.trim()
  if (
    !value ||
    value.toLowerCase() === email?.trim().toLowerCase() ||
    (value.includes("@") && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value))
  ) {
    return "Volunteer"
  }
  return value
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function isInactiveDuty(status: string | undefined) {
  return status === "cancelled" || status === "declined" || status === "no_show"
}

function publicScheduleTimezone(timezone: string | null) {
  try {
    if (timezone) {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format()
      return timezone
    }
  } catch {
    // Legacy event rows may predate timezone validation.
  }
  return "America/Denver"
}
