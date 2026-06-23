// @lat: [[crew#Assignment Confirmation Responses]]
// @lat: [[crew#Assignment Confirmations]]
// @lat: [[crew#Confirmation Emails And Reminders]]
// @lat: [[crew#Volunteer Self Service]]
import { env } from "cloudflare:workers"
import { render } from "@react-email/render"
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  sql,
} from "drizzle-orm"
import { getDb } from "../db"
import { createCrewAssignmentConfirmationId } from "../db/schemas/common"
import { type Competition, competitionsTable } from "../db/schemas/competitions"
import {
  CREW_EVENT_LIFECYCLE,
  crewEventSettingsTable,
} from "../db/schemas/crew-event-settings"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
  type CrewAssignmentConfirmationStatus,
  crewAssignmentConfirmationsTable,
} from "../db/schemas/crew-imports"
import {
  CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE,
  CREW_VOLUNTEER_IDENTITY_SOURCE,
  type CrewVolunteerHistoryEventType,
} from "../db/schemas/crew-volunteer-intelligence"
import { SYSTEM_ROLES_ENUM, teamMembershipTable } from "../db/schemas/teams"
import { userTable } from "../db/schemas/users"
import {
  type VolunteerAvailability,
  type VolunteerRoleType,
  volunteerShiftAssignmentsTable,
  volunteerShiftsTable,
} from "../db/schemas/volunteers"
import {
  buildCrewAssignmentConfirmationEmailPlan,
  buildCrewAssignmentConfirmationUrls,
  buildCrewAssignmentEmailIdempotencyKey,
  type CrewAssignmentConfirmationEmailCandidate,
  type CrewAssignmentConfirmationEmailOperation,
  type CrewAssignmentConfirmationEmailOperationMode,
  type CrewAssignmentConfirmationOrganizerState,
  type CrewAssignmentConfirmationStatusSummary,
  type CrewAssignmentEmailQueueMessage,
  type CrewAssignmentResponseAction,
  type CrewAssignmentTokenState,
  generateCrewAssignmentConfirmationToken,
  getCrewAssignmentConfirmationOperationalState,
  getCrewAssignmentConfirmationTokenState,
  hashCrewAssignmentConfirmationToken,
  normalizeConfirmationEmailForSend,
  resolveCrewAssignmentConfirmationOrganizerStateUpdate,
  resolveCrewAssignmentConfirmationResponse,
  statusForCrewAssignmentResponseAction,
  summarizeCrewAssignmentConfirmations,
} from "../lib/crew/assignment-confirmations"
import {
  assertCrewDepartmentLeadCanManageShift,
  type CrewDepartmentLeadAccess,
  filterCrewDepartmentLeadShifts,
} from "../lib/crew/department-leads"
import {
  formatVolunteerRole,
  getCrewRosterRoleTypes,
  parseCrewRosterMetadata,
} from "../lib/crew/roster-shifts"
import {
  buildCrewVolunteerSelfServiceSchedule,
  type CrewVolunteerSelfServiceScheduleItem,
  resolveCrewVolunteerSelfServiceContactUpdate,
} from "../lib/crew/volunteer-self-service"
import { getAppUrl } from "../lib/env"
import { CrewAssignmentConfirmationEmail } from "../react-email/crew/assignment-confirmation"
import { CrewAssignmentReminder24HourEmail } from "../react-email/crew/reminder-24-hour"
import { CrewAssignmentReminder48HourEmail } from "../react-email/crew/reminder-48-hour"
import { getFirstExecuteValue } from "../server-fns/db-execute"
import {
  DEFAULT_TIMEZONE,
  formatDateTimeInTimezone,
} from "../utils/timezone-utils"
import {
  requireCrewDepartmentLeadEvent,
  resolveCrewDepartmentLeadAccess,
} from "./crew-department-lead.server"
import { recordCrewVolunteerHistoryEvent } from "./crew-volunteer-history.server"

type DbClient = ReturnType<typeof getDb>

export type { CrewAssignmentEmailQueueMessage }

type CrewConfirmationCompetition = Pick<
  Competition,
  "id" | "slug" | "name" | "timezone" | "startDate" | "endDate"
>

export interface CrewAssignmentConfirmationDisplay {
  id: string
  status: CrewAssignmentConfirmationStatus
  sentAt: Date | null
  respondedAt: Date | null
  expiresAt: Date | null
  responseNote: string | null
}

export interface CrewAssignmentConfirmationTokenData {
  status: CrewAssignmentTokenState
  event: CrewConfirmationCompetition | null
  volunteer: {
    name: string
    email: string
    phone: string | null
    availability: VolunteerAvailability | null
    availabilityNotes: string | null
    credentials: string | null
    roleTypes: VolunteerRoleType[]
  } | null
  assignment: {
    id: string
    shiftId: string
    name: string
    roleType: VolunteerRoleType
    roleLabel: string
    startTime: Date
    endTime: Date
    location: string | null
    notes: string | null
  } | null
  confirmation: CrewAssignmentConfirmationDisplay | null
  schedule: CrewVolunteerSelfServiceScheduleItem[]
}

export interface CrewAssignmentConfirmationResponseResult
  extends CrewAssignmentConfirmationTokenData {
  success: boolean
  outcome:
    | "updated"
    | "idempotent"
    | "expired"
    | "cancelled"
    | "already_responded"
    | "missing"
    | "bad"
  message: string
}

export interface CrewAssignmentConfirmationContactUpdateResult
  extends CrewAssignmentConfirmationTokenData {
  success: boolean
  outcome:
    | "updated"
    | "idempotent"
    | "expired"
    | "cancelled"
    | "missing"
    | "bad"
  message: string
}

export interface CrewShiftAssignmentConfirmationStatus {
  id: string
  status: CrewAssignmentConfirmationStatus
  sentAt: Date | null
  respondedAt: Date | null
  expiresAt: Date | null
  responseNote: string | null
  lastReminderAt: Date | null
  reminderCount: number
}

export interface UpdateCrewShiftAssignmentConfirmationStateInput {
  eventId: string
  assignmentId: string
  state: CrewAssignmentConfirmationOrganizerState
  responseNote?: string
}

export interface QueueCrewAssignmentConfirmationEmailsInput {
  eventId: string
  mode: CrewAssignmentConfirmationEmailOperationMode
}

export interface QueueCrewAssignmentConfirmationEmailsResult {
  mode: CrewAssignmentConfirmationEmailOperationMode
  queueAvailable: boolean
  eligible: number
  queued: number
  previewed: number
  failed: number
  skipped: ReturnType<
    typeof buildCrewAssignmentConfirmationEmailPlan
  >["skipped"]
}

export interface CrewAssignmentEmailSendPreview {
  mode: CrewAssignmentConfirmationEmailOperationMode
  eligible: number
  skipped: ReturnType<
    typeof buildCrewAssignmentConfirmationEmailPlan
  >["skipped"]
}

export type CrewAssignmentCommunicationState =
  | "not_ready"
  | "pending"
  | "sent"
  | "confirmed"
  | "declined"
  | "change_requested"
  | "no_show"
  | "replaced"

export interface CrewAssignmentCommunicationRow {
  volunteerName: string
  volunteerEmail: string | null
  shiftName: string
  roleLabel: string
  startsAt: Date
  endsAt: Date
  location: string | null
  state: CrewAssignmentCommunicationState
  sentAt: Date | null
  respondedAt: Date | null
  lastReminderAt: Date | null
  reminderCount: number
  responseNote: string | null
}

export interface CrewAssignmentCommunicationDashboard {
  event: {
    id: string
    name: string
    timezone: string | null
  }
  summary: {
    totalAssignments: number
    notReady: number
    pending: number
    sent: number
    confirmed: number
    declined: number
    changeRequested: number
    noResponse: number
    noShow: number
    replaced: number
  }
  previews: {
    assignmentEmails: CrewAssignmentEmailSendPreview
    reminderEmails: CrewAssignmentEmailSendPreview
  }
  rows: CrewAssignmentCommunicationRow[]
}

export type EnsureCrewShiftAssignmentConfirmationResult =
  | {
      id: string
      action: "existing"
      token: null
    }
  | {
      id: string
      action: "created"
      token: string
    }

interface PublicTokenInput {
  slug: string
  token: string
}

interface PublicTokenResponseInput extends PublicTokenInput {
  action: CrewAssignmentResponseAction
  responseNote?: string
}

export interface UpdateCrewAssignmentConfirmationContactTokenInput
  extends PublicTokenInput {
  email: string
  name?: string
  phone?: string
  availability?: VolunteerAvailability
  availabilityNotes?: string
  credentials?: string
}

interface CrewAssignmentEmailCandidate
  extends CrewAssignmentConfirmationEmailCandidate {
  tokenHash: string
  event: CrewConfirmationCompetition
  volunteer: { name: string; email: string }
  assignment: {
    id: string
    shiftName: string
    roleType: VolunteerRoleType
    roleLabel: string
    startTime: Date
    endTime: Date
    location: string | null
  }
}

export async function getCrewAssignmentConfirmationToken(
  data: PublicTokenInput,
): Promise<CrewAssignmentConfirmationTokenData> {
  return await getCrewAssignmentConfirmationByToken(data)
}

export async function respondCrewAssignmentConfirmationToken(
  data: PublicTokenResponseInput,
): Promise<CrewAssignmentConfirmationResponseResult> {
  const db = getDb()
  const tokenHash = await hashCrewAssignmentConfirmationToken(data.token)
  const responseState: {
    outcome: CrewAssignmentConfirmationResponseResult["outcome"]
    message: string
  } = {
    outcome: "missing",
    message: "Assignment confirmation link was not found.",
  }

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        event: {
          id: competitionsTable.id,
          organizingTeamId: competitionsTable.organizingTeamId,
          groupId: competitionsTable.groupId,
        },
        confirmation: crewAssignmentConfirmationsTable,
        assignment: {
          id: volunteerShiftAssignmentsTable.id,
          membershipId: volunteerShiftAssignmentsTable.membershipId,
        },
        shift: {
          roleType: volunteerShiftsTable.roleType,
        },
        membership: {
          userId: teamMembershipTable.userId,
          metadata: teamMembershipTable.metadata,
        },
        user: {
          email: userTable.email,
        },
      })
      .from(crewAssignmentConfirmationsTable)
      .innerJoin(
        competitionsTable,
        eq(
          crewAssignmentConfirmationsTable.competitionId,
          competitionsTable.id,
        ),
      )
      .innerJoin(
        crewEventSettingsTable,
        eq(crewEventSettingsTable.competitionId, competitionsTable.id),
      )
      .leftJoin(
        volunteerShiftAssignmentsTable,
        eq(
          crewAssignmentConfirmationsTable.assignmentId,
          volunteerShiftAssignmentsTable.id,
        ),
      )
      .leftJoin(
        volunteerShiftsTable,
        eq(volunteerShiftAssignmentsTable.shiftId, volunteerShiftsTable.id),
      )
      .leftJoin(
        teamMembershipTable,
        eq(volunteerShiftAssignmentsTable.membershipId, teamMembershipTable.id),
      )
      .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
      .where(
        and(
          eq(crewAssignmentConfirmationsTable.tokenHash, tokenHash),
          eq(competitionsTable.slug, data.slug),
          eq(crewEventSettingsTable.crewOnly, true),
          ne(crewEventSettingsTable.lifecycle, CREW_EVENT_LIFECYCLE.ARCHIVED),
        ),
      )
      .for("update")
      .limit(1)

    if (!row) {
      responseState.outcome = "missing"
      return
    }

    const tokenState = getCrewAssignmentConfirmationTokenState(row.confirmation)
    if (tokenState !== "valid") {
      responseState.outcome = tokenState
      responseState.message =
        tokenState === "expired"
          ? "This assignment response link has expired."
          : "This assignment response link is no longer valid."
      return
    }

    const resolution = resolveCrewAssignmentConfirmationResponse(
      row.confirmation,
      data.action,
      data.responseNote,
    )

    if (!resolution.ok) {
      responseState.outcome = resolution.reason
      responseState.message = resolution.message
      return
    }

    responseState.outcome = resolution.outcome
    responseState.message =
      resolution.outcome === "idempotent"
        ? "Your assignment response was already recorded."
        : getResponseSuccessMessage(data.action)

    if (resolution.outcome === "updated") {
      await tx
        .update(crewAssignmentConfirmationsTable)
        .set({
          status: resolution.status,
          responseNote: resolution.responseNote,
          respondedAt: resolution.respondedAt,
          updatedAt: resolution.respondedAt,
        })
        .where(eq(crewAssignmentConfirmationsTable.id, row.confirmation.id))

      const historyEventType = historyEventTypeForConfirmationStatus(
        resolution.status,
      )
      const metadata = parseCrewRosterMetadata(row.membership?.metadata)
      if (historyEventType) {
        await recordCrewVolunteerHistoryEvent({
          db: tx as unknown as DbClient,
          teamId: row.event.organizingTeamId,
          competitionId: row.event.id,
          groupId: row.event.groupId,
          eventType: historyEventType,
          identity: {
            userId: row.membership?.userId,
            email:
              metadata.signupEmail ?? row.confirmation.email ?? row.user?.email,
            phone: metadata.signupPhone,
            sourceMembershipId:
              row.assignment?.membershipId ??
              row.confirmation.membershipId ??
              null,
            identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.SELF_SERVICE,
          },
          assignmentType:
            CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE.VOLUNTEER_SHIFT,
          assignmentId: row.assignment?.id ?? row.confirmation.assignmentId,
          roleType: row.shift?.roleType,
          occurredAt: resolution.respondedAt,
          sourceType: "crew_assignment_confirmation",
          sourceId: row.confirmation.id,
        })
      }
    }
  })

  const freshData = await getCrewAssignmentConfirmationByToken(data)

  return {
    ...freshData,
    success:
      responseState.outcome === "updated" ||
      responseState.outcome === "idempotent",
    outcome: responseState.outcome,
    message: responseState.message,
  }
}

export async function updateCrewAssignmentConfirmationContactToken(
  data: UpdateCrewAssignmentConfirmationContactTokenInput,
): Promise<CrewAssignmentConfirmationContactUpdateResult> {
  const db = getDb()
  const tokenHash = await hashCrewAssignmentConfirmationToken(data.token)
  const responseState: {
    outcome: CrewAssignmentConfirmationContactUpdateResult["outcome"]
    message: string
  } = {
    outcome: "missing",
    message: "Assignment confirmation link was not found.",
  }

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        competitionTeamId: competitionsTable.competitionTeamId,
        confirmation: crewAssignmentConfirmationsTable,
        assignment: {
          id: volunteerShiftAssignmentsTable.id,
          membershipId: volunteerShiftAssignmentsTable.membershipId,
        },
        membership: {
          id: teamMembershipTable.id,
          metadata: teamMembershipTable.metadata,
        },
      })
      .from(crewAssignmentConfirmationsTable)
      .innerJoin(
        competitionsTable,
        eq(
          crewAssignmentConfirmationsTable.competitionId,
          competitionsTable.id,
        ),
      )
      .innerJoin(
        crewEventSettingsTable,
        eq(crewEventSettingsTable.competitionId, competitionsTable.id),
      )
      .leftJoin(
        volunteerShiftAssignmentsTable,
        eq(
          crewAssignmentConfirmationsTable.assignmentId,
          volunteerShiftAssignmentsTable.id,
        ),
      )
      .leftJoin(
        teamMembershipTable,
        eq(volunteerShiftAssignmentsTable.membershipId, teamMembershipTable.id),
      )
      .where(
        and(
          eq(crewAssignmentConfirmationsTable.tokenHash, tokenHash),
          eq(
            crewAssignmentConfirmationsTable.assignmentType,
            CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
          ),
          eq(competitionsTable.slug, data.slug),
          eq(crewEventSettingsTable.crewOnly, true),
          ne(crewEventSettingsTable.lifecycle, CREW_EVENT_LIFECYCLE.ARCHIVED),
        ),
      )
      .for("update")
      .limit(1)

    if (!row) {
      responseState.outcome = "missing"
      return
    }

    if (
      row.confirmation.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED
    ) {
      responseState.outcome = "cancelled"
      responseState.message = "This assignment confirmation has been cancelled."
      return
    }

    const tokenState = getCrewAssignmentConfirmationTokenState(row.confirmation)
    if (tokenState !== "valid") {
      responseState.outcome = tokenState === "expired" ? "expired" : "bad"
      responseState.message =
        tokenState === "expired"
          ? "This assignment link has expired."
          : "This assignment link is no longer valid."
      return
    }

    if (
      !row.assignment?.id ||
      !row.assignment.membershipId ||
      !row.membership?.id
    ) {
      responseState.outcome = "bad"
      responseState.message = "This assignment link is no longer valid."
      return
    }

    const resolution = resolveCrewVolunteerSelfServiceContactUpdate(
      row.membership.metadata,
      data,
    )

    if (!resolution.changed) {
      responseState.outcome = "idempotent"
      responseState.message = "Your contact details were already up to date."
      return
    }

    const updatedAt = new Date()
    const updateResult = await tx
      .update(teamMembershipTable)
      .set({
        metadata: JSON.stringify(resolution.metadata),
        updatedAt,
      })
      .where(
        and(
          eq(teamMembershipTable.id, row.assignment.membershipId),
          eq(teamMembershipTable.teamId, row.competitionTeamId),
          eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
          eq(teamMembershipTable.isSystemRole, true),
        ),
      )

    if (getAffectedRows(updateResult) === 0) {
      responseState.outcome = "bad"
      responseState.message = "This assignment link is no longer valid."
      return
    }

    responseState.outcome = "updated"
    responseState.message = "Contact details updated."
  })

  const freshData = await getCrewAssignmentConfirmationByToken(data)

  return {
    ...freshData,
    success:
      responseState.outcome === "updated" ||
      responseState.outcome === "idempotent",
    outcome: responseState.outcome,
    message: responseState.message,
  }
}

export async function ensureCrewShiftAssignmentConfirmation(params: {
  db: DbClient
  competitionId: string
  assignmentId: string
  membershipId: string
  email: string | null
  expiresAt: Date
  now?: Date
}): Promise<EnsureCrewShiftAssignmentConfirmationResult> {
  const now = params.now ?? new Date()
  return await withCrewAssignmentConfirmationLock(
    params.db,
    params.assignmentId,
    async () => {
      const [existing] = await params.db
        .select({
          id: crewAssignmentConfirmationsTable.id,
          status: crewAssignmentConfirmationsTable.status,
        })
        .from(crewAssignmentConfirmationsTable)
        .where(
          and(
            eq(
              crewAssignmentConfirmationsTable.assignmentType,
              CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
            ),
            eq(
              crewAssignmentConfirmationsTable.assignmentId,
              params.assignmentId,
            ),
            ne(
              crewAssignmentConfirmationsTable.status,
              CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
            ),
          ),
        )
        .limit(1)

      if (existing) {
        return { id: existing.id, action: "existing", token: null }
      }

      const token = generateCrewAssignmentConfirmationToken()
      const tokenHash = await hashCrewAssignmentConfirmationToken(token)
      const confirmationId = createCrewAssignmentConfirmationId()

      await params.db.insert(crewAssignmentConfirmationsTable).values({
        id: confirmationId,
        competitionId: params.competitionId,
        assignmentType: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        assignmentId: params.assignmentId,
        membershipId: params.membershipId,
        email: params.email,
        tokenHash,
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
        expiresAt: params.expiresAt,
        createdAt: now,
        updatedAt: now,
      })

      return { id: confirmationId, action: "created", token }
    },
  )
}

export async function cancelCrewShiftAssignmentConfirmations(params: {
  db: DbClient
  assignmentIds: string[]
  now?: Date
}) {
  if (params.assignmentIds.length === 0) return

  const now = params.now ?? new Date()
  await params.db
    .update(crewAssignmentConfirmationsTable)
    .set({
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
      updatedAt: now,
    })
    .where(
      and(
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        ),
        inArray(
          crewAssignmentConfirmationsTable.assignmentId,
          params.assignmentIds,
        ),
        eq(
          crewAssignmentConfirmationsTable.status,
          CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
        ),
      ),
    )
}

export async function loadCrewShiftAssignmentConfirmationMap(
  db: DbClient,
  assignmentIds: string[],
) {
  if (assignmentIds.length === 0) {
    return new Map<string, CrewShiftAssignmentConfirmationStatus>()
  }

  const rows = await db
    .select({
      assignmentId: crewAssignmentConfirmationsTable.assignmentId,
      id: crewAssignmentConfirmationsTable.id,
      status: crewAssignmentConfirmationsTable.status,
      sentAt: crewAssignmentConfirmationsTable.sentAt,
      respondedAt: crewAssignmentConfirmationsTable.respondedAt,
      expiresAt: crewAssignmentConfirmationsTable.expiresAt,
      responseNote: crewAssignmentConfirmationsTable.responseNote,
      lastReminderAt: crewAssignmentConfirmationsTable.lastReminderAt,
      reminderCount: crewAssignmentConfirmationsTable.reminderCount,
      updatedAt: crewAssignmentConfirmationsTable.updatedAt,
    })
    .from(crewAssignmentConfirmationsTable)
    .where(
      and(
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        ),
        inArray(crewAssignmentConfirmationsTable.assignmentId, assignmentIds),
      ),
    )
    .orderBy(desc(crewAssignmentConfirmationsTable.updatedAt))

  const byAssignment = new Map<string, CrewShiftAssignmentConfirmationStatus>()
  for (const row of rows) {
    if (byAssignment.has(row.assignmentId)) continue
    byAssignment.set(row.assignmentId, {
      id: row.id,
      status: row.status,
      sentAt: row.sentAt,
      respondedAt: row.respondedAt,
      expiresAt: row.expiresAt,
      responseNote: row.responseNote,
      lastReminderAt: row.lastReminderAt,
      reminderCount: row.reminderCount,
    })
  }
  return byAssignment
}

export async function updateCrewShiftAssignmentConfirmationState(
  data: UpdateCrewShiftAssignmentConfirmationStateInput,
) {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const db = getDb()
  const now = new Date()

  return await db.transaction(async (tx) => {
    const [assignment] = await tx
      .select({
        assignmentId: volunteerShiftAssignmentsTable.id,
        shiftId: volunteerShiftAssignmentsTable.shiftId,
        membershipId: volunteerShiftAssignmentsTable.membershipId,
        competitionId: volunteerShiftsTable.competitionId,
        shiftRoleType: volunteerShiftsTable.roleType,
        shiftStartTime: volunteerShiftsTable.startTime,
        shiftEndTime: volunteerShiftsTable.endTime,
        shiftLocation: volunteerShiftsTable.location,
        membershipMetadata: teamMembershipTable.metadata,
        membershipUserId: teamMembershipTable.userId,
        userEmail: userTable.email,
      })
      .from(volunteerShiftAssignmentsTable)
      .innerJoin(
        volunteerShiftsTable,
        eq(volunteerShiftAssignmentsTable.shiftId, volunteerShiftsTable.id),
      )
      .leftJoin(
        teamMembershipTable,
        eq(volunteerShiftAssignmentsTable.membershipId, teamMembershipTable.id),
      )
      .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
      .where(
        and(
          eq(volunteerShiftAssignmentsTable.id, data.assignmentId),
          eq(volunteerShiftsTable.competitionId, data.eventId),
        ),
      )
      .for("update")
      .limit(1)

    if (!assignment) {
      throw new Error("Shift assignment not found")
    }
    assertCrewDepartmentLeadCanManageShift(access, {
      roleType: assignment.shiftRoleType,
      startTime: assignment.shiftStartTime,
      endTime: assignment.shiftEndTime,
      location: assignment.shiftLocation,
    })

    const [latestConfirmation] = await tx
      .select({
        id: crewAssignmentConfirmationsTable.id,
        status: crewAssignmentConfirmationsTable.status,
        sentAt: crewAssignmentConfirmationsTable.sentAt,
      })
      .from(crewAssignmentConfirmationsTable)
      .where(
        and(
          eq(
            crewAssignmentConfirmationsTable.assignmentType,
            CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
          ),
          eq(
            crewAssignmentConfirmationsTable.assignmentId,
            assignment.assignmentId,
          ),
        ),
      )
      .orderBy(desc(crewAssignmentConfirmationsTable.updatedAt))
      .limit(1)

    let confirmation = latestConfirmation ?? null
    if (
      !confirmation ||
      (confirmation.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED &&
        data.state !== "replaced")
    ) {
      const metadata = parseCrewRosterMetadata(assignment.membershipMetadata)
      const token = generateCrewAssignmentConfirmationToken()
      const tokenHash = await hashCrewAssignmentConfirmationToken(token)
      const confirmationId = createCrewAssignmentConfirmationId()

      await tx.insert(crewAssignmentConfirmationsTable).values({
        id: confirmationId,
        competitionId: assignment.competitionId,
        assignmentType: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        assignmentId: assignment.assignmentId,
        membershipId: assignment.membershipId,
        email:
          normalizeConfirmationEmail(metadata.signupEmail) ??
          normalizeConfirmationEmail(assignment.userEmail),
        tokenHash,
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
        expiresAt: getAssignmentConfirmationExpiry(now),
        createdAt: now,
        updatedAt: now,
      })

      confirmation = {
        id: confirmationId,
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
        sentAt: null,
      }
    }

    const update = resolveCrewAssignmentConfirmationOrganizerStateUpdate(
      data.state,
      data.responseNote,
      now,
      confirmation,
    )

    await tx
      .update(crewAssignmentConfirmationsTable)
      .set({
        status: update.status,
        sentAt: update.sentAt,
        respondedAt: update.respondedAt,
        responseNote: update.responseNote,
        updatedAt: now,
      })
      .where(eq(crewAssignmentConfirmationsTable.id, confirmation.id))

    const historyEventType = historyEventTypeForOrganizerState(
      data.state,
      update.status,
    )
    if (historyEventType) {
      const metadata = parseCrewRosterMetadata(assignment.membershipMetadata)
      await recordCrewVolunteerHistoryEvent({
        db: tx as unknown as DbClient,
        teamId: event.organizingTeamId,
        competitionId: event.id,
        groupId: event.groupId,
        eventType: historyEventType,
        identity: {
          userId: assignment.membershipUserId,
          email: metadata.signupEmail ?? assignment.userEmail,
          phone: metadata.signupPhone,
          sourceMembershipId: assignment.membershipId,
          identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.MEMBERSHIP,
        },
        assignmentType: CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE.VOLUNTEER_SHIFT,
        assignmentId: assignment.assignmentId,
        roleType: assignment.shiftRoleType,
        occurredAt: update.respondedAt ?? now,
        sourceType: "crew_assignment_confirmation",
        sourceId: confirmation.id,
        sourceUserId: null,
      })
    }

    return {
      success: true,
      confirmation: {
        id: confirmation.id,
        status: update.status,
        sentAt: update.sentAt,
        respondedAt: update.respondedAt,
        responseNote: update.responseNote,
      },
    }
  })
}

export async function queueCrewAssignmentConfirmationEmails(
  data: QueueCrewAssignmentConfirmationEmailsInput,
): Promise<QueueCrewAssignmentConfirmationEmailsResult> {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const db = getDb()
  const now = new Date()
  const candidates = filterCrewAssignmentEmailCandidates(
    await loadCrewAssignmentEmailCandidates(data.eventId),
    access,
  )
  const plan = buildCrewAssignmentConfirmationEmailPlan({
    mode: data.mode,
    candidates,
    now,
  })
  const candidatesByConfirmationId = new Map(
    candidates.map((candidate) => [candidate.confirmationId, candidate]),
  )
  const queue = (env as unknown as Record<string, unknown>)
    .BROADCAST_EMAIL_QUEUE as Queue<CrewAssignmentEmailQueueMessage> | undefined

  let queued = 0
  let previewed = 0
  let failed = 0

  for (const operation of plan.operations) {
    const candidate = candidatesByConfirmationId.get(operation.confirmationId)
    if (!candidate) {
      failed += 1
      continue
    }

    try {
      const token = generateCrewAssignmentConfirmationToken()
      const tokenHash = await hashCrewAssignmentConfirmationToken(token)
      const expiresAt = getAssignmentConfirmationExpiry(now)
      const message = await buildCrewAssignmentEmailQueueMessage({
        operation,
        event: candidate.event,
        volunteer: candidate.volunteer,
        assignment: candidate.assignment,
        token,
        queuedAt: now,
      })

      if (!queue) {
        console.log(
          `[CrewEmail Preview] To: ${message.email} | Subject: ${message.subject} | Confirmation: ${message.confirmationId}`,
        )
        previewed += 1
        continue
      }

      const claimed = await withCrewAssignmentConfirmationLock(
        db,
        operation.assignmentId,
        async () => {
          const tokenClaimed = await claimCrewAssignmentEmailToken({
            db,
            operation,
            previousTokenHash: candidate.tokenHash,
            tokenHash,
            expiresAt,
            claimedAt: now,
          })
          if (!tokenClaimed) return false

          await queue.send(message)

          const finalized = await finalizeCrewAssignmentEmailQueued({
            db,
            operation,
            tokenHash,
            queuedAt: now,
          })
          if (!finalized) {
            throw new Error("Queued assignment email could not be finalized")
          }

          return true
        },
      )
      if (!claimed) {
        if (operation.kind === "confirmation") {
          plan.skipped.alreadySent += 1
        } else {
          plan.skipped.notDue += 1
        }
        continue
      }

      queued += 1
    } catch (error) {
      console.error("[CrewEmail] Failed to queue assignment email", {
        error,
        confirmationId: operation.confirmationId,
        assignmentId: operation.assignmentId,
      })
      failed += 1
    }
  }

  return {
    mode: data.mode,
    queueAvailable: Boolean(queue),
    eligible: plan.operations.length,
    queued,
    previewed,
    failed,
    skipped: plan.skipped,
  }
}

export async function getCrewAssignmentCommunicationDashboard(data: {
  eventId: string
}): Promise<CrewAssignmentCommunicationDashboard> {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const [eventDetail] = await getDb()
    .select({ name: competitionsTable.name })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, data.eventId))
    .limit(1)
  const [assignments, candidates] = await Promise.all([
    loadCrewAssignmentCommunicationRows(data.eventId, access),
    loadCrewAssignmentEmailCandidates(data.eventId).then((rows) =>
      filterCrewAssignmentEmailCandidates(rows, access),
    ),
  ])
  const now = new Date()
  const assignmentEmails = buildCrewAssignmentConfirmationEmailPlan({
    mode: "confirmations",
    candidates,
    now,
  })
  const reminderEmails = buildCrewAssignmentConfirmationEmailPlan({
    mode: "reminders",
    candidates,
    now,
  })

  return {
    event: {
      id: event.id,
      name: eventDetail?.name ?? "Crew confirmations",
      timezone: event.timezone,
    },
    summary: summarizeCrewAssignmentCommunicationRows(assignments),
    previews: {
      assignmentEmails: toCrewAssignmentEmailSendPreview(
        "confirmations",
        assignmentEmails,
      ),
      reminderEmails: toCrewAssignmentEmailSendPreview(
        "reminders",
        reminderEmails,
      ),
    },
    rows: assignments,
  }
}

export function summarizeCrewShiftAssignmentConfirmations(
  confirmations: Array<CrewShiftAssignmentConfirmationStatus | null>,
): CrewAssignmentConfirmationStatusSummary {
  return summarizeCrewAssignmentConfirmations(
    confirmations.map((confirmation) => confirmation?.status),
  )
}

export async function buildCrewAssignmentConfirmationEmailMessage(params: {
  confirmationId: string
  event: CrewConfirmationCompetition
  volunteer: { name: string; email: string }
  assignment: {
    id: string
    shiftName: string
    roleLabel: string
    startTime: Date
    endTime: Date
    location: string | null
  }
  token: string
}) {
  return buildCrewAssignmentEmailQueueMessage({
    operation: {
      kind: "confirmation",
      confirmationId: params.confirmationId,
      assignmentId: params.assignment.id,
      email: params.volunteer.email,
      reminderCount: 0,
      idempotencyKey: buildCrewAssignmentEmailIdempotencyKey(
        params.confirmationId,
        0,
      ),
    },
    event: params.event,
    volunteer: params.volunteer,
    assignment: params.assignment,
    token: params.token,
    queuedAt: new Date(),
  })
}

async function loadCrewAssignmentCommunicationRows(
  eventId: string,
  access: CrewDepartmentLeadAccess,
): Promise<CrewAssignmentCommunicationRow[]> {
  const db = getDb()
  const assignmentRows = await db
    .select({
      assignment: {
        id: volunteerShiftAssignmentsTable.id,
        membershipId: volunteerShiftAssignmentsTable.membershipId,
      },
      shift: {
        id: volunteerShiftsTable.id,
        name: volunteerShiftsTable.name,
        roleType: volunteerShiftsTable.roleType,
        startTime: volunteerShiftsTable.startTime,
        endTime: volunteerShiftsTable.endTime,
        location: volunteerShiftsTable.location,
      },
      membership: {
        metadata: teamMembershipTable.metadata,
      },
      user: {
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        email: userTable.email,
      },
    })
    .from(volunteerShiftAssignmentsTable)
    .innerJoin(
      volunteerShiftsTable,
      eq(volunteerShiftAssignmentsTable.shiftId, volunteerShiftsTable.id),
    )
    .leftJoin(
      teamMembershipTable,
      eq(volunteerShiftAssignmentsTable.membershipId, teamMembershipTable.id),
    )
    .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(eq(volunteerShiftsTable.competitionId, eventId))
    .orderBy(
      asc(volunteerShiftsTable.startTime),
      asc(volunteerShiftsTable.name),
    )

  const visibleAssignments =
    access.kind === "full"
      ? assignmentRows
      : filterCrewDepartmentLeadShifts(
          assignmentRows.map((row) => ({
            ...row,
            roleType: row.shift.roleType,
            startTime: row.shift.startTime,
            endTime: row.shift.endTime,
            location: row.shift.location,
          })),
          access,
        )
  const confirmationMap = await loadCrewShiftAssignmentConfirmationMap(
    db,
    visibleAssignments.map((row) => row.assignment.id),
  )

  return visibleAssignments.map((row) => {
    const metadata = parseCrewRosterMetadata(row.membership?.metadata)
    const email =
      normalizeConfirmationEmailForSend(metadata.signupEmail) ??
      normalizeConfirmationEmailForSend(row.user?.email)
    const volunteerName =
      metadata.signupName ||
      [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" ") ||
      email ||
      "Volunteer"
    const confirmation = confirmationMap.get(row.assignment.id) ?? null
    const operationalState =
      getCrewAssignmentConfirmationOperationalState(confirmation)

    return {
      volunteerName,
      volunteerEmail: email,
      shiftName: row.shift.name,
      roleLabel: formatVolunteerRole(row.shift.roleType),
      startsAt: row.shift.startTime,
      endsAt: row.shift.endTime,
      location: row.shift.location,
      state:
        operationalState === "missing"
          ? "not_ready"
          : (operationalState as CrewAssignmentCommunicationState),
      sentAt: confirmation?.sentAt ?? null,
      respondedAt: confirmation?.respondedAt ?? null,
      lastReminderAt: confirmation?.lastReminderAt ?? null,
      reminderCount: confirmation?.reminderCount ?? 0,
      responseNote: confirmation?.responseNote ?? null,
    }
  })
}

function summarizeCrewAssignmentCommunicationRows(
  rows: CrewAssignmentCommunicationRow[],
): CrewAssignmentCommunicationDashboard["summary"] {
  const summary = {
    totalAssignments: rows.length,
    notReady: 0,
    pending: 0,
    sent: 0,
    confirmed: 0,
    declined: 0,
    changeRequested: 0,
    noResponse: 0,
    noShow: 0,
    replaced: 0,
  }

  for (const row of rows) {
    if (row.state === "not_ready") summary.notReady += 1
    else if (row.state === "pending") summary.pending += 1
    else if (row.state === "sent") summary.sent += 1
    else if (row.state === "confirmed") summary.confirmed += 1
    else if (row.state === "declined") summary.declined += 1
    else if (row.state === "change_requested") summary.changeRequested += 1
    else if (row.state === "no_show") summary.noShow += 1
    else summary.replaced += 1
  }

  summary.noResponse = summary.notReady + summary.pending + summary.sent
  return summary
}

function toCrewAssignmentEmailSendPreview(
  mode: CrewAssignmentConfirmationEmailOperationMode,
  plan: ReturnType<typeof buildCrewAssignmentConfirmationEmailPlan>,
): CrewAssignmentEmailSendPreview {
  return {
    mode,
    eligible: plan.operations.length,
    skipped: plan.skipped,
  }
}

async function buildCrewAssignmentEmailQueueMessage(params: {
  operation: CrewAssignmentConfirmationEmailOperation
  event: CrewConfirmationCompetition
  volunteer: { name: string; email: string }
  assignment: {
    id: string
    shiftName: string
    roleLabel: string
    startTime: Date
    endTime: Date
    location: string | null
  }
  token: string
  queuedAt: Date
}) {
  const urls = buildCrewAssignmentConfirmationUrls({
    appUrl: getAppUrl(),
    slug: params.event.slug,
    token: params.token,
  })
  const timezone = params.event.timezone ?? DEFAULT_TIMEZONE
  const templateProps = {
    eventName: params.event.name,
    volunteerName: params.volunteer.name,
    shiftName: params.assignment.shiftName,
    roleLabel: params.assignment.roleLabel,
    startsAtLabel: formatDateTimeInTimezone(
      params.assignment.startTime,
      timezone,
      "EEE, MMM d h:mm a",
    ),
    endsAtLabel: formatDateTimeInTimezone(
      params.assignment.endTime,
      timezone,
      "h:mm a",
    ),
    location: params.assignment.location,
    confirmUrl: urls.confirmUrl,
    scheduleUrl: urls.scheduleUrl,
  }
  const subject =
    params.operation.kind === "confirmation"
      ? `${params.event.name}: confirm ${params.assignment.shiftName}`
      : `${params.event.name}: reminder for ${params.assignment.shiftName}`
  const template =
    params.operation.kind === "reminder-24-hour"
      ? CrewAssignmentReminder24HourEmail(templateProps)
      : params.operation.kind === "reminder-48-hour"
        ? CrewAssignmentReminder48HourEmail(templateProps)
        : CrewAssignmentConfirmationEmail(templateProps)
  const bodyHtml = await render(template)

  return {
    kind:
      params.operation.kind === "confirmation"
        ? "crew-assignment-confirmation"
        : "crew-assignment-reminder",
    confirmationId: params.operation.confirmationId,
    assignmentId: params.operation.assignmentId,
    competitionId: params.event.id,
    email: params.volunteer.email,
    subject,
    bodyHtml,
    idempotencyKey: params.operation.idempotencyKey,
    reminderCount: params.operation.reminderCount,
    queuedAtIso: params.queuedAt.toISOString(),
  } satisfies CrewAssignmentEmailQueueMessage
}

async function loadCrewAssignmentEmailCandidates(
  eventId: string,
): Promise<CrewAssignmentEmailCandidate[]> {
  const db = getDb()
  const rows = await db
    .select({
      event: {
        id: competitionsTable.id,
        slug: competitionsTable.slug,
        name: competitionsTable.name,
        timezone: competitionsTable.timezone,
        startDate: competitionsTable.startDate,
        endDate: competitionsTable.endDate,
      },
      confirmation: {
        id: crewAssignmentConfirmationsTable.id,
        assignmentId: crewAssignmentConfirmationsTable.assignmentId,
        tokenHash: crewAssignmentConfirmationsTable.tokenHash,
        status: crewAssignmentConfirmationsTable.status,
        email: crewAssignmentConfirmationsTable.email,
        sentAt: crewAssignmentConfirmationsTable.sentAt,
        respondedAt: crewAssignmentConfirmationsTable.respondedAt,
        lastReminderAt: crewAssignmentConfirmationsTable.lastReminderAt,
        reminderCount: crewAssignmentConfirmationsTable.reminderCount,
      },
      shift: {
        id: volunteerShiftsTable.id,
        name: volunteerShiftsTable.name,
        roleType: volunteerShiftsTable.roleType,
        startTime: volunteerShiftsTable.startTime,
        endTime: volunteerShiftsTable.endTime,
        location: volunteerShiftsTable.location,
      },
      membership: {
        metadata: teamMembershipTable.metadata,
      },
      user: {
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        email: userTable.email,
      },
    })
    .from(crewAssignmentConfirmationsTable)
    .innerJoin(
      competitionsTable,
      eq(crewAssignmentConfirmationsTable.competitionId, competitionsTable.id),
    )
    .innerJoin(
      crewEventSettingsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .innerJoin(
      volunteerShiftAssignmentsTable,
      eq(
        crewAssignmentConfirmationsTable.assignmentId,
        volunteerShiftAssignmentsTable.id,
      ),
    )
    .innerJoin(
      volunteerShiftsTable,
      eq(volunteerShiftAssignmentsTable.shiftId, volunteerShiftsTable.id),
    )
    .leftJoin(
      teamMembershipTable,
      eq(volunteerShiftAssignmentsTable.membershipId, teamMembershipTable.id),
    )
    .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(crewAssignmentConfirmationsTable.competitionId, eventId),
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        ),
        eq(crewEventSettingsTable.crewOnly, true),
        ne(crewEventSettingsTable.lifecycle, CREW_EVENT_LIFECYCLE.ARCHIVED),
      ),
    )

  return rows.map((row) => {
    const metadata = parseCrewRosterMetadata(row.membership?.metadata)
    const email =
      normalizeConfirmationEmailForSend(metadata.signupEmail) ??
      normalizeConfirmationEmailForSend(row.confirmation.email) ??
      normalizeConfirmationEmailForSend(row.user?.email)
    const volunteerName =
      metadata.signupName ||
      [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" ") ||
      email ||
      "Volunteer"

    return {
      confirmationId: row.confirmation.id,
      assignmentId: row.confirmation.assignmentId,
      tokenHash: row.confirmation.tokenHash,
      status: row.confirmation.status,
      email,
      sentAt: row.confirmation.sentAt,
      respondedAt: row.confirmation.respondedAt,
      lastReminderAt: row.confirmation.lastReminderAt,
      reminderCount: row.confirmation.reminderCount,
      shiftStartTime: row.shift.startTime,
      event: row.event,
      volunteer: {
        name: volunteerName,
        email: email ?? "",
      },
      assignment: {
        id: row.confirmation.assignmentId,
        shiftName: row.shift.name,
        roleLabel: formatVolunteerRole(row.shift.roleType),
        roleType: row.shift.roleType,
        startTime: row.shift.startTime,
        endTime: row.shift.endTime,
        location: row.shift.location,
      },
    }
  })
}

function filterCrewAssignmentEmailCandidates(
  candidates: CrewAssignmentEmailCandidate[],
  access: CrewDepartmentLeadAccess,
) {
  if (access.kind === "full") return candidates
  return filterCrewDepartmentLeadShifts(
    candidates.map((candidate) => ({
      ...candidate,
      roleType: candidate.assignment.roleType,
      startTime: candidate.assignment.startTime,
      endTime: candidate.assignment.endTime,
      location: candidate.assignment.location,
    })),
    access,
  )
}

async function claimCrewAssignmentEmailToken(params: {
  db: DbClient
  operation: CrewAssignmentConfirmationEmailOperation
  previousTokenHash: string
  tokenHash: string
  expiresAt: Date
  claimedAt: Date
}) {
  const commonWhere = [
    eq(crewAssignmentConfirmationsTable.id, params.operation.confirmationId),
    eq(
      crewAssignmentConfirmationsTable.status,
      CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
    ),
    eq(crewAssignmentConfirmationsTable.tokenHash, params.previousTokenHash),
  ] as const

  if (params.operation.kind === "confirmation") {
    const result = await params.db
      .update(crewAssignmentConfirmationsTable)
      .set({
        tokenHash: params.tokenHash,
        expiresAt: params.expiresAt,
        updatedAt: params.claimedAt,
      })
      .where(
        and(...commonWhere, isNull(crewAssignmentConfirmationsTable.sentAt)),
      )
    return getAffectedRows(result) > 0
  }

  const result = await params.db
    .update(crewAssignmentConfirmationsTable)
    .set({
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
      updatedAt: params.claimedAt,
    })
    .where(
      and(
        ...commonWhere,
        isNotNull(crewAssignmentConfirmationsTable.sentAt),
        lt(
          crewAssignmentConfirmationsTable.reminderCount,
          params.operation.reminderCount,
        ),
      ),
    )
  return getAffectedRows(result) > 0
}

async function finalizeCrewAssignmentEmailQueued(params: {
  db: DbClient
  operation: CrewAssignmentConfirmationEmailOperation
  tokenHash: string
  queuedAt: Date
}) {
  const commonWhere = [
    eq(crewAssignmentConfirmationsTable.id, params.operation.confirmationId),
    eq(
      crewAssignmentConfirmationsTable.status,
      CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
    ),
    eq(crewAssignmentConfirmationsTable.tokenHash, params.tokenHash),
  ] as const

  if (params.operation.kind === "confirmation") {
    const result = await params.db
      .update(crewAssignmentConfirmationsTable)
      .set({
        sentAt: params.queuedAt,
        updatedAt: params.queuedAt,
      })
      .where(
        and(...commonWhere, isNull(crewAssignmentConfirmationsTable.sentAt)),
      )
    return getAffectedRows(result) > 0
  }

  const result = await params.db
    .update(crewAssignmentConfirmationsTable)
    .set({
      lastReminderAt: params.queuedAt,
      reminderCount: params.operation.reminderCount,
      updatedAt: params.queuedAt,
    })
    .where(
      and(
        ...commonWhere,
        isNotNull(crewAssignmentConfirmationsTable.sentAt),
        lt(
          crewAssignmentConfirmationsTable.reminderCount,
          params.operation.reminderCount,
        ),
      ),
    )
  return getAffectedRows(result) > 0
}

function getAffectedRows(result: unknown) {
  return Number(
    (result as { rowsAffected?: number }).rowsAffected ??
      (result as { affectedRows?: number }).affectedRows ??
      (Array.isArray(result)
        ? (result[0] as { affectedRows?: number } | undefined)?.affectedRows
        : undefined) ??
      0,
  )
}

async function getCrewAssignmentConfirmationByToken({
  slug,
  token,
}: {
  slug: string
  token: string
}): Promise<CrewAssignmentConfirmationTokenData> {
  const db = getDb()
  const tokenHash = await hashCrewAssignmentConfirmationToken(token)
  const [row] = await db
    .select({
      event: {
        id: competitionsTable.id,
        slug: competitionsTable.slug,
        name: competitionsTable.name,
        timezone: competitionsTable.timezone,
        startDate: competitionsTable.startDate,
        endDate: competitionsTable.endDate,
      },
      confirmation: {
        id: crewAssignmentConfirmationsTable.id,
        status: crewAssignmentConfirmationsTable.status,
        sentAt: crewAssignmentConfirmationsTable.sentAt,
        respondedAt: crewAssignmentConfirmationsTable.respondedAt,
        expiresAt: crewAssignmentConfirmationsTable.expiresAt,
        responseNote: crewAssignmentConfirmationsTable.responseNote,
        tokenHash: crewAssignmentConfirmationsTable.tokenHash,
      },
      shift: {
        id: volunteerShiftsTable.id,
        name: volunteerShiftsTable.name,
        roleType: volunteerShiftsTable.roleType,
        startTime: volunteerShiftsTable.startTime,
        endTime: volunteerShiftsTable.endTime,
        location: volunteerShiftsTable.location,
        notes: volunteerShiftsTable.notes,
      },
      assignment: {
        id: volunteerShiftAssignmentsTable.id,
        membershipId: volunteerShiftAssignmentsTable.membershipId,
        notes: volunteerShiftAssignmentsTable.notes,
      },
      confirmationEmail: crewAssignmentConfirmationsTable.email,
      membership: {
        id: teamMembershipTable.id,
        metadata: teamMembershipTable.metadata,
      },
      user: {
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        email: userTable.email,
      },
    })
    .from(crewAssignmentConfirmationsTable)
    .innerJoin(
      competitionsTable,
      eq(crewAssignmentConfirmationsTable.competitionId, competitionsTable.id),
    )
    .innerJoin(
      crewEventSettingsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .leftJoin(
      volunteerShiftAssignmentsTable,
      eq(
        crewAssignmentConfirmationsTable.assignmentId,
        volunteerShiftAssignmentsTable.id,
      ),
    )
    .leftJoin(
      volunteerShiftsTable,
      eq(volunteerShiftAssignmentsTable.shiftId, volunteerShiftsTable.id),
    )
    .leftJoin(
      teamMembershipTable,
      eq(volunteerShiftAssignmentsTable.membershipId, teamMembershipTable.id),
    )
    .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(crewAssignmentConfirmationsTable.tokenHash, tokenHash),
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        ),
        eq(competitionsTable.slug, slug),
        eq(crewEventSettingsTable.crewOnly, true),
        ne(crewEventSettingsTable.lifecycle, CREW_EVENT_LIFECYCLE.ARCHIVED),
      ),
    )
    .limit(1)

  if (!row) {
    return emptyTokenData("missing")
  }

  const tokenState = getCrewAssignmentConfirmationTokenState(row.confirmation)
  const status =
    tokenState === "valid" && (!row.assignment?.id || !row.shift?.id)
      ? "bad"
      : tokenState
  if (status !== "valid") {
    return {
      status,
      event: row.event,
      volunteer: null,
      assignment: null,
      confirmation: toConfirmationDisplay(row.confirmation),
      schedule: [],
    }
  }

  const assignment = row.assignment
  const shift = row.shift
  if (!assignment || !shift) {
    return {
      status: "bad",
      event: row.event,
      volunteer: null,
      assignment: null,
      confirmation: toConfirmationDisplay(row.confirmation),
      schedule: [],
    }
  }

  const metadata = parseCrewRosterMetadata(row.membership?.metadata)
  const name =
    metadata.signupName ||
    [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" ") ||
    row.user?.email ||
    row.confirmationEmail ||
    "Volunteer"
  const email =
    metadata.signupEmail ?? row.confirmationEmail ?? row.user?.email ?? ""
  const schedule = await loadCrewVolunteerSelfServiceSchedule({
    db,
    competitionId: row.event.id,
    membershipId: assignment.membershipId,
    tokenAssignmentId: assignment.id,
  })

  return {
    status,
    event: row.event,
    volunteer: {
      name,
      email,
      phone: metadata.signupPhone ?? null,
      availability: metadata.availability ?? null,
      availabilityNotes: metadata.availabilityNotes ?? null,
      credentials: metadata.credentials ?? null,
      roleTypes: getCrewRosterRoleTypes(metadata.volunteerRoleTypes),
    },
    assignment: {
      id: assignment.id,
      shiftId: shift.id,
      name: shift.name,
      roleType: shift.roleType,
      roleLabel: formatVolunteerRole(shift.roleType),
      startTime: shift.startTime,
      endTime: shift.endTime,
      location: shift.location,
      notes: assignment.notes ?? shift.notes,
    },
    confirmation: toConfirmationDisplay(row.confirmation),
    schedule,
  }
}

function emptyTokenData(
  status: CrewAssignmentTokenState,
): CrewAssignmentConfirmationTokenData {
  return {
    status,
    event: null,
    volunteer: null,
    assignment: null,
    confirmation: null,
    schedule: [],
  }
}

async function loadCrewVolunteerSelfServiceSchedule({
  db,
  competitionId,
  membershipId,
  tokenAssignmentId,
}: {
  db: DbClient
  competitionId: string
  membershipId: string
  tokenAssignmentId: string
}) {
  const rows = await db
    .select({
      assignment: {
        id: volunteerShiftAssignmentsTable.id,
        membershipId: volunteerShiftAssignmentsTable.membershipId,
        notes: volunteerShiftAssignmentsTable.notes,
      },
      shift: {
        id: volunteerShiftsTable.id,
        name: volunteerShiftsTable.name,
        roleType: volunteerShiftsTable.roleType,
        startTime: volunteerShiftsTable.startTime,
        endTime: volunteerShiftsTable.endTime,
        location: volunteerShiftsTable.location,
        notes: volunteerShiftsTable.notes,
      },
      confirmation: {
        id: crewAssignmentConfirmationsTable.id,
        status: crewAssignmentConfirmationsTable.status,
        sentAt: crewAssignmentConfirmationsTable.sentAt,
        respondedAt: crewAssignmentConfirmationsTable.respondedAt,
        expiresAt: crewAssignmentConfirmationsTable.expiresAt,
        responseNote: crewAssignmentConfirmationsTable.responseNote,
        updatedAt: crewAssignmentConfirmationsTable.updatedAt,
      },
    })
    .from(volunteerShiftAssignmentsTable)
    .innerJoin(
      volunteerShiftsTable,
      eq(volunteerShiftAssignmentsTable.shiftId, volunteerShiftsTable.id),
    )
    .leftJoin(
      crewAssignmentConfirmationsTable,
      and(
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        ),
        eq(
          crewAssignmentConfirmationsTable.assignmentId,
          volunteerShiftAssignmentsTable.id,
        ),
      ),
    )
    .where(
      and(
        eq(volunteerShiftsTable.competitionId, competitionId),
        eq(volunteerShiftAssignmentsTable.membershipId, membershipId),
      ),
    )
    .orderBy(
      asc(volunteerShiftsTable.startTime),
      asc(volunteerShiftsTable.name),
      desc(crewAssignmentConfirmationsTable.updatedAt),
    )

  return buildCrewVolunteerSelfServiceSchedule({
    membershipId,
    tokenAssignmentId,
    assignments: rows.map((row) => ({
      id: row.assignment.id,
      membershipId: row.assignment.membershipId,
      shiftId: row.shift.id,
      name: row.shift.name,
      roleType: row.shift.roleType,
      roleLabel: formatVolunteerRole(row.shift.roleType),
      startTime: row.shift.startTime,
      endTime: row.shift.endTime,
      location: row.shift.location,
      notes: row.assignment.notes ?? row.shift.notes,
      confirmation:
        row.confirmation?.id && row.confirmation.status
          ? {
              id: row.confirmation.id,
              status: row.confirmation.status,
              sentAt: row.confirmation.sentAt,
              respondedAt: row.confirmation.respondedAt,
              expiresAt: row.confirmation.expiresAt,
              responseNote: row.confirmation.responseNote,
            }
          : null,
    })),
  })
}

function toConfirmationDisplay(confirmation: {
  id: string
  status: CrewAssignmentConfirmationStatus
  sentAt: Date | null
  respondedAt: Date | null
  expiresAt: Date | null
  responseNote: string | null
}): CrewAssignmentConfirmationDisplay {
  return {
    id: confirmation.id,
    status: confirmation.status,
    sentAt: confirmation.sentAt,
    respondedAt: confirmation.respondedAt,
    expiresAt: confirmation.expiresAt,
    responseNote: confirmation.responseNote,
  }
}

function getAssignmentConfirmationExpiry(now: Date) {
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + 14)
  return expiresAt
}

function normalizeConfirmationEmail(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getResponseSuccessMessage(action: CrewAssignmentResponseAction) {
  const status = statusForCrewAssignmentResponseAction(action)
  if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED) {
    return "Assignment confirmed. Thank you."
  }
  if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED) {
    return "Assignment declined. The organizer will see your response."
  }
  return "Change request sent. The organizer will see your note."
}

function historyEventTypeForConfirmationStatus(
  status: CrewAssignmentConfirmationStatus,
): CrewVolunteerHistoryEventType | null {
  if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED) {
    return CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED
  }
  if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED) {
    return CREW_VOLUNTEER_HISTORY_EVENT_TYPE.DECLINED
  }
  if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED) {
    return CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CHANGE_REQUESTED
  }
  if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.NO_SHOW) {
    return CREW_VOLUNTEER_HISTORY_EVENT_TYPE.NO_SHOW
  }
  return null
}

function historyEventTypeForOrganizerState(
  state: CrewAssignmentConfirmationOrganizerState,
  status: CrewAssignmentConfirmationStatus,
): CrewVolunteerHistoryEventType | null {
  if (state === "replaced") {
    return CREW_VOLUNTEER_HISTORY_EVENT_TYPE.REPLACED
  }
  return historyEventTypeForConfirmationStatus(status)
}

async function withCrewAssignmentConfirmationLock<T>(
  db: DbClient,
  assignmentId: string,
  callback: () => Promise<T>,
) {
  let acquired = false
  const lockName = await createCrewAssignmentConfirmationLockName(assignmentId)

  try {
    const result = await db.execute(
      sql`SELECT GET_LOCK(${lockName}, 5) FROM dual`,
    )
    acquired = Number(getFirstExecuteValue(result) ?? 0) === 1
    if (!acquired) {
      throw new Error("Assignment confirmation could not be saved")
    }

    return await callback()
  } finally {
    if (acquired) {
      await db.execute(sql`SELECT RELEASE_LOCK(${lockName}) FROM dual`)
    }
  }
}

async function createCrewAssignmentConfirmationLockName(assignmentId: string) {
  const encoded = new TextEncoder().encode(
    `crew-assignment-confirmation:${assignmentId}`,
  )
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
}
