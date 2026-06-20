import { render } from "@react-email/render"
// @lat: [[crew#Assignment Confirmation Responses]]
// @lat: [[crew#Assignment Confirmations]]
// @lat: [[crew#Confirmation Emails And Reminders]]
import { env } from "cloudflare:workers"
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm"
import { getDb } from "../db"
import { competitionsTable, type Competition } from "../db/schemas/competitions"
import { createCrewAssignmentConfirmationId } from "../db/schemas/common"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
  crewAssignmentConfirmationsTable,
  type CrewAssignmentConfirmationStatus,
} from "../db/schemas/crew-imports"
import {
  CREW_EVENT_LIFECYCLE,
  crewEventSettingsTable,
} from "../db/schemas/crew-event-settings"
import { teamMembershipTable } from "../db/schemas/teams"
import { userTable } from "../db/schemas/users"
import {
  volunteerShiftAssignmentsTable,
  volunteerShiftsTable,
  type VolunteerRoleType,
} from "../db/schemas/volunteers"
import {
  buildCrewAssignmentConfirmationUrls,
  buildCrewAssignmentConfirmationEmailPlan,
  buildCrewAssignmentEmailIdempotencyKey,
  generateCrewAssignmentConfirmationToken,
  getCrewAssignmentConfirmationTokenState,
  hashCrewAssignmentConfirmationToken,
  normalizeConfirmationEmailForSend,
  resolveCrewAssignmentConfirmationResponse,
  resolveCrewAssignmentConfirmationOrganizerStateUpdate,
  statusForCrewAssignmentResponseAction,
  summarizeCrewAssignmentConfirmations,
  type CrewAssignmentConfirmationEmailOperation,
  type CrewAssignmentConfirmationEmailCandidate,
  type CrewAssignmentConfirmationEmailOperationMode,
  type CrewAssignmentConfirmationOrganizerState,
  type CrewAssignmentConfirmationStatusSummary,
  type CrewAssignmentEmailQueueMessage,
  type CrewAssignmentResponseAction,
  type CrewAssignmentTokenState,
} from "../lib/crew/assignment-confirmations"
import {
  formatVolunteerRole,
  getCrewRosterRoleTypes,
  parseCrewRosterMetadata,
} from "../lib/crew/roster-shifts"
import { getAppUrl } from "../lib/env"
import { CrewAssignmentConfirmationEmail } from "../react-email/crew/assignment-confirmation"
import { CrewAssignmentReminder24HourEmail } from "../react-email/crew/reminder-24-hour"
import { CrewAssignmentReminder48HourEmail } from "../react-email/crew/reminder-48-hour"
import {
  DEFAULT_TIMEZONE,
  formatDateTimeInTimezone,
} from "../utils/timezone-utils"
import { getFirstExecuteValue } from "../server-fns/db-execute"
import { requireLocalCrewOperatorAccess } from "./crew-local-access"

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

interface CrewAssignmentEmailCandidate
  extends CrewAssignmentConfirmationEmailCandidate {
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
        confirmation: crewAssignmentConfirmationsTable,
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
  requireLocalCrewOperatorAccess("Crew assignment confirmations")

  const db = getDb()
  const now = new Date()

  return await db.transaction(async (tx) => {
    const [assignment] = await tx
      .select({
        assignmentId: volunteerShiftAssignmentsTable.id,
        shiftId: volunteerShiftAssignmentsTable.shiftId,
        membershipId: volunteerShiftAssignmentsTable.membershipId,
        competitionId: volunteerShiftsTable.competitionId,
        membershipMetadata: teamMembershipTable.metadata,
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
  requireLocalCrewOperatorAccess("Crew confirmation emails")

  const db = getDb()
  const now = new Date()
  const candidates = await loadCrewAssignmentEmailCandidates(data.eventId)
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

    try {
      await db
        .update(crewAssignmentConfirmationsTable)
        .set({
          tokenHash,
          expiresAt,
          updatedAt: now,
        })
        .where(
          and(
            eq(crewAssignmentConfirmationsTable.id, operation.confirmationId),
            eq(
              crewAssignmentConfirmationsTable.status,
              CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
            ),
          ),
        )
      await queue.send(message)
      await markCrewAssignmentEmailQueued({
        db,
        operation,
        queuedAt: now,
      })
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
      normalizeConfirmationEmailForSend(row.confirmation.email) ??
      normalizeConfirmationEmailForSend(metadata.signupEmail) ??
      normalizeConfirmationEmailForSend(row.user?.email)
    const volunteerName =
      metadata.signupName ||
      [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" ") ||
      email ||
      "Volunteer"

    return {
      confirmationId: row.confirmation.id,
      assignmentId: row.confirmation.assignmentId,
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
        startTime: row.shift.startTime,
        endTime: row.shift.endTime,
        location: row.shift.location,
      },
    }
  })
}

async function markCrewAssignmentEmailQueued(params: {
  db: DbClient
  operation: CrewAssignmentConfirmationEmailOperation
  queuedAt: Date
}) {
  if (params.operation.kind === "confirmation") {
    await params.db
      .update(crewAssignmentConfirmationsTable)
      .set({
        sentAt: params.queuedAt,
        updatedAt: params.queuedAt,
      })
      .where(
        eq(
          crewAssignmentConfirmationsTable.id,
          params.operation.confirmationId,
        ),
      )
    return
  }

  await params.db
    .update(crewAssignmentConfirmationsTable)
    .set({
      lastReminderAt: params.queuedAt,
      reminderCount: params.operation.reminderCount,
      updatedAt: params.queuedAt,
    })
    .where(
      eq(crewAssignmentConfirmationsTable.id, params.operation.confirmationId),
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
      },
      confirmationEmail: crewAssignmentConfirmationsTable.email,
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
    row.confirmationEmail ?? metadata.signupEmail ?? row.user?.email ?? ""

  return {
    status,
    event: row.event,
    volunteer: {
      name,
      email,
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
      notes: shift.notes,
    },
    confirmation: toConfirmationDisplay(row.confirmation),
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
  }
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
