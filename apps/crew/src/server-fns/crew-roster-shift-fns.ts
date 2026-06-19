// @lat: [[crew#Roster Shifts Assignments]]
import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "../db"
import { createVolunteerShiftAssignmentId } from "../db/schemas/common"
import { competitionsTable, type Competition } from "../db/schemas/competitions"
import { crewEventSettingsTable } from "../db/schemas/crew-event-settings"
import {
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
  teamMembershipTable,
} from "../db/schemas/teams"
import { userTable } from "../db/schemas/users"
import {
  VOLUNTEER_ROLE_TYPE_VALUES,
  volunteerShiftAssignmentsTable,
  volunteerShiftsTable,
  type VolunteerRoleType,
} from "../db/schemas/volunteers"
import {
  buildCrewRoster,
  formatVolunteerRole,
  getCrewRosterRoleTypes,
  normalizeCrewShiftTimes,
  parseCrewRosterMetadata,
  summarizeCrewRoster,
  validateShiftAssignment,
  validateShiftCapacityUpdate,
  type CrewRosterSummary,
  type CrewRosterVolunteer,
} from "../lib/crew/roster-shifts"
import { requireLocalCrewOperatorAccess } from "../server/crew-local-access"
import {
  cancelCrewShiftAssignmentConfirmations,
  ensureCrewShiftAssignmentConfirmation,
  loadCrewShiftAssignmentConfirmationMap,
  summarizeCrewShiftAssignmentConfirmations,
  type CrewShiftAssignmentConfirmationStatus,
} from "./crew-confirmation-fns"
import {
  DEFAULT_TIMEZONE,
  formatDateTimeInTimezone,
} from "../utils/timezone-utils"

type DbClient = ReturnType<typeof getDb>

type CrewRosterCompetition = Pick<
  Competition,
  | "id"
  | "name"
  | "slug"
  | "competitionTeamId"
  | "timezone"
  | "startDate"
  | "endDate"
>

export interface CrewShiftAssignmentVolunteer {
  membershipId: string
  name: string
  email: string
  roleTypes: VolunteerRoleType[]
}

export interface CrewShiftAssignmentItem {
  id: string
  membershipId: string
  notes: string | null
  confirmation: CrewShiftAssignmentConfirmationStatus | null
  volunteer: CrewShiftAssignmentVolunteer
}

export interface CrewShiftBoardItem {
  id: string
  competitionId: string
  name: string
  roleType: VolunteerRoleType
  roleLabel: string
  startTime: Date
  endTime: Date
  location: string | null
  capacity: number
  notes: string | null
  assignments: CrewShiftAssignmentItem[]
  assignedCount: number
  openSlots: number
}

export interface CrewRosterPageData {
  event: CrewRosterCompetition
  roster: CrewRosterVolunteer[]
  summary: CrewRosterSummary
  shiftSummary: CrewShiftSummary
}

export interface CrewShiftBoardData {
  event: CrewRosterCompetition
  roster: CrewRosterVolunteer[]
  rosterSummary: CrewRosterSummary
  shifts: CrewShiftBoardItem[]
  shiftSummary: CrewShiftSummary
}

export interface CrewShiftSummary {
  totalShifts: number
  assignedSlots: number
  capacity: number
  openSlots: number
  confirmationSummary: ReturnType<
    typeof summarizeCrewShiftAssignmentConfirmations
  >
}

const eventIdSchema = z.string().min(1, "Event ID is required")
const shiftIdSchema = z.string().startsWith("vshf_", "Invalid shift ID")
const membershipIdSchema = z
  .string()
  .startsWith("tmem_", "Invalid membership ID")
const roleTypeSchema = z.enum(VOLUNTEER_ROLE_TYPE_VALUES)
const shiftTextSchema = z.string().trim().max(1000).optional()
const shiftDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
const shiftTimeSchema = z
  .string()
  .regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, "Time must be HH:mm")

const shiftInputSchema = z.object({
  eventId: eventIdSchema,
  name: z.string().trim().min(1, "Name is required").max(200),
  roleType: roleTypeSchema,
  date: shiftDateSchema,
  startTime: shiftTimeSchema,
  endTime: shiftTimeSchema,
  location: z.string().trim().max(200).optional(),
  capacity: z.coerce.number().int().min(1).max(500),
  notes: shiftTextSchema,
})

const updateShiftInputSchema = shiftInputSchema
  .extend({
    shiftId: shiftIdSchema,
  })
  .partial({
    name: true,
    roleType: true,
    date: true,
    startTime: true,
    endTime: true,
    location: true,
    capacity: true,
    notes: true,
  })
  .required({
    eventId: true,
    shiftId: true,
  })

const shiftAssignmentInputSchema = z.object({
  eventId: eventIdSchema,
  shiftId: shiftIdSchema,
  membershipId: membershipIdSchema,
  notes: z.string().trim().max(500).optional(),
})

const deleteShiftInputSchema = z.object({
  eventId: eventIdSchema,
  shiftId: shiftIdSchema,
})

export const getCrewRosterPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ eventId: eventIdSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<CrewRosterPageData> => {
    requireLocalCrewOperatorAccess("Crew roster")

    const event = await requireCrewRosterEvent(data.eventId)
    const [roster, shifts] = await Promise.all([
      loadCrewRoster(event.competitionTeamId),
      loadCrewShifts(event.id),
    ])

    return {
      event,
      roster,
      summary: summarizeCrewRoster(roster),
      shiftSummary: summarizeCrewShifts(shifts),
    }
  })

export const getCrewShiftBoardFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ eventId: eventIdSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<CrewShiftBoardData> => {
    requireLocalCrewOperatorAccess("Crew shifts")

    const event = await requireCrewRosterEvent(data.eventId)
    const [roster, shifts] = await Promise.all([
      loadCrewRoster(event.competitionTeamId),
      loadCrewShifts(event.id),
    ])

    return {
      event,
      roster,
      rosterSummary: summarizeCrewRoster(roster),
      shifts,
      shiftSummary: summarizeCrewShifts(shifts),
    }
  })

export const getCrewEventRosterShiftSummaryFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z.object({ eventId: eventIdSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    requireLocalCrewOperatorAccess("Crew dashboard")

    const event = await requireCrewRosterEvent(data.eventId)
    const [roster, shifts] = await Promise.all([
      loadCrewRoster(event.competitionTeamId),
      loadCrewShifts(event.id),
    ])

    return {
      rosterSummary: summarizeCrewRoster(roster),
      shiftSummary: summarizeCrewShifts(shifts),
    }
  })

export const createCrewShiftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => shiftInputSchema.parse(data))
  .handler(async ({ data }) => {
    requireLocalCrewOperatorAccess("Crew shifts")

    const event = await requireCrewRosterEvent(data.eventId)
    const { startTime, endTime } = normalizeCrewShiftTimes({
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      timezone: event.timezone ?? DEFAULT_TIMEZONE,
    })
    const db = getDb()

    await db.insert(volunteerShiftsTable).values({
      competitionId: event.id,
      name: data.name,
      roleType: data.roleType,
      startTime,
      endTime,
      location: emptyToNull(data.location),
      capacity: data.capacity,
      notes: emptyToNull(data.notes),
    })

    return { success: true }
  })

export const updateCrewShiftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateShiftInputSchema.parse(data))
  .handler(async ({ data }) => {
    requireLocalCrewOperatorAccess("Crew shifts")

    const event = await requireCrewRosterEvent(data.eventId)
    const db = getDb()
    await db.transaction(async (tx) => {
      const [existingShift] = await tx
        .select()
        .from(volunteerShiftsTable)
        .where(
          and(
            eq(volunteerShiftsTable.id, data.shiftId),
            eq(volunteerShiftsTable.competitionId, event.id),
          ),
        )
        .for("update")
        .limit(1)

      if (!existingShift) {
        throw new Error("Volunteer shift not found")
      }

      const updateValues: Partial<typeof volunteerShiftsTable.$inferInsert> = {}
      const timezone = event.timezone ?? DEFAULT_TIMEZONE
      const date =
        data.date ??
        formatDateTimeInTimezone(
          existingShift.startTime,
          timezone,
          "yyyy-MM-dd",
        )
      const startInput =
        data.startTime ??
        formatDateTimeInTimezone(existingShift.startTime, timezone, "HH:mm")
      const endInput =
        data.endTime ??
        formatDateTimeInTimezone(existingShift.endTime, timezone, "HH:mm")

      if (data.date || data.startTime || data.endTime) {
        const { startTime, endTime } = normalizeCrewShiftTimes({
          date,
          startTime: startInput,
          endTime: endInput,
          timezone,
        })
        updateValues.startTime = startTime
        updateValues.endTime = endTime
      }

      if (data.name !== undefined) updateValues.name = data.name
      if (data.roleType !== undefined) updateValues.roleType = data.roleType
      if (data.location !== undefined)
        updateValues.location = emptyToNull(data.location)
      if (data.capacity !== undefined) {
        const currentAssignments = await tx
          .select({ id: volunteerShiftAssignmentsTable.id })
          .from(volunteerShiftAssignmentsTable)
          .where(eq(volunteerShiftAssignmentsTable.shiftId, existingShift.id))

        const capacityValidation = validateShiftCapacityUpdate(
          data.capacity,
          currentAssignments.length,
        )
        if (!capacityValidation.ok) {
          throw new Error(capacityValidation.message)
        }

        updateValues.capacity = data.capacity
      }
      if (data.notes !== undefined) updateValues.notes = emptyToNull(data.notes)

      if (Object.keys(updateValues).length === 0) return

      updateValues.updatedAt = new Date()
      await tx
        .update(volunteerShiftsTable)
        .set(updateValues)
        .where(eq(volunteerShiftsTable.id, data.shiftId))
    })

    return { success: true }
  })

export const deleteCrewShiftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteShiftInputSchema.parse(data))
  .handler(async ({ data }) => {
    requireLocalCrewOperatorAccess("Crew shifts")

    await requireCrewRosterEvent(data.eventId)
    await requireCrewShift(data.eventId, data.shiftId)
    const db = getDb()

    await db.transaction(async (tx) => {
      const assignments = await tx
        .select({ id: volunteerShiftAssignmentsTable.id })
        .from(volunteerShiftAssignmentsTable)
        .where(eq(volunteerShiftAssignmentsTable.shiftId, data.shiftId))

      await cancelCrewShiftAssignmentConfirmations({
        db: tx as unknown as DbClient,
        assignmentIds: assignments.map((assignment) => assignment.id),
      })
      await tx
        .delete(volunteerShiftAssignmentsTable)
        .where(eq(volunteerShiftAssignmentsTable.shiftId, data.shiftId))
      await tx
        .delete(volunteerShiftsTable)
        .where(eq(volunteerShiftsTable.id, data.shiftId))
    })

    return { success: true }
  })

export const assignCrewVolunteerToShiftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => shiftAssignmentInputSchema.parse(data))
  .handler(async ({ data }) => {
    requireLocalCrewOperatorAccess("Crew shifts")

    const db = getDb()
    const event = await requireCrewRosterEvent(data.eventId)

    return await db.transaction(async (tx) => {
      const [shift] = await tx
        .select()
        .from(volunteerShiftsTable)
        .where(
          and(
            eq(volunteerShiftsTable.id, data.shiftId),
            eq(volunteerShiftsTable.competitionId, event.id),
          ),
        )
        .for("update")
        .limit(1)

      if (!shift) {
        throw new Error("Volunteer shift not found")
      }

      const [assignments, membershipRows] = await Promise.all([
        tx
          .select({
            id: volunteerShiftAssignmentsTable.id,
            membershipId: volunteerShiftAssignmentsTable.membershipId,
          })
          .from(volunteerShiftAssignmentsTable)
          .where(eq(volunteerShiftAssignmentsTable.shiftId, shift.id)),
        tx
          .select({
            id: teamMembershipTable.id,
            isActive: teamMembershipTable.isActive,
            metadata: teamMembershipTable.metadata,
            email: userTable.email,
          })
          .from(teamMembershipTable)
          .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
          .where(
            and(
              eq(teamMembershipTable.id, data.membershipId),
              eq(teamMembershipTable.teamId, event.competitionTeamId),
              eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
              eq(teamMembershipTable.isSystemRole, true),
            ),
          )
          .limit(1),
      ])
      const membership = membershipRows[0] ?? null

      const existingAssignment = assignments.find(
        (assignment) => assignment.membershipId === data.membershipId,
      )
      if (existingAssignment) {
        return {
          success: true,
          action: "skipped_duplicate" as const,
          assignmentId: existingAssignment.id,
        }
      }

      const validation = validateShiftAssignment({
        shiftRoleType: shift.roleType,
        capacity: shift.capacity,
        currentAssignmentMembershipIds: assignments.map(
          (assignment) => assignment.membershipId,
        ),
        volunteer: membership
          ? {
              membershipId: membership.id,
              isActive: membership.isActive,
              roleTypes: getCrewRosterRoleTypes(
                parseCrewRosterMetadata(membership.metadata).volunteerRoleTypes,
              ),
            }
          : null,
      })

      if (!validation.ok) {
        throw new Error(validation.message)
      }
      if (!membership) {
        throw new Error("Volunteer record was not found for this event.")
      }

      const assignmentId = createVolunteerShiftAssignmentId()
      const now = new Date()
      await tx.insert(volunteerShiftAssignmentsTable).values({
        id: assignmentId,
        shiftId: shift.id,
        membershipId: membership.id,
        notes: emptyToNull(data.notes),
        createdAt: now,
        updatedAt: now,
      })

      const metadata = parseCrewRosterMetadata(membership.metadata)
      await ensureCrewShiftAssignmentConfirmation({
        db: tx as unknown as DbClient,
        competitionId: event.id,
        assignmentId,
        membershipId: membership.id,
        email: metadata.signupEmail ?? membership.email ?? null,
        expiresAt: getAssignmentConfirmationExpiry(now),
        now,
      })

      return { success: true, action: "assigned" as const, assignmentId }
    })
  })

export const removeCrewVolunteerShiftAssignmentFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => shiftAssignmentInputSchema.parse(data))
  .handler(async ({ data }) => {
    requireLocalCrewOperatorAccess("Crew shifts")

    const event = await requireCrewRosterEvent(data.eventId)
    const shift = await requireCrewShift(event.id, data.shiftId)
    const db = getDb()

    await db.transaction(async (tx) => {
      const assignments = await tx
        .select({ id: volunteerShiftAssignmentsTable.id })
        .from(volunteerShiftAssignmentsTable)
        .where(
          and(
            eq(volunteerShiftAssignmentsTable.shiftId, shift.id),
            eq(volunteerShiftAssignmentsTable.membershipId, data.membershipId),
          ),
        )

      await cancelCrewShiftAssignmentConfirmations({
        db: tx as unknown as DbClient,
        assignmentIds: assignments.map((assignment) => assignment.id),
      })
      await tx
        .delete(volunteerShiftAssignmentsTable)
        .where(
          and(
            eq(volunteerShiftAssignmentsTable.shiftId, shift.id),
            eq(volunteerShiftAssignmentsTable.membershipId, data.membershipId),
          ),
        )
    })

    return { success: true }
  })

async function requireCrewRosterEvent(
  eventId: string,
): Promise<CrewRosterCompetition> {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      slug: competitionsTable.slug,
      competitionTeamId: competitionsTable.competitionTeamId,
      timezone: competitionsTable.timezone,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
    })
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(crewEventSettingsTable.competitionId, eventId))
    .limit(1)

  if (!event) {
    throw new Error("Crew event not found")
  }

  return event
}

async function loadCrewRoster(competitionTeamId: string) {
  const db = getDb()
  const [invitations, memberships] = await Promise.all([
    db.query.teamInvitationTable.findMany({
      where: and(
        eq(teamInvitationTable.teamId, competitionTeamId),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamInvitationTable.isSystemRole, true),
      ),
      orderBy: [asc(teamInvitationTable.email)],
    }),
    db.query.teamMembershipTable.findMany({
      where: and(
        eq(teamMembershipTable.teamId, competitionTeamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamMembershipTable.isSystemRole, true),
      ),
      with: {
        user: true,
      },
    }),
  ])

  return buildCrewRoster(invitations, memberships)
}

async function loadCrewShifts(
  competitionId: string,
): Promise<CrewShiftBoardItem[]> {
  const db = getDb()
  const shifts = await db.query.volunteerShiftsTable.findMany({
    where: eq(volunteerShiftsTable.competitionId, competitionId),
    orderBy: [asc(volunteerShiftsTable.startTime)],
    with: {
      assignments: {
        with: {
          membership: {
            with: {
              user: true,
            },
          },
        },
      },
    },
  })
  const assignmentIds = shifts.flatMap((shift) =>
    shift.assignments.map((assignment) => assignment.id),
  )
  const confirmationMap = await loadCrewShiftAssignmentConfirmationMap(
    db,
    assignmentIds,
  )

  return shifts.map((shift) => {
    const assignments = shift.assignments.map((assignment) => {
      const metadata = parseCrewRosterMetadata(assignment.membership.metadata)
      const roleTypes = getCrewRosterRoleTypes(metadata.volunteerRoleTypes)
      const name =
        metadata.signupName ||
        [
          assignment.membership.user?.firstName,
          assignment.membership.user?.lastName,
        ]
          .filter(Boolean)
          .join(" ") ||
        assignment.membership.user?.email ||
        "Unknown"

      return {
        id: assignment.id,
        membershipId: assignment.membershipId,
        notes: assignment.notes,
        confirmation: confirmationMap.get(assignment.id) ?? null,
        volunteer: {
          membershipId: assignment.membershipId,
          name,
          email:
            metadata.signupEmail ?? assignment.membership.user?.email ?? "",
          roleTypes,
        },
      }
    })

    return {
      id: shift.id,
      competitionId: shift.competitionId,
      name: shift.name,
      roleType: shift.roleType,
      roleLabel: formatVolunteerRole(shift.roleType),
      startTime: shift.startTime,
      endTime: shift.endTime,
      location: shift.location,
      capacity: shift.capacity,
      notes: shift.notes,
      assignments,
      assignedCount: assignments.length,
      openSlots: Math.max(shift.capacity - assignments.length, 0),
    }
  })
}

function summarizeCrewShifts(shifts: CrewShiftBoardItem[]): CrewShiftSummary {
  const summary = shifts.reduce(
    (nextSummary, shift) => {
      nextSummary.totalShifts += 1
      nextSummary.assignedSlots += shift.assignedCount
      nextSummary.capacity += shift.capacity
      nextSummary.openSlots += shift.openSlots
      nextSummary.confirmations.push(
        ...shift.assignments.map((assignment) => assignment.confirmation),
      )
      return nextSummary
    },
    {
      totalShifts: 0,
      assignedSlots: 0,
      capacity: 0,
      openSlots: 0,
      confirmations: [] as Array<CrewShiftAssignmentConfirmationStatus | null>,
    },
  )

  return {
    totalShifts: summary.totalShifts,
    assignedSlots: summary.assignedSlots,
    capacity: summary.capacity,
    openSlots: summary.openSlots,
    confirmationSummary: summarizeCrewShiftAssignmentConfirmations(
      summary.confirmations,
    ),
  }
}

async function requireCrewShift(competitionId: string, shiftId: string) {
  const db = getDb()
  const shift = await db.query.volunteerShiftsTable.findFirst({
    where: and(
      eq(volunteerShiftsTable.id, shiftId),
      eq(volunteerShiftsTable.competitionId, competitionId),
    ),
  })

  if (!shift) {
    throw new Error("Volunteer shift not found")
  }

  return shift
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getAssignmentConfirmationExpiry(now: Date) {
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + 30)
  return expiresAt
}
