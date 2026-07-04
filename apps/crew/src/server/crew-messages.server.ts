// @lat: [[crew#Volunteer Messaging Composer#Filtered recipient selection]]
import { env } from "cloudflare:workers"
import { render } from "@react-email/render"
import { and, asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { getDb } from "../db"
import {
  BROADCAST_EMAIL_DELIVERY_STATUS,
  BROADCAST_STATUS,
  competitionBroadcastRecipientsTable,
  competitionBroadcastsTable,
} from "../db/schemas/broadcasts"
import { createBroadcastRecipientId } from "../db/schemas/common"
import { competitionsTable } from "../db/schemas/competitions"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  type CrewAssignmentConfirmationStatus,
  crewAssignmentConfirmationsTable,
} from "../db/schemas/crew-imports"
import {
  competitionMessageTemplatesTable,
  type MessageTemplateType,
} from "../db/schemas/message-templates"
import { teamMembershipTable } from "../db/schemas/teams"
import { userTable } from "../db/schemas/users"
import {
  type VolunteerRoleType,
  volunteerShiftAssignmentsTable,
  volunteerShiftsTable,
} from "../db/schemas/volunteers"
import {
  getCrewAssignmentConfirmationOperationalState,
  normalizeConfirmationEmailForSend,
} from "../lib/crew/assignment-confirmations"
import {
  type CrewDepartmentLeadAccess,
  filterCrewDepartmentLeadShifts,
} from "../lib/crew/department-leads"
import {
  buildCrewAssignmentMessageRecipients,
  buildCrewBroadcastMessageRecipients,
  type CrewMessageAssignmentCandidate,
  type CrewMessageFilters,
  type CrewMessageMode,
  type CrewMessageRecipient,
  type CrewMessageRecipientSkipSummary,
  type CrewMessageRecipientState,
  filterCrewMessageCandidates,
} from "../lib/crew/message-recipients"
import {
  type CrewTemplateVariableKey,
  getDefaultCompetitionMessageTemplate,
  MESSAGE_TEMPLATE_TYPES,
  type MessageTemplateContent,
  renderCompetitionMessageTemplate,
} from "../lib/crew/message-templates"
import {
  formatVolunteerRole,
  parseCrewRosterMetadata,
} from "../lib/crew/roster-shifts"
import { getAppUrl } from "../lib/env"
import { CrewTemplatedMessageEmail } from "../react-email/crew/templated-message"
import { getSessionFromCookie } from "../utils/auth"
import { formatDateTimeInTimezone } from "../utils/timezone-utils"
import type { BroadcastEmailMessage } from "./broadcast-queue-consumer"
import {
  loadCrewShiftAssignmentConfirmationMap,
  queueCrewTemplatedAssignmentEmails,
} from "./crew-confirmation.server"
import {
  requireCrewDepartmentLeadEvent,
  resolveCrewDepartmentLeadAccess,
} from "./crew-department-lead.server"

export type { CrewMessageMode, CrewMessageRecipient }
export type { MessageTemplateType }

// ============================================================================
// Types
// ============================================================================

export interface CrewMessageComposerTemplate {
  templateType: MessageTemplateType
  subject: string
  body: string
  isCustomized: boolean
}

export interface CrewMessageFilterOptions {
  states: CrewMessageRecipientState[]
  roles: { value: string; label: string }[]
  shifts: { id: string; name: string; startsAt: Date }[]
}

export type CrewMessageHistoryKind = "confirmation" | "reminder" | "broadcast"

export interface CrewMessageHistoryItem {
  id: string
  kind: CrewMessageHistoryKind
  subject: string
  sentAt: Date | null
  recipientCount: number
  delivered: number
  failed: number
}

export interface CrewMessageComposerEvent {
  id: string
  name: string
  timezone: string | null
}

export interface CrewMessageComposerData {
  event: CrewMessageComposerEvent
  templates: CrewMessageComposerTemplate[]
  filterOptions: CrewMessageFilterOptions
  history: CrewMessageHistoryItem[]
}

export interface PreviewCrewMessageRecipientsResult {
  recipients: CrewMessageRecipient[]
  skipped: CrewMessageRecipientSkipSummary
}

export interface QueueCrewMessagesResult {
  queued: number
  previewed: number
  failed: number
  eligible: number
  queueAvailable: boolean
}

const ALL_RECIPIENT_STATES: CrewMessageRecipientState[] = [
  "not_ready",
  "pending",
  "sent",
  "confirmed",
  "checked_in",
  "declined",
  "change_requested",
  "no_show",
  "replaced",
]

// ============================================================================
// Composer data
// ============================================================================

export async function getCrewMessageComposer(data: {
  eventId: string
}): Promise<CrewMessageComposerData> {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const db = getDb()
  const [eventDetail] = await db
    .select({ name: competitionsTable.name })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, data.eventId))
    .limit(1)
  const [candidates, templates, history] = await Promise.all([
    loadCrewMessageAssignmentCandidates(data.eventId, access),
    loadCompetitionMessageTemplates(data.eventId),
    loadCrewMessageHistory(data.eventId),
  ])

  return {
    event: {
      id: event.id,
      name: eventDetail?.name ?? "Crew messages",
      timezone: event.timezone,
    },
    templates,
    filterOptions: buildCrewMessageFilterOptions(candidates),
    history,
  }
}

async function loadCompetitionMessageTemplates(
  eventId: string,
): Promise<CrewMessageComposerTemplate[]> {
  const db = getDb()
  const rows = await db
    .select({
      templateType: competitionMessageTemplatesTable.templateType,
      subject: competitionMessageTemplatesTable.subject,
      body: competitionMessageTemplatesTable.body,
    })
    .from(competitionMessageTemplatesTable)
    .where(eq(competitionMessageTemplatesTable.competitionId, eventId))

  const saved = new Map(rows.map((row) => [row.templateType, row]))

  return MESSAGE_TEMPLATE_TYPES.map((templateType) => {
    const row = saved.get(templateType)
    if (row) {
      return {
        templateType,
        subject: row.subject,
        body: row.body,
        isCustomized: true,
      }
    }
    const fallback = getDefaultCompetitionMessageTemplate(templateType)
    return {
      templateType,
      subject: fallback.subject,
      body: fallback.body,
      isCustomized: false,
    }
  })
}

function buildCrewMessageFilterOptions(
  candidates: CrewMessageAssignmentCandidate[],
): CrewMessageFilterOptions {
  const roleValues = new Set<string>()
  const shiftsById = new Map<
    string,
    { id: string; name: string; startsAt: Date }
  >()

  for (const candidate of candidates) {
    roleValues.add(candidate.roleType)
    if (!shiftsById.has(candidate.shiftId)) {
      shiftsById.set(candidate.shiftId, {
        id: candidate.shiftId,
        name: candidate.shiftName,
        startsAt: candidate.startsAt,
      })
    }
  }

  const roles = [...roleValues]
    .map((value) => ({
      value,
      label: formatVolunteerRole(value as VolunteerRoleType),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const shifts = [...shiftsById.values()].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  )

  return { states: ALL_RECIPIENT_STATES, roles, shifts }
}

async function loadCrewMessageHistory(
  eventId: string,
): Promise<CrewMessageHistoryItem[]> {
  const [broadcasts, confirmationBatches, reminderBatches] = await Promise.all([
    loadCrewBroadcastHistory(eventId),
    loadCrewConfirmationHistory(eventId, "confirmation"),
    loadCrewConfirmationHistory(eventId, "reminder"),
  ])

  return [...broadcasts, ...confirmationBatches, ...reminderBatches].sort(
    (a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0),
  )
}

async function loadCrewBroadcastHistory(
  eventId: string,
): Promise<CrewMessageHistoryItem[]> {
  const db = getDb()
  const broadcasts = await db
    .select({
      id: competitionBroadcastsTable.id,
      title: competitionBroadcastsTable.title,
      sentAt: competitionBroadcastsTable.sentAt,
      createdAt: competitionBroadcastsTable.createdAt,
      recipientCount: competitionBroadcastsTable.recipientCount,
    })
    .from(competitionBroadcastsTable)
    .where(eq(competitionBroadcastsTable.competitionId, eventId))
    .orderBy(desc(competitionBroadcastsTable.createdAt))

  if (broadcasts.length === 0) return []

  const broadcastIds = broadcasts.map((broadcast) => broadcast.id)
  const statsByBroadcast = new Map<string, { sent: number; failed: number }>()
  const statRows = await db
    .select({
      broadcastId: competitionBroadcastRecipientsTable.broadcastId,
      status: competitionBroadcastRecipientsTable.emailDeliveryStatus,
      count: count(),
    })
    .from(competitionBroadcastRecipientsTable)
    .where(
      inArray(competitionBroadcastRecipientsTable.broadcastId, broadcastIds),
    )
    .groupBy(
      competitionBroadcastRecipientsTable.broadcastId,
      competitionBroadcastRecipientsTable.emailDeliveryStatus,
    )
  for (const row of statRows) {
    const stats = statsByBroadcast.get(row.broadcastId) ?? {
      sent: 0,
      failed: 0,
    }
    if (row.status === BROADCAST_EMAIL_DELIVERY_STATUS.SENT) {
      stats.sent = Number(row.count)
    } else if (row.status === BROADCAST_EMAIL_DELIVERY_STATUS.FAILED) {
      stats.failed = Number(row.count)
    }
    statsByBroadcast.set(row.broadcastId, stats)
  }

  return broadcasts.map((broadcast) => {
    const stats = statsByBroadcast.get(broadcast.id) ?? { sent: 0, failed: 0 }
    return {
      id: broadcast.id,
      kind: "broadcast" as const,
      subject: broadcast.title,
      sentAt: broadcast.sentAt ?? broadcast.createdAt,
      recipientCount: broadcast.recipientCount,
      delivered: stats.sent,
      failed: stats.failed,
    }
  })
}

async function loadCrewConfirmationHistory(
  eventId: string,
  kind: "confirmation" | "reminder",
): Promise<CrewMessageHistoryItem[]> {
  const db = getDb()
  const timestampColumn =
    kind === "confirmation"
      ? crewAssignmentConfirmationsTable.sentAt
      : crewAssignmentConfirmationsTable.lastReminderAt
  const dayExpr = sql<string>`DATE(${timestampColumn})`

  const rows = await db
    .select({
      day: dayExpr,
      latest: sql<string>`MAX(${timestampColumn})`,
      total: count(),
    })
    .from(crewAssignmentConfirmationsTable)
    .where(
      and(
        eq(crewAssignmentConfirmationsTable.competitionId, eventId),
        isNotNull(timestampColumn),
      ),
    )
    .groupBy(dayExpr)

  return rows
    .filter((row) => row.day != null)
    .map((row) => {
      const sentAt = row.latest ? new Date(row.latest) : null
      return {
        id: `${kind}-${row.day}`,
        kind,
        subject:
          kind === "confirmation"
            ? "Assignment invites"
            : "Assignment reminders",
        sentAt: sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : null,
        recipientCount: Number(row.total),
        delivered: Number(row.total),
        failed: 0,
      }
    })
}

// ============================================================================
// Template save / reset
// ============================================================================

export async function saveCompetitionMessageTemplate(data: {
  eventId: string
  templateType: MessageTemplateType
  subject: string
  body: string
}): Promise<{ success: true }> {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  await resolveCrewDepartmentLeadAccess(event)

  const db = getDb()
  const now = new Date()
  await db
    .insert(competitionMessageTemplatesTable)
    .values({
      competitionId: data.eventId,
      templateType: data.templateType,
      subject: data.subject,
      body: data.body,
      createdAt: now,
      updatedAt: now,
    })
    .onDuplicateKeyUpdate({
      set: {
        subject: data.subject,
        body: data.body,
        updatedAt: now,
      },
    })

  return { success: true }
}

export async function resetCompetitionMessageTemplate(data: {
  eventId: string
  templateType: MessageTemplateType
}): Promise<{ success: true }> {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  await resolveCrewDepartmentLeadAccess(event)

  const db = getDb()
  await db
    .delete(competitionMessageTemplatesTable)
    .where(
      and(
        eq(competitionMessageTemplatesTable.competitionId, data.eventId),
        eq(competitionMessageTemplatesTable.templateType, data.templateType),
      ),
    )

  return { success: true }
}

// ============================================================================
// Recipient preview
// ============================================================================

export async function previewCrewMessageRecipients(data: {
  eventId: string
  mode: CrewMessageMode
  filters: CrewMessageFilters
}): Promise<PreviewCrewMessageRecipientsResult> {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const candidates = filterCrewMessageCandidates(
    await loadCrewMessageAssignmentCandidates(data.eventId, access),
    data.filters,
  )

  if (data.mode === "custom_broadcast") {
    return buildCrewBroadcastMessageRecipients(candidates)
  }

  return buildCrewAssignmentMessageRecipients({
    candidates: candidates.filter(
      (candidate) => candidate.confirmationId !== "",
    ),
    mode: data.mode,
    includeAlreadySent: data.filters.includeAlreadySent ?? false,
    now: new Date(),
  })
}

// ============================================================================
// Send
// ============================================================================

export async function queueCrewMessages(data: {
  eventId: string
  mode: CrewMessageMode
  recipientKeys: string[]
  template: MessageTemplateContent
}): Promise<QueueCrewMessagesResult> {
  if (data.mode === "custom_broadcast") {
    return queueCrewCustomBroadcast(data)
  }
  return queueCrewAssignmentMessages(data)
}

async function queueCrewAssignmentMessages(data: {
  eventId: string
  mode: CrewMessageMode
  recipientKeys: string[]
  template: MessageTemplateContent
}): Promise<QueueCrewMessagesResult> {
  const mode = data.mode === "reminder" ? "reminders" : "confirmations"
  const footerText =
    "This assignment link is private to you. No WODsmith account is required to respond."

  const result = await queueCrewTemplatedAssignmentEmails({
    eventId: data.eventId,
    mode,
    recipientConfirmationIds: data.recipientKeys,
    render: async (context) => {
      const variables: Record<CrewTemplateVariableKey, string> = {
        volunteerName: context.volunteerName,
        eventName: context.eventName,
        shiftName: context.shiftName,
        roleName: context.roleLabel,
        shiftDate: formatDateTimeInTimezone(
          context.startTime,
          context.timezone,
          "EEE, MMM d",
        ),
        shiftTime: `${formatDateTimeInTimezone(
          context.startTime,
          context.timezone,
          "h:mm a",
        )} - ${formatDateTimeInTimezone(context.endTime, context.timezone, "h:mm a")}`,
        location: context.location ?? "",
        confirmUrl: context.confirmUrl,
        scheduleUrl: context.scheduleUrl,
      }
      const rendered = renderCompetitionMessageTemplate({
        subject: data.template.subject,
        body: data.template.body,
        variables,
      })
      const bodyHtml = await render(
        CrewTemplatedMessageEmail({
          heading: rendered.subject,
          paragraphs: rendered.paragraphs,
          cta: { label: "Review and respond", url: context.confirmUrl },
          footerText,
        }),
      )
      return { subject: rendered.subject, bodyHtml }
    },
  })

  return {
    queued: result.queued,
    previewed: result.previewed,
    failed: result.failed,
    eligible: result.eligible,
    queueAvailable: result.queueAvailable,
  }
}

async function queueCrewCustomBroadcast(data: {
  eventId: string
  recipientKeys: string[]
  template: MessageTemplateContent
}): Promise<QueueCrewMessagesResult> {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const session = await getSessionFromCookie().catch(() => null)
  if (!session?.userId) {
    throw new Error("NOT_AUTHORIZED: Not authenticated")
  }

  const db = getDb()
  const [competition] = await db
    .select({
      name: competitionsTable.name,
      slug: competitionsTable.slug,
    })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, data.eventId))
    .limit(1)

  const candidates = await loadCrewMessageAssignmentCandidates(
    data.eventId,
    access,
  )
  const { recipients } = buildCrewBroadcastMessageRecipients(candidates)
  const selectedKeys = new Set(data.recipientKeys)
  const eligibleRecipients = recipients.filter(
    (recipient) =>
      recipient.eligible &&
      recipient.volunteerEmail &&
      selectedKeys.has(recipient.key),
  )

  const queue = (env as unknown as Record<string, unknown>)
    .BROADCAST_EMAIL_QUEUE as Queue<BroadcastEmailMessage> | undefined

  if (eligibleRecipients.length === 0) {
    return {
      queued: 0,
      previewed: 0,
      failed: 0,
      eligible: 0,
      queueAvailable: Boolean(queue),
    }
  }

  const scheduleUrl = competition
    ? `${getAppUrl().replace(/\/$/, "")}/e/${encodeURIComponent(competition.slug)}`
    : getAppUrl()
  const eventName = competition?.name ?? "the event"

  // Pre-render per-recipient bodies (custom broadcasts personalize the greeting).
  const prepared = eligibleRecipients.map((recipient) => {
    const variables: Partial<Record<CrewTemplateVariableKey, string>> = {
      volunteerName: recipient.volunteerName,
      eventName,
      scheduleUrl,
    }
    const rendered = renderCompetitionMessageTemplate({
      subject: data.template.subject,
      body: data.template.body,
      variables,
    })
    return {
      recipient,
      recipientId: createBroadcastRecipientId(),
      subject: rendered.subject,
      paragraphs: rendered.paragraphs,
    }
  })

  const now = new Date()
  const { broadcastId } = await db.transaction(async (tx) => {
    const [broadcast] = await tx
      .insert(competitionBroadcastsTable)
      .values({
        competitionId: data.eventId,
        teamId: event.organizingTeamId,
        title: data.template.subject,
        body: data.template.body,
        audienceFilter: JSON.stringify({ type: "crew_custom_broadcast" }),
        recipientCount: prepared.length,
        status: BROADCAST_STATUS.SENT,
        sentAt: now,
        createdById: session.userId,
      })
      .$returningId()

    await tx.insert(competitionBroadcastRecipientsTable).values(
      prepared.map((entry) => ({
        id: entry.recipientId,
        broadcastId: broadcast.id,
        registrationId: null,
        userId: null,
        invitationId: null,
        email: entry.recipient.volunteerEmail,
        emailDeliveryStatus: BROADCAST_EMAIL_DELIVERY_STATUS.QUEUED as "queued",
      })),
    )

    return { broadcastId: broadcast.id }
  })

  if (!queue) {
    await db
      .update(competitionBroadcastRecipientsTable)
      .set({ emailDeliveryStatus: BROADCAST_EMAIL_DELIVERY_STATUS.SKIPPED })
      .where(
        inArray(
          competitionBroadcastRecipientsTable.id,
          prepared.map((entry) => entry.recipientId),
        ),
      )
    for (const entry of prepared) {
      console.log(
        `[CrewBroadcast Preview] To: ${entry.recipient.volunteerEmail} | Subject: ${entry.subject} | Broadcast: ${broadcastId}`,
      )
    }
    return {
      queued: 0,
      previewed: prepared.length,
      failed: 0,
      eligible: prepared.length,
      queueAvailable: false,
    }
  }

  let queued = 0
  let failed = 0
  for (const entry of prepared) {
    try {
      const bodyHtml = await render(
        CrewTemplatedMessageEmail({
          heading: entry.subject,
          paragraphs: entry.paragraphs,
          cta: null,
          footerText: `You are receiving this message because you volunteered for ${eventName}.`,
        }),
      )
      const message: BroadcastEmailMessage = {
        broadcastId,
        competitionId: data.eventId,
        batch: [
          {
            recipientId: entry.recipientId,
            email: entry.recipient.volunteerEmail ?? "",
            athleteName: entry.recipient.volunteerName,
          },
        ],
        subject: entry.subject,
        bodyHtml,
        replyTo: "support@mail.wodsmith.com",
      }
      await queue.send(message)
      queued += 1
    } catch (error) {
      console.error("[CrewBroadcast] Failed to queue broadcast email", {
        error,
        recipientId: entry.recipientId,
      })
      await db
        .update(competitionBroadcastRecipientsTable)
        .set({ emailDeliveryStatus: BROADCAST_EMAIL_DELIVERY_STATUS.FAILED })
        .where(eq(competitionBroadcastRecipientsTable.id, entry.recipientId))
      failed += 1
    }
  }

  return {
    queued,
    previewed: 0,
    failed,
    eligible: prepared.length,
    queueAvailable: true,
  }
}

// ============================================================================
// Candidate loading
// ============================================================================

async function loadCrewMessageAssignmentCandidates(
  eventId: string,
  access: CrewDepartmentLeadAccess,
): Promise<CrewMessageAssignmentCandidate[]> {
  const db = getDb()
  const assignmentRows = await db
    .select({
      assignment: {
        id: volunteerShiftAssignmentsTable.id,
        membershipId: volunteerShiftAssignmentsTable.membershipId,
        invitationId: volunteerShiftAssignmentsTable.invitationId,
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
    const state: CrewMessageRecipientState =
      operationalState === "missing"
        ? "not_ready"
        : (operationalState as CrewMessageRecipientState)

    return {
      assignmentId: row.assignment.id,
      confirmationId: confirmation?.id ?? "",
      membershipId: row.assignment.membershipId,
      invitationId: row.assignment.invitationId,
      volunteerName,
      volunteerEmail: email,
      shiftId: row.shift.id,
      shiftName: row.shift.name,
      roleType: row.shift.roleType,
      roleLabel: formatVolunteerRole(row.shift.roleType),
      startsAt: row.shift.startTime,
      state,
      status:
        (confirmation?.status as CrewAssignmentConfirmationStatus) ??
        CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
      sentAt: confirmation?.sentAt ?? null,
      reminderCount: confirmation?.reminderCount ?? 0,
    }
  })
}
