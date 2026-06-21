// @lat: [[crew#Roster Shifts Assignments]]
// @lat: [[crew#Manual Volunteer Intake]]
// @lat: [[crew#Shift Board Pilot Ops]]
// @lat: [[crew#Roster Volunteer Editing]]
import { createId } from "@paralleldrive/cuid2"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { getDb } from "../db"
import {
  createTeamInvitationId,
  createVolunteerShiftAssignmentId,
} from "../db/schemas/common"
import type { Competition } from "../db/schemas/competitions"
import { competitionsTable } from "../db/schemas/competitions"
import { CREW_ASSIGNMENT_CONFIRMATION_TYPE } from "../db/schemas/crew-imports"
import { crewEventSettingsTable } from "../db/schemas/crew-event-settings"
import {
  INVITATION_STATUS,
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
  teamMembershipTable,
} from "../db/schemas/teams"
import { userTable } from "../db/schemas/users"
import type {
  VolunteerAvailability,
  VolunteerRoleType,
} from "../db/schemas/volunteers"
import {
  volunteerShiftAssignmentsTable,
  volunteerShiftsTable,
} from "../db/schemas/volunteers"
import type {
  ExistingManualVolunteerInvitation,
  ExistingManualVolunteerMembership,
  ManualVolunteerPasteInvalidRow,
} from "../lib/crew/manual-volunteer-intake"
import {
  buildManualVolunteerMetadata,
  normalizeManualVolunteerEmail,
  parseManualVolunteerEmailPaste,
  planManualVolunteerIntake,
} from "../lib/crew/manual-volunteer-intake"
import type {
  CrewRosterSummary,
  CrewRosterVolunteer,
} from "../lib/crew/roster-shifts"
import {
  assertCrewDepartmentLeadCanManageRosterTarget,
  assertCrewDepartmentLeadCanManageShift,
  filterCrewDepartmentLeadRoster,
  filterCrewDepartmentLeadShifts,
  type CrewDepartmentLeadRosterTarget,
} from "../lib/crew/department-leads"
import {
  buildCrewRosterVolunteerMetadataUpdate,
  buildCrewRoster,
  findCrewRosterVolunteerEmailCollision,
  formatVolunteerRole,
  getCrewRosterRoleTypes,
  normalizeCrewRosterVolunteerEmail,
  normalizeCrewShiftTimes,
  parseCrewRosterMetadata,
  shouldUpdateCrewRosterInvitationEmail,
  summarizeCrewRoster,
  validateShiftAssignment,
  validateShiftCapacityUpdate,
} from "../lib/crew/roster-shifts"
import { summarizeCrewAssignmentConfirmationOperationalStates } from "../lib/crew/assignment-confirmations"
import {
  buildCrewShiftBoardPilotOps,
  type CrewShiftBoardPilotOpsData,
} from "../lib/crew/shift-board-pilot-ops"
import {
  buildCrewStaffingMatrix,
  type CrewStaffingMatrixInput,
} from "../lib/crew/staffing"
import { resolveCrewDepartmentLeadAccess } from "./crew-department-lead.server"
import {
  cancelCrewShiftAssignmentConfirmations,
  ensureCrewShiftAssignmentConfirmation,
  loadCrewShiftAssignmentConfirmationMap,
  summarizeCrewShiftAssignmentConfirmations,
} from "./crew-confirmation.server"
import type { CrewShiftAssignmentConfirmationStatus } from "./crew-confirmation.server"
import {
  DEFAULT_TIMEZONE,
  formatDateTimeInTimezone,
} from "../utils/timezone-utils"
import { getFirstExecuteValue } from "../server-fns/db-execute"

type DbClient = ReturnType<typeof getDb>

type CrewRosterCompetition = Pick<
  Competition,
  | "id"
  | "name"
  | "slug"
  | "organizingTeamId"
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
  availability: VolunteerAvailability | null
  credentials: string | null
  imported: boolean
  signupSource: string | null
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
  pilotOps: CrewShiftBoardPilotOpsData
}

export interface CrewShiftSummary {
  totalShifts: number
  assignedSlots: number
  capacity: number
  openSlots: number
  confirmationSummary: ReturnType<
    typeof summarizeCrewShiftAssignmentConfirmations
  >
  confirmationOperationalSummary: ReturnType<
    typeof summarizeCrewAssignmentConfirmationOperationalStates
  >
}

interface CrewEventInput {
  eventId: string
}

interface CrewShiftInput extends CrewEventInput {
  name: string
  roleType: VolunteerRoleType
  date: string
  startTime: string
  endTime: string
  location?: string
  capacity: number
  notes?: string
}

interface UpdateCrewShiftInput extends CrewEventInput {
  shiftId: string
  name?: string
  roleType?: VolunteerRoleType
  date?: string
  startTime?: string
  endTime?: string
  location?: string
  capacity?: number
  notes?: string
}

interface DeleteCrewShiftInput extends CrewEventInput {
  shiftId: string
}

interface CrewShiftAssignmentInput extends DeleteCrewShiftInput {
  membershipId: string
  notes?: string
}

interface ManualCrewVolunteerInput extends CrewEventInput {
  email: string
  name?: string
  phone?: string
  roleTypes?: VolunteerRoleType[]
  availability?: VolunteerAvailability
  availabilityNotes?: string
  notes?: string
}

interface ManualCrewVolunteerPasteInput extends CrewEventInput {
  pasteText: string
}

interface UpdateCrewRosterVolunteerInput extends CrewEventInput {
  source: CrewRosterVolunteer["source"]
  sourceId: string
  email: string
  name?: string
  phone?: string
  roleTypes?: VolunteerRoleType[]
  availability?: VolunteerAvailability
  availabilityNotes?: string
  credentials?: string
  notes?: string
}

interface ManualCrewVolunteerCreateRow
  extends Omit<ManualCrewVolunteerInput, "eventId"> {
  rowNumber: number
}

export interface ManualCrewVolunteerCreatedRow {
  rowNumber: number
  email: string
  invitationId: string
}

export interface ManualCrewVolunteerSkippedRow {
  rowNumber: number
  email: string
  reason:
    | "duplicate_in_paste"
    | "pending_invitation"
    | "accepted_invitation"
    | "active_membership"
    | "inactive_membership"
  message: string
  targetId: string | null
}

export interface ManualCrewVolunteerMutationResult {
  created: ManualCrewVolunteerCreatedRow[]
  skipped: ManualCrewVolunteerSkippedRow[]
  invalid: ManualVolunteerPasteInvalidRow[]
  summary: {
    created: number
    skipped: number
    invalid: number
  }
}

export interface UpdateCrewRosterVolunteerResult {
  success: true
  source: CrewRosterVolunteer["source"]
  sourceId: string
  email: string
}

export async function getCrewRosterPage(
  data: CrewEventInput,
): Promise<CrewRosterPageData> {
  const event = await requireCrewRosterEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const [roster, shifts] = await Promise.all([
    loadCrewRoster(event.competitionTeamId),
    loadCrewShifts(event.id),
  ])
  const scopedShifts = filterCrewDepartmentLeadShifts(shifts, access)
  const scopedRoster = filterCrewDepartmentLeadRoster(
    roster,
    access,
    scopedShifts,
  )

  return {
    event,
    roster: scopedRoster,
    summary: summarizeCrewRoster(scopedRoster),
    shiftSummary: summarizeCrewShifts(scopedShifts),
  }
}

export async function getCrewShiftBoard(
  data: CrewEventInput,
): Promise<CrewShiftBoardData> {
  const event = await requireCrewRosterEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const [roster, shifts] = await Promise.all([
    loadCrewRoster(event.competitionTeamId),
    loadCrewShifts(event.id),
  ])
  const scopedShifts = filterCrewDepartmentLeadShifts(shifts, access)
  const scopedRoster = filterCrewDepartmentLeadRoster(
    roster,
    access,
    scopedShifts,
  )
  const matrixInput = buildShiftBoardStaffingMatrixInput(
    event,
    scopedRoster,
    scopedShifts,
  )
  const matrix = buildCrewStaffingMatrix(matrixInput)

  return {
    event,
    roster: scopedRoster,
    rosterSummary: summarizeCrewRoster(scopedRoster),
    shifts: scopedShifts,
    shiftSummary: summarizeCrewShifts(scopedShifts),
    pilotOps: buildCrewShiftBoardPilotOps({
      shifts: scopedShifts,
      roster: scopedRoster,
      matrix,
    }),
  }
}

export async function getCrewEventRosterShiftSummary(data: CrewEventInput) {
  const event = await requireCrewRosterEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const [roster, shifts] = await Promise.all([
    loadCrewRoster(event.competitionTeamId),
    loadCrewShifts(event.id),
  ])
  const scopedShifts = filterCrewDepartmentLeadShifts(shifts, access)
  const scopedRoster = filterCrewDepartmentLeadRoster(
    roster,
    access,
    scopedShifts,
  )

  return {
    rosterSummary: summarizeCrewRoster(scopedRoster),
    shiftSummary: summarizeCrewShifts(scopedShifts),
  }
}

export async function createManualCrewVolunteer(
  data: ManualCrewVolunteerInput,
): Promise<ManualCrewVolunteerMutationResult> {
  const event = await requireCrewRosterEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  assertCrewDepartmentLeadCanManageRosterTarget(
    access,
    toRosterTarget(null, data.roleTypes),
  )
  return createManualCrewVolunteerRows(event, [
    {
      rowNumber: 1,
      email: normalizeManualVolunteerEmail(data.email),
      name: data.name,
      phone: data.phone,
      roleTypes: data.roleTypes,
      availability: data.availability,
      availabilityNotes: data.availabilityNotes,
      notes: data.notes,
    },
  ])
}

export async function pasteManualCrewVolunteerEmails(
  data: ManualCrewVolunteerPasteInput,
): Promise<ManualCrewVolunteerMutationResult> {
  const event = await requireCrewRosterEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  assertCrewDepartmentLeadCanManageRosterTarget(
    access,
    toRosterTarget(null, undefined),
  )
  const parsed = parseManualVolunteerEmailPaste(data.pasteText)
  const result = await createManualCrewVolunteerRows(
    event,
    parsed.valid.map((row) => ({
      rowNumber: row.rowNumber,
      email: row.email,
    })),
  )

  return buildManualCrewVolunteerMutationResult({
    created: result.created,
    skipped: [
      ...parsed.skipped.map((row) => ({
        rowNumber: row.rowNumber,
        email: row.email,
        reason: row.reason,
        message: "Email was already included in this paste.",
        targetId: null,
      })),
      ...result.skipped,
    ],
    invalid: parsed.invalid,
  })
}

export async function updateCrewRosterVolunteer(
  data: UpdateCrewRosterVolunteerInput,
): Promise<UpdateCrewRosterVolunteerResult> {
  const event = await requireCrewRosterEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const db = getDb()
  const normalizedEmail = normalizeCrewRosterVolunteerEmail(data.email)

  await withCrewRosterVolunteerWriteLock(
    db,
    event.competitionTeamId,
    async () => {
      await db.transaction(async (tx) => {
        const client = tx as unknown as DbClient
        const [existingInvitations, existingMemberships] = await Promise.all([
          listManualVolunteerInvitations(client, event.competitionTeamId),
          listManualVolunteerMemberships(client, event.competitionTeamId),
        ])
        const currentInvitation =
          data.source === "team_invitation"
            ? existingInvitations.find(
                (invitation) => invitation.id === data.sourceId,
              )
            : null
        const currentMembership =
          data.source === "team_membership"
            ? existingMemberships.find(
                (membership) => membership.id === data.sourceId,
              )
            : null
        const current = currentInvitation ?? currentMembership

        if (!current) {
          throw new Error("Roster volunteer not found")
        }
        assertCrewDepartmentLeadCanManageRosterTarget(
          access,
          toRosterTarget(
            currentMembership?.id ?? null,
            parseCrewRosterMetadata(current.metadata).volunteerRoleTypes,
          ),
        )
        assertCrewDepartmentLeadCanManageRosterTarget(
          access,
          toRosterTarget(currentMembership?.id ?? null, data.roleTypes),
        )

        const collision = findCrewRosterVolunteerEmailCollision({
          source: data.source,
          sourceId: data.sourceId,
          email: normalizedEmail,
          invitations: existingInvitations,
          memberships: existingMemberships,
        })

        if (collision) {
          throw new Error("A matching volunteer email already exists.")
        }

        const timestamp = new Date()
        const metadata = buildCrewRosterVolunteerMetadataUpdate(
          current.metadata,
          {
            email: normalizedEmail,
            name: data.name,
            phone: data.phone,
            roleTypes: data.roleTypes,
            availability: data.availability,
            availabilityNotes: data.availabilityNotes,
            credentials: data.credentials,
            notes: data.notes,
          },
        )
        const metadataJson = JSON.stringify(metadata)

        if (currentInvitation) {
          const updateValues: Partial<typeof teamInvitationTable.$inferInsert> =
            {
              metadata: metadataJson,
              updatedAt: timestamp,
            }

          if (
            shouldUpdateCrewRosterInvitationEmail(currentInvitation, timestamp)
          ) {
            updateValues.email = normalizedEmail
          }

          await tx
            .update(teamInvitationTable)
            .set(updateValues)
            .where(
              and(
                eq(teamInvitationTable.id, currentInvitation.id),
                eq(teamInvitationTable.teamId, event.competitionTeamId),
                eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
                eq(teamInvitationTable.isSystemRole, true),
              ),
            )
          return
        }

        await tx
          .update(teamMembershipTable)
          .set({
            metadata: metadataJson,
            updatedAt: timestamp,
          })
          .where(
            and(
              eq(teamMembershipTable.id, data.sourceId),
              eq(teamMembershipTable.teamId, event.competitionTeamId),
              eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
              eq(teamMembershipTable.isSystemRole, true),
            ),
          )
      })
    },
  )

  return {
    success: true,
    source: data.source,
    sourceId: data.sourceId,
    email: normalizedEmail,
  }
}

export async function createCrewShift(data: CrewShiftInput) {
  const event = await requireCrewRosterEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const { startTime, endTime } = normalizeCrewShiftTimes({
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    timezone: event.timezone ?? DEFAULT_TIMEZONE,
  })
  assertCrewDepartmentLeadCanManageShift(access, {
    roleType: data.roleType,
    startTime,
    endTime,
    location: data.location,
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
}

export async function updateCrewShift(data: UpdateCrewShiftInput) {
  const event = await requireCrewRosterEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
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
    assertCrewDepartmentLeadCanManageShift(access, existingShift)

    const updateValues: Partial<typeof volunteerShiftsTable.$inferInsert> = {}
    const timezone = event.timezone ?? DEFAULT_TIMEZONE
    const date =
      data.date ??
      formatDateTimeInTimezone(existingShift.startTime, timezone, "yyyy-MM-dd")
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
    assertCrewDepartmentLeadCanManageShift(access, {
      roleType: data.roleType ?? existingShift.roleType,
      startTime: updateValues.startTime ?? existingShift.startTime,
      endTime: updateValues.endTime ?? existingShift.endTime,
      location:
        data.location !== undefined
          ? emptyToNull(data.location)
          : existingShift.location,
    })

    updateValues.updatedAt = new Date()
    await tx
      .update(volunteerShiftsTable)
      .set(updateValues)
      .where(eq(volunteerShiftsTable.id, data.shiftId))
  })

  return { success: true }
}

export async function deleteCrewShift(data: DeleteCrewShiftInput) {
  const event = await requireCrewRosterEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const shift = await requireCrewShift(event.id, data.shiftId)
  assertCrewDepartmentLeadCanManageShift(access, shift)
  const db = getDb()

  await db.transaction(async (tx) => {
    const [lockedShift] = await tx
      .select({ id: volunteerShiftsTable.id })
      .from(volunteerShiftsTable)
      .where(eq(volunteerShiftsTable.id, data.shiftId))
      .for("update")
      .limit(1)
    if (!lockedShift) {
      throw new Error("Volunteer shift not found")
    }

    const assignments = await tx
      .select({ id: volunteerShiftAssignmentsTable.id })
      .from(volunteerShiftAssignmentsTable)
      .where(eq(volunteerShiftAssignmentsTable.shiftId, data.shiftId))
      .for("update")
    const assignmentIds = assignments.map((assignment) => assignment.id)

    await cancelCrewShiftAssignmentConfirmations({
      db: tx as unknown as DbClient,
      assignmentIds,
    })
    if (assignmentIds.length > 0) {
      await tx
        .delete(volunteerShiftAssignmentsTable)
        .where(inArray(volunteerShiftAssignmentsTable.id, assignmentIds))
    }
    await tx
      .delete(volunteerShiftsTable)
      .where(eq(volunteerShiftsTable.id, data.shiftId))
  })

  return { success: true }
}

export async function assignCrewVolunteerToShift(
  data: CrewShiftAssignmentInput,
) {
  const db = getDb()
  const event = await requireCrewRosterEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)

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
    assertCrewDepartmentLeadCanManageShift(access, shift)

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

    if (!membership) {
      throw new Error("Volunteer record was not found for this event.")
    }
    const membershipRoleTypes = getCrewRosterRoleTypes(
      parseCrewRosterMetadata(membership.metadata).volunteerRoleTypes,
    )
    assertCrewDepartmentLeadCanManageRosterTarget(access, {
      membershipId: membership.id,
      roleTypes: membershipRoleTypes,
    })

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
      volunteer: {
        membershipId: membership.id,
        isActive: membership.isActive,
        roleTypes: membershipRoleTypes,
      },
    })

    if (!validation.ok) {
      throw new Error(validation.message)
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
      email: emptyToNull(metadata.signupEmail) ?? emptyToNull(membership.email),
      expiresAt: getAssignmentConfirmationExpiry(now),
      now,
    })

    return { success: true, action: "assigned" as const, assignmentId }
  })
}

export async function removeCrewVolunteerShiftAssignment(
  data: CrewShiftAssignmentInput,
) {
  const event = await requireCrewRosterEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const shift = await requireCrewShift(event.id, data.shiftId)
  assertCrewDepartmentLeadCanManageShift(access, shift)
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
      .for("update")
    const assignmentIds = assignments.map((assignment) => assignment.id)

    await cancelCrewShiftAssignmentConfirmations({
      db: tx as unknown as DbClient,
      assignmentIds,
    })
    if (assignmentIds.length > 0) {
      await tx
        .delete(volunteerShiftAssignmentsTable)
        .where(inArray(volunteerShiftAssignmentsTable.id, assignmentIds))
    }
  })

  return { success: true }
}

async function requireCrewRosterEvent(
  eventId: string,
): Promise<CrewRosterCompetition> {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      slug: competitionsTable.slug,
      organizingTeamId: competitionsTable.organizingTeamId,
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

function toRosterTarget(
  membershipId: string | null,
  roleTypes: VolunteerRoleType[] | undefined,
): CrewDepartmentLeadRosterTarget {
  return {
    membershipId,
    roleTypes: getCrewRosterRoleTypes(roleTypes),
  }
}

export async function loadCrewRoster(competitionTeamId: string) {
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

async function createManualCrewVolunteerRows(
  event: CrewRosterCompetition,
  rows: ManualCrewVolunteerCreateRow[],
): Promise<ManualCrewVolunteerMutationResult> {
  const db = getDb()
  const created: ManualCrewVolunteerCreatedRow[] = []
  const skipped: ManualCrewVolunteerSkippedRow[] = []
  const timestamp = new Date()
  const expiresAt = new Date(timestamp)
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  // team_invitations has no team/email uniqueness constraint, so serialize
  // manual intake for this roster until the batch transaction commits.
  await withCrewRosterVolunteerWriteLock(
    db,
    event.competitionTeamId,
    async () => {
      await db.transaction(async (tx) => {
        const client = tx as unknown as DbClient

        for (const row of rows) {
          const email = normalizeManualVolunteerEmail(row.email)
          const [existingInvitations, existingMemberships] = await Promise.all([
            listManualVolunteerInvitations(client, event.competitionTeamId),
            listManualVolunteerMemberships(client, event.competitionTeamId),
          ])
          const plan = planManualVolunteerIntake(email, {
            existingInvitations,
            existingMemberships,
          })

          if (plan.action === "skip") {
            skipped.push({
              rowNumber: row.rowNumber,
              email,
              reason: plan.reason,
              message: plan.message,
              targetId: plan.targetId,
            })
            continue
          }

          const invitationId = createTeamInvitationId()
          const metadata = buildManualVolunteerMetadata(
            {
              ...row,
              email,
            },
            timestamp,
          )
          const metadataJson = JSON.stringify(metadata)

          await client.insert(teamInvitationTable).values({
            id: invitationId,
            teamId: event.competitionTeamId,
            email,
            roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
            isSystemRole: true,
            token: createId(),
            invitedBy: null,
            expiresAt,
            status: INVITATION_STATUS.PENDING,
            metadata: metadataJson,
            createdAt: timestamp,
            updatedAt: timestamp,
          })

          created.push({
            rowNumber: row.rowNumber,
            email,
            invitationId,
          })
        }
      })
    },
  )

  return buildManualCrewVolunteerMutationResult({
    created,
    skipped,
    invalid: [],
  })
}

async function withCrewRosterVolunteerWriteLock<T>(
  db: DbClient,
  competitionTeamId: string,
  callback: () => Promise<T>,
) {
  let acquired = false
  const lockName =
    await createCrewRosterVolunteerWriteLockName(competitionTeamId)

  try {
    const result = await db.execute(
      sql`SELECT GET_LOCK(${lockName}, 5) FROM dual`,
    )
    acquired = Number(getFirstExecuteValue(result) ?? 0) === 1
    if (!acquired) {
      throw new Error("Roster volunteer could not be saved")
    }

    return await callback()
  } finally {
    if (acquired) {
      await db.execute(sql`SELECT RELEASE_LOCK(${lockName}) FROM dual`)
    }
  }
}

async function createCrewRosterVolunteerWriteLockName(
  competitionTeamId: string,
) {
  const encoded = new TextEncoder().encode(
    `crew-roster-volunteer:${competitionTeamId}`,
  )
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
}

async function listManualVolunteerInvitations(
  db: DbClient,
  competitionTeamId: string,
): Promise<ExistingManualVolunteerInvitation[]> {
  return db
    .select({
      id: teamInvitationTable.id,
      email: teamInvitationTable.email,
      acceptedAt: teamInvitationTable.acceptedAt,
      expiresAt: teamInvitationTable.expiresAt,
      status: teamInvitationTable.status,
      metadata: teamInvitationTable.metadata,
    })
    .from(teamInvitationTable)
    .where(
      and(
        eq(teamInvitationTable.teamId, competitionTeamId),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamInvitationTable.isSystemRole, true),
      ),
    )
}

async function listManualVolunteerMemberships(
  db: DbClient,
  competitionTeamId: string,
): Promise<ExistingManualVolunteerMembership[]> {
  return db
    .select({
      id: teamMembershipTable.id,
      email: userTable.email,
      isActive: teamMembershipTable.isActive,
      metadata: teamMembershipTable.metadata,
    })
    .from(teamMembershipTable)
    .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(teamMembershipTable.teamId, competitionTeamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamMembershipTable.isSystemRole, true),
      ),
    )
}

function buildManualCrewVolunteerMutationResult(input: {
  created: ManualCrewVolunteerCreatedRow[]
  skipped: ManualCrewVolunteerSkippedRow[]
  invalid: ManualVolunteerPasteInvalidRow[]
}): ManualCrewVolunteerMutationResult {
  return {
    ...input,
    summary: {
      created: input.created.length,
      skipped: input.skipped.length,
      invalid: input.invalid.length,
    },
  }
}

export async function loadCrewShifts(
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
          availability: metadata.availability ?? null,
          credentials: metadata.credentials ?? null,
          imported: Boolean(metadata.crewImportId),
          signupSource:
            metadata.crewSignupSource ?? metadata.inviteSource ?? null,
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

function buildShiftBoardStaffingMatrixInput(
  event: CrewRosterCompetition,
  roster: CrewRosterVolunteer[],
  shifts: CrewShiftBoardItem[],
): CrewStaffingMatrixInput {
  return {
    event: {
      id: event.id,
      name: event.name,
      timezone: event.timezone,
      startDate: event.startDate,
      endDate: event.endDate,
    },
    roster: roster.flatMap((volunteer) => {
      if (!volunteer.membershipId) return []
      return {
        membershipId: volunteer.membershipId,
        name: volunteer.name,
        email: volunteer.email,
        roleTypes: volunteer.roleTypes,
        availability: volunteer.availability,
        credentials: volunteer.credentials,
        isActive: volunteer.status === "active",
      }
    }),
    shifts: shifts.map((shift) => ({
      id: shift.id,
      name: shift.name,
      roleType: shift.roleType,
      startTime: shift.startTime,
      endTime: shift.endTime,
      capacity: shift.capacity,
      location: shift.location,
      assignments: shift.assignments.map((assignment) => ({
        id: assignment.id,
        membershipId: assignment.membershipId,
        confirmation: assignment.confirmation
          ? {
              type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
              status: assignment.confirmation.status,
              sentAt: assignment.confirmation.sentAt,
              respondedAt: assignment.confirmation.respondedAt,
              responseNote: assignment.confirmation.responseNote,
            }
          : null,
      })),
    })),
  }
}

export function summarizeCrewShifts(
  shifts: CrewShiftBoardItem[],
): CrewShiftSummary {
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
    confirmationOperationalSummary:
      summarizeCrewAssignmentConfirmationOperationalStates(
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
