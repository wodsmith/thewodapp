/**
 * Broadcast Server Functions
 *
 * Server functions for organizer broadcast messaging.
 * Handles creating, sending, and listing broadcasts.
 */
// @lat: [[organizer-dashboard#Broadcasts]]

import { env } from "cloudflare:workers"
import { render } from "@react-email/render"
import { createServerFn } from "@tanstack/react-start"
import { and, count, desc, eq, gt, inArray, isNull, ne } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  BROADCAST_EMAIL_DELIVERY_STATUS,
  BROADCAST_STATUS,
  competitionBroadcastRecipientsTable,
  competitionBroadcastsTable,
} from "@/db/schemas/broadcasts"
import {
  competitionRegistrationAnswersTable,
  competitionRegistrationQuestionsTable,
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
  volunteerRegistrationAnswersTable,
} from "@/db/schemas/competitions"
import {
  INVITATION_STATUS,
  SYSTEM_ROLES_ENUM,
  TEAM_PERMISSIONS,
  teamInvitationTable,
  teamMembershipTable,
  teamTable,
} from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import {
  addRequestContextAttribute,
  logEntityCreated,
  logError,
  logInfo,
  updateRequestContext,
} from "@/lib/logging"
import { BroadcastNotificationEmail } from "@/react-email/broadcast-notification"
import type { BroadcastEmailMessage } from "@/server/broadcast-queue-consumer"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "./requireTeamMembership"

// ============================================================================
// Input Schemas
// ============================================================================

const listBroadcastsInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
})

const questionFilterSchema = z.object({
  questionId: z.string(),
  values: z.array(z.string()).min(1),
})

export type QuestionFilter = z.infer<typeof questionFilterSchema>

export const audienceFilterSchema = z
  .object({
    type: z.enum([
      "all",
      "division",
      "public",
      "volunteers",
      "volunteer_role",
      "pending_teammates",
    ]),
    divisionId: z.string().optional(),
    volunteerRole: z.string().optional(),
    questionFilters: z.array(questionFilterSchema).optional(),
  })
  .refine(
    (filter) =>
      filter.type !== "division" ||
      (filter.divisionId && filter.divisionId.length > 0),
    { message: "Division ID is required when filtering by division" },
  )
  .refine(
    (filter) =>
      filter.type !== "volunteer_role" ||
      (filter.volunteerRole && filter.volunteerRole.length > 0),
    { message: "Volunteer role is required when filtering by role" },
  )
  .refine(
    (filter) =>
      filter.type !== "pending_teammates" ||
      !filter.questionFilters ||
      filter.questionFilters.length === 0,
    {
      message:
        "Registration question filters are not supported for pending teammate invites (invitees have no registration answers)",
    },
  )

const sendBroadcastInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  title: z.string().min(1, "Title is required").max(255),
  body: z.string().min(1, "Body is required"),
  audienceFilter: audienceFilterSchema.optional(),
  sendEmail: z.boolean().default(true),
})

const getBroadcastInputSchema = z.object({
  broadcastId: z.string().min(1, "Broadcast ID is required"),
})

const listAthleteBroadcastsInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
})

// ============================================================================
// Athlete Audience Row Fetching
// ============================================================================

/**
 * Fetch the raw rows needed to build the athlete-side of a broadcast audience:
 * registrations (captains + solo), accepted non-captain teammate memberships,
 * and pending teammate invitations. Honors an optional divisionId filter by
 * scoping by registration first, then inheriting the resulting athleteTeamIds.
 */
async function fetchAthleteAudienceRows(params: {
  competitionId: string
  divisionId?: string | null
}): Promise<{
  athleteRegistrations: RawAthleteRegistrationRow[]
  teammateMemberships: RawTeammateMembershipRow[]
  pendingInvitations: RawPendingInvitationRow[]
  pendingNames: Map<string, string>
}> {
  const db = getDb()

  const regConditions = [
    eq(competitionRegistrationsTable.eventId, params.competitionId),
    ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
  ]
  if (params.divisionId) {
    regConditions.push(
      eq(competitionRegistrationsTable.divisionId, params.divisionId),
    )
  }

  const athleteRows = await db
    .select({
      id: competitionRegistrationsTable.id,
      userId: competitionRegistrationsTable.userId,
      athleteTeamId: competitionRegistrationsTable.athleteTeamId,
      pendingTeammates: competitionRegistrationsTable.pendingTeammates,
      email: userTable.email,
      firstName: userTable.firstName,
    })
    .from(competitionRegistrationsTable)
    .innerJoin(
      userTable,
      eq(competitionRegistrationsTable.userId, userTable.id),
    )
    .where(and(...regConditions))

  const athleteRegistrations: RawAthleteRegistrationRow[] = athleteRows.map(
    (r) => ({
      id: r.id,
      userId: r.userId,
      athleteTeamId: r.athleteTeamId,
      email: r.email,
      firstName: r.firstName,
    }),
  )

  const pendingNames = new Map<string, string>()
  for (const r of athleteRows) {
    if (!r.athleteTeamId || !r.pendingTeammates) continue
    try {
      const parsed = JSON.parse(r.pendingTeammates) as Array<{
        email?: string
        firstName?: string | null
      }>
      for (const t of parsed) {
        if (!t?.email || !t.firstName) continue
        pendingNames.set(
          `${r.athleteTeamId}-${t.email.toLowerCase()}`,
          t.firstName,
        )
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  const athleteTeamIds = Array.from(
    new Set(
      athleteRows
        .map((r) => r.athleteTeamId)
        .filter((id): id is string => id !== null),
    ),
  )

  let teammateMemberships: RawTeammateMembershipRow[] = []
  let pendingInvitations: RawPendingInvitationRow[] = []

  if (athleteTeamIds.length > 0) {
    const memberRows = await db
      .select({
        userId: teamMembershipTable.userId,
        teamId: teamMembershipTable.teamId,
        email: userTable.email,
        firstName: userTable.firstName,
      })
      .from(teamMembershipTable)
      .innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
      .where(
        and(
          inArray(teamMembershipTable.teamId, athleteTeamIds),
          eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.MEMBER),
          eq(teamMembershipTable.isSystemRole, true),
          eq(teamMembershipTable.isActive, true),
        ),
      )
    teammateMemberships = memberRows

    const invitationRows = await db
      .select({
        id: teamInvitationTable.id,
        teamId: teamInvitationTable.teamId,
        email: teamInvitationTable.email,
      })
      .from(teamInvitationTable)
      .where(
        and(
          inArray(teamInvitationTable.teamId, athleteTeamIds),
          eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.MEMBER),
          eq(teamInvitationTable.isSystemRole, true),
          isNull(teamInvitationTable.acceptedAt),
          ne(teamInvitationTable.status, INVITATION_STATUS.CANCELLED),
          // INVITATION_STATUS has no EXPIRED value, so expiresAt is the only
          // signal that an unaccepted invite is stale (30-day window at issue time).
          gt(teamInvitationTable.expiresAt, new Date()),
        ),
      )
    pendingInvitations = invitationRows
  }

  return {
    athleteRegistrations,
    teammateMemberships,
    pendingInvitations,
    pendingNames,
  }
}

// ============================================================================
// Question Filtering Helpers
// ============================================================================

export type Recipient = {
  registrationId: string | null
  // Null for pending-invite recipients who have no user account yet.
  userId: string | null
  // Null for registered-user recipients (paired with userId).
  invitationId: string | null
  email: string | null
  firstName: string | null
  // Athlete team association used by question-filter inheritance: teammates and
  // pending invites on the same athleteTeamId as a captain whose registration
  // matches the filter are kept. Null for solo registrants (no team context) and
  // for volunteer-only rows.
  athleteTeamId: string | null
}

/**
 * Raw athlete row shape from competitionRegistrationsTable joined to userTable.
 */
export interface RawAthleteRegistrationRow {
  id: string
  userId: string
  athleteTeamId: string | null
  email: string | null
  firstName: string | null
}

/**
 * Raw non-captain teammate membership row from teamMembershipTable joined to userTable.
 */
export interface RawTeammateMembershipRow {
  userId: string
  teamId: string
  email: string | null
  firstName: string | null
}

/**
 * Raw pending teammate invitation row from teamInvitationTable.
 */
export interface RawPendingInvitationRow {
  id: string
  teamId: string
  email: string
}

export interface BuildBroadcastRecipientsInput {
  // Accepted athletes: solo registrants and team captains (one row per registration)
  athleteRegistrations: RawAthleteRegistrationRow[]
  // Accepted non-captain teammates (team memberships on athlete teams, role=MEMBER)
  teammateMemberships: RawTeammateMembershipRow[]
  // Pending teammate invitations that haven't been claimed by a user account
  pendingInvitations: RawPendingInvitationRow[]
  // Map of `${athleteTeamId}-${lowercaseEmail}` -> first name entered by the captain
  // (derived from competitionRegistrationsTable.pendingTeammates JSON)
  pendingNames?: Map<string, string>
  // When true, skip solo/captain/teammate rows and only emit invitation rows.
  onlyPendingInvites?: boolean
}

/**
 * Build the deduplicated recipient set for a broadcast.
 *
 * Dedup rules:
 *  - User-based recipients are deduped by userId.
 *  - Invite-based recipients are deduped by invitationId.
 *  - If an invitation's email matches an already-collected user's email, the
 *    invitation is dropped (prefer userId > invitationId).
 */
export function buildBroadcastRecipients(
  input: BuildBroadcastRecipientsInput,
): Recipient[] {
  const {
    athleteRegistrations,
    teammateMemberships,
    pendingInvitations,
    pendingNames,
    onlyPendingInvites = false,
  } = input

  const recipients: Recipient[] = []
  const seenUserIds = new Set<string>()
  const seenEmails = new Set<string>() // lowercase user emails, for dropping invites that match
  const seenInvitationIds = new Set<string>()

  if (!onlyPendingInvites) {
    for (const r of athleteRegistrations) {
      if (seenUserIds.has(r.userId)) continue
      seenUserIds.add(r.userId)
      if (r.email) seenEmails.add(r.email.toLowerCase())
      recipients.push({
        registrationId: r.id,
        userId: r.userId,
        invitationId: null,
        email: r.email,
        firstName: r.firstName,
        athleteTeamId: r.athleteTeamId,
      })
    }

    for (const m of teammateMemberships) {
      if (seenUserIds.has(m.userId)) continue
      seenUserIds.add(m.userId)
      if (m.email) seenEmails.add(m.email.toLowerCase())
      recipients.push({
        registrationId: null,
        userId: m.userId,
        invitationId: null,
        email: m.email,
        firstName: m.firstName,
        athleteTeamId: m.teamId,
      })
    }
  }

  for (const inv of pendingInvitations) {
    if (seenInvitationIds.has(inv.id)) continue
    const lowerEmail = inv.email.toLowerCase()
    // If a user with this email is already included, prefer the user row
    if (seenEmails.has(lowerEmail)) continue
    seenInvitationIds.add(inv.id)
    seenEmails.add(lowerEmail)
    const nameKey = `${inv.teamId}-${lowerEmail}`
    const firstName = pendingNames?.get(nameKey) ?? null
    recipients.push({
      registrationId: null,
      userId: null,
      invitationId: inv.id,
      email: inv.email,
      firstName,
      athleteTeamId: inv.teamId,
    })
  }

  return recipients
}

/**
 * Apply question filters to a list of athlete recipients.
 *
 * Only captain/solo registrations carry answers — teammates and pending
 * invitees inherit their athleteTeamId captain's match, so a filter like
 * "division = RX" applied to a full team keeps all four members instead of
 * silently dropping the three non-captain rows.
 *
 * AND across question filters, OR within each filter's values.
 */
async function applyAthleteQuestionFilters(
  recipients: Recipient[],
  questionFilters: QuestionFilter[],
): Promise<Recipient[]> {
  if (questionFilters.length === 0 || recipients.length === 0) return recipients

  const db = getDb()
  const registrationIds = recipients
    .map((r) => r.registrationId)
    .filter((id): id is string => id !== null)

  // No captain/solo registrations in the pool means no answers to match
  // against; a question filter can't select anyone by inheritance either.
  if (registrationIds.length === 0) return []

  const questionIds = questionFilters.map((f) => f.questionId)

  // Batch-load all relevant answers
  const answers = await db
    .select({
      registrationId: competitionRegistrationAnswersTable.registrationId,
      questionId: competitionRegistrationAnswersTable.questionId,
      answer: competitionRegistrationAnswersTable.answer,
    })
    .from(competitionRegistrationAnswersTable)
    .where(
      and(
        inArray(
          competitionRegistrationAnswersTable.registrationId,
          registrationIds,
        ),
        inArray(competitionRegistrationAnswersTable.questionId, questionIds),
      ),
    )

  // Build lookup: registrationId -> questionId -> Set of answers
  // A registration can have multiple answers per question (e.g. team registrations)
  const answerMap = new Map<string, Map<string, Set<string>>>()
  for (const a of answers) {
    let qMap = answerMap.get(a.registrationId)
    if (!qMap) {
      qMap = new Map()
      answerMap.set(a.registrationId, qMap)
    }
    let values = qMap.get(a.questionId)
    if (!values) {
      values = new Set()
      qMap.set(a.questionId, values)
    }
    values.add(a.answer)
  }

  // Compute which registrations pass, and inherit pass-state to all teammates
  // and pending invites on the same athleteTeamId.
  const matchedRegistrationIds = new Set<string>()
  const matchedAthleteTeamIds = new Set<string>()
  for (const r of recipients) {
    if (!r.registrationId) continue
    const qMap = answerMap.get(r.registrationId)
    if (!qMap) continue
    const passes = questionFilters.every((f) => {
      const answered = qMap.get(f.questionId)
      return answered !== undefined && f.values.some((v) => answered.has(v))
    })
    if (passes) {
      matchedRegistrationIds.add(r.registrationId)
      if (r.athleteTeamId) matchedAthleteTeamIds.add(r.athleteTeamId)
    }
  }

  return recipients.filter((r) => {
    if (r.registrationId) return matchedRegistrationIds.has(r.registrationId)
    // Teammate or pending-invite row: keep if its captain's team matched.
    if (r.athleteTeamId) return matchedAthleteTeamIds.has(r.athleteTeamId)
    return false
  })
}

/**
 * Apply question filters to a list of volunteer recipients.
 * Maps userId -> invitationId via teamInvitationTable, then checks answers.
 */
async function applyVolunteerQuestionFilters(
  recipients: Recipient[],
  questionFilters: QuestionFilter[],
  competitionTeamId: string,
): Promise<Recipient[]> {
  if (questionFilters.length === 0 || recipients.length === 0) return recipients

  const db = getDb()

  // Get all volunteer invitations for this competition team
  const invitations = await db
    .select({
      id: teamInvitationTable.id,
      email: teamInvitationTable.email,
      acceptedBy: teamInvitationTable.acceptedBy,
    })
    .from(teamInvitationTable)
    .where(
      and(
        eq(teamInvitationTable.teamId, competitionTeamId),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamInvitationTable.isSystemRole, true),
      ),
    )

  // Build userId -> invitationId map
  // For accepted volunteers, acceptedBy has the userId
  const userIdToInvitationId = new Map<string, string>()
  for (const inv of invitations) {
    if (inv.acceptedBy) {
      userIdToInvitationId.set(inv.acceptedBy, inv.id)
    }
  }

  const invitationIds = [...new Set(userIdToInvitationId.values())]
  if (invitationIds.length === 0) return []

  const questionIds = questionFilters.map((f) => f.questionId)

  const answers = await db
    .select({
      invitationId: volunteerRegistrationAnswersTable.invitationId,
      questionId: volunteerRegistrationAnswersTable.questionId,
      answer: volunteerRegistrationAnswersTable.answer,
    })
    .from(volunteerRegistrationAnswersTable)
    .where(
      and(
        inArray(volunteerRegistrationAnswersTable.invitationId, invitationIds),
        inArray(volunteerRegistrationAnswersTable.questionId, questionIds),
      ),
    )

  // Build lookup: invitationId -> questionId -> Set of answers
  const answerMap = new Map<string, Map<string, Set<string>>>()
  for (const a of answers) {
    let qMap = answerMap.get(a.invitationId)
    if (!qMap) {
      qMap = new Map()
      answerMap.set(a.invitationId, qMap)
    }
    let values = qMap.get(a.questionId)
    if (!values) {
      values = new Set()
      qMap.set(a.questionId, values)
    }
    values.add(a.answer)
  }

  return recipients.filter((r) => {
    if (!r.userId) return false
    const invitationId = userIdToInvitationId.get(r.userId)
    if (!invitationId) return false
    const qMap = answerMap.get(invitationId)
    if (!qMap) return false
    return questionFilters.every((f) => {
      const answers = qMap.get(f.questionId)
      return answers !== undefined && f.values.some((v) => answers.has(v))
    })
  })
}

/**
 * Partition question filters into athlete and volunteer filters
 * based on the question's questionTarget field.
 */
async function partitionQuestionFilters(
  questionFilters: QuestionFilter[],
): Promise<{
  athleteFilters: QuestionFilter[]
  volunteerFilters: QuestionFilter[]
}> {
  if (questionFilters.length === 0) {
    return { athleteFilters: [], volunteerFilters: [] }
  }

  const db = getDb()
  const questionIds = questionFilters.map((f) => f.questionId)

  const questions = await db
    .select({
      id: competitionRegistrationQuestionsTable.id,
      questionTarget: competitionRegistrationQuestionsTable.questionTarget,
    })
    .from(competitionRegistrationQuestionsTable)
    .where(inArray(competitionRegistrationQuestionsTable.id, questionIds))

  const targetMap = new Map(questions.map((q) => [q.id, q.questionTarget]))

  // Validate all filters resolved to a known question
  const unresolvedFilters = questionFilters.filter(
    (f) => !targetMap.has(f.questionId),
  )
  if (unresolvedFilters.length > 0) {
    throw new Error(
      "One or more registration question filters are no longer valid",
    )
  }

  const athleteFilters = questionFilters.filter(
    (f) => targetMap.get(f.questionId) === "athlete",
  )
  const volunteerFilters = questionFilters.filter(
    (f) => targetMap.get(f.questionId) === "volunteer",
  )

  return { athleteFilters, volunteerFilters }
}

// ============================================================================
// Organizer: Get Distinct Answer Values (for UI autocomplete)
// ============================================================================

const getDistinctAnswersInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  questionId: z.string().min(1, "Question ID is required"),
  questionTarget: z.enum(["athlete", "volunteer"]),
})

export const getDistinctAnswersFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getDistinctAnswersInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Authentication required")

    const db = getDb()

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
      columns: {
        id: true,
        organizingTeamId: true,
        competitionTeamId: true,
      },
    })
    if (!competition) throw new Error("Competition not found")

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    if (data.questionTarget === "athlete") {
      // Get distinct answers from athlete registrations for this competition
      const rows = await db
        .selectDistinct({
          answer: competitionRegistrationAnswersTable.answer,
        })
        .from(competitionRegistrationAnswersTable)
        .innerJoin(
          competitionRegistrationsTable,
          eq(
            competitionRegistrationAnswersTable.registrationId,
            competitionRegistrationsTable.id,
          ),
        )
        .where(
          and(
            eq(competitionRegistrationAnswersTable.questionId, data.questionId),
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            ne(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.REMOVED,
            ),
          ),
        )

      return { values: rows.map((r) => r.answer) }
    }

    // Volunteer: get distinct answers from volunteer invitations
    const invitations = await db
      .select({ id: teamInvitationTable.id })
      .from(teamInvitationTable)
      .where(
        and(
          eq(teamInvitationTable.teamId, competition.competitionTeamId),
          eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
          eq(teamInvitationTable.isSystemRole, true),
        ),
      )

    const invitationIds = invitations.map((i) => i.id)
    if (invitationIds.length === 0) return { values: [] }

    const rows = await db
      .selectDistinct({
        answer: volunteerRegistrationAnswersTable.answer,
      })
      .from(volunteerRegistrationAnswersTable)
      .where(
        and(
          eq(volunteerRegistrationAnswersTable.questionId, data.questionId),
          inArray(
            volunteerRegistrationAnswersTable.invitationId,
            invitationIds,
          ),
        ),
      )

    return { values: rows.map((r) => r.answer) }
  })

// ============================================================================
// Organizer: List Broadcasts
// ============================================================================

export const listBroadcastsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listBroadcastsInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Authentication required")

    const db = getDb()

    // Get competition to verify permissions
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
      columns: { id: true, organizingTeamId: true },
    })
    if (!competition) throw new Error("Competition not found")

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const broadcasts = await db.query.competitionBroadcastsTable.findMany({
      where: eq(competitionBroadcastsTable.competitionId, data.competitionId),
      orderBy: [desc(competitionBroadcastsTable.createdAt)],
    })

    // Get delivery stats for each broadcast
    const broadcastsWithStats = await Promise.all(
      broadcasts.map(async (broadcast) => {
        const [sentCount] = await db
          .select({ count: count() })
          .from(competitionBroadcastRecipientsTable)
          .where(
            and(
              eq(competitionBroadcastRecipientsTable.broadcastId, broadcast.id),
              eq(
                competitionBroadcastRecipientsTable.emailDeliveryStatus,
                BROADCAST_EMAIL_DELIVERY_STATUS.SENT,
              ),
            ),
          )
        const [failedCount] = await db
          .select({ count: count() })
          .from(competitionBroadcastRecipientsTable)
          .where(
            and(
              eq(competitionBroadcastRecipientsTable.broadcastId, broadcast.id),
              eq(
                competitionBroadcastRecipientsTable.emailDeliveryStatus,
                BROADCAST_EMAIL_DELIVERY_STATUS.FAILED,
              ),
            ),
          )

        return {
          ...broadcast,
          deliveryStats: {
            sent: sentCount?.count ?? 0,
            failed: failedCount?.count ?? 0,
          },
        }
      }),
    )

    return { broadcasts: broadcastsWithStats }
  })

// ============================================================================
// Organizer: Send Broadcast
// ============================================================================

export const sendBroadcastFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sendBroadcastInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Authentication required")

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)

    const db = getDb()

    // Get competition to verify permissions
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
      columns: {
        id: true,
        organizingTeamId: true,
        competitionTeamId: true,
        name: true,
        slug: true,
      },
    })
    if (!competition) throw new Error("Competition not found")

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const filterType = data.audienceFilter?.type ?? "all"

    // Build recipients list based on audience filter type.
    // We track athlete-side vs volunteer-side separately so question filters
    // can be applied to the appropriate group without cross-contamination.
    let athleteRecipients: Recipient[] = []
    let volunteerRecipients: Recipient[] = []

    const includeAthletes =
      filterType === "all" ||
      filterType === "division" ||
      filterType === "public"
    const includeVolunteers =
      filterType === "public" ||
      filterType === "volunteers" ||
      filterType === "volunteer_role"
    const isPendingTeammates = filterType === "pending_teammates"

    if (includeAthletes || isPendingTeammates) {
      const audienceRows = await fetchAthleteAudienceRows({
        competitionId: data.competitionId,
        divisionId:
          filterType === "division" || isPendingTeammates
            ? (data.audienceFilter?.divisionId ?? null)
            : null,
      })

      athleteRecipients = buildBroadcastRecipients({
        athleteRegistrations: audienceRows.athleteRegistrations,
        teammateMemberships: audienceRows.teammateMemberships,
        pendingInvitations: audienceRows.pendingInvitations,
        pendingNames: audienceRows.pendingNames,
        onlyPendingInvites: isPendingTeammates,
      })
    }

    if (includeVolunteers) {
      // Volunteers are team members on the competition team with VOLUNTEER role
      const volunteerConditions = [
        eq(teamMembershipTable.teamId, competition.competitionTeamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamMembershipTable.isSystemRole, true),
      ]

      const volunteerRows = await db
        .select({
          userId: teamMembershipTable.userId,
          email: userTable.email,
          firstName: userTable.firstName,
          metadata: teamMembershipTable.metadata,
        })
        .from(teamMembershipTable)
        .innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
        .where(and(...volunteerConditions))

      // Filter by volunteer role if specified
      let filteredVolunteers = volunteerRows
      if (
        filterType === "volunteer_role" &&
        data.audienceFilter?.volunteerRole
      ) {
        const targetRole = data.audienceFilter.volunteerRole
        filteredVolunteers = volunteerRows.filter((v) => {
          try {
            const meta = JSON.parse(v.metadata || "{}") as {
              volunteerRoleTypes?: string[]
            }
            return meta.volunteerRoleTypes?.includes(targetRole)
          } catch {
            return false
          }
        })
      }

      // Deduplicate: don't add volunteers who are already in as athletes
      const existingUserIds = new Set(
        athleteRecipients
          .map((r) => r.userId)
          .filter((id): id is string => id !== null),
      )
      for (const v of filteredVolunteers) {
        if (!existingUserIds.has(v.userId)) {
          volunteerRecipients.push({
            registrationId: null,
            userId: v.userId,
            invitationId: null,
            email: v.email,
            firstName: v.firstName,
            athleteTeamId: null,
          })
          existingUserIds.add(v.userId)
        }
      }
    }

    // Apply question filters if present — but skip for pending_teammates since
    // pending invitees have no registration answers to match against.
    const questionFilters = data.audienceFilter?.questionFilters
    if (!isPendingTeammates && questionFilters && questionFilters.length > 0) {
      const { athleteFilters, volunteerFilters } =
        await partitionQuestionFilters(questionFilters)

      // Athlete question filters are answered by the captain/solo registration;
      // applyAthleteQuestionFilters inherits captain matches to same-team
      // teammates + pending invites so a filter on "Division=RX" keeps the
      // whole team, not just the captain.
      const filteredAthletes =
        athleteFilters.length > 0
          ? await applyAthleteQuestionFilters(athleteRecipients, athleteFilters)
          : athleteRecipients

      const filteredVolunteers =
        volunteerFilters.length > 0
          ? await applyVolunteerQuestionFilters(
              volunteerRecipients,
              volunteerFilters,
              competition.competitionTeamId,
            )
          : volunteerRecipients

      athleteRecipients = filteredAthletes
      volunteerRecipients = filteredVolunteers
    }

    // Drop pending-invite athlete rows whose email collides with a volunteer
    // we're about to send to — volunteer has a real user account, so their
    // row wins and prevents the same person getting two emails. Done after
    // question filtering so a volunteer that was later filtered out doesn't
    // silently drop the pending-invite athlete with the same email.
    if (volunteerRecipients.length > 0) {
      const volunteerEmails = new Set(
        volunteerRecipients
          .map((v) => v.email?.toLowerCase())
          .filter((e): e is string => !!e),
      )
      athleteRecipients = athleteRecipients.filter(
        (r) =>
          !(
            r.invitationId !== null &&
            r.email !== null &&
            volunteerEmails.has(r.email.toLowerCase())
          ),
      )
    }

    const recipients: Recipient[] = [
      ...athleteRecipients,
      ...volunteerRecipients,
    ]

    if (recipients.length === 0) {
      throw new Error("No recipients match the selected filter")
    }

    // Get organizer team name for email
    const team = await db.query.teamTable.findFirst({
      where: eq(teamTable.id, competition.organizingTeamId),
      columns: { name: true },
    })

    // Generate recipient IDs upfront so we can reference them in queue messages
    const { createBroadcastRecipientId } = await import("@/db/schemas/common")

    // Insert broadcast + recipients atomically in a transaction
    const { broadcast, recipientValues } = await db.transaction(async (tx) => {
      const [broadcast] = await tx
        .insert(competitionBroadcastsTable)
        .values({
          competitionId: data.competitionId,
          teamId: competition.organizingTeamId,
          title: data.title,
          body: data.body,
          audienceFilter: data.audienceFilter
            ? JSON.stringify(data.audienceFilter)
            : null,
          recipientCount: recipients.length,
          status: BROADCAST_STATUS.SENT,
          sentAt: new Date(),
          createdById: session.userId,
        })
        .$returningId()

      const recipientValues = recipients.map((r) => ({
        id: createBroadcastRecipientId(),
        broadcastId: broadcast.id,
        registrationId: r.registrationId,
        userId: r.userId,
        invitationId: r.invitationId,
        email: r.email,
        emailDeliveryStatus: BROADCAST_EMAIL_DELIVERY_STATUS.QUEUED as "queued",
      }))

      await tx
        .insert(competitionBroadcastRecipientsTable)
        .values(recipientValues)

      return { broadcast, recipientValues }
    })

    logEntityCreated({
      entity: "broadcast",
      id: broadcast.id,
      parentEntity: "competition",
      parentId: data.competitionId,
      attributes: {
        title: data.title,
        audienceFilter: filterType,
        recipientCount: recipients.length,
        sendEmail: data.sendEmail,
      },
    })

    if (data.sendEmail) {
      // Pre-render the email template once for all recipients
      const bodyHtml = await render(
        BroadcastNotificationEmail({
          competitionName: competition.name,
          competitionSlug: competition.slug,
          broadcastTitle: data.title,
          broadcastBody: data.body,
          organizerTeamName: team?.name ?? "Organizer",
        }),
      )

      // Pair each recipient-value with its source recipient, then partition
      // into deliverable (has email) vs skipped (no email). Skipped rows are
      // marked in DB up front so dashboard counts don't leave them "queued".
      const paired = recipientValues.map((rv, idx) => ({
        rv,
        recipient: recipients[idx],
      }))
      const deliverable = paired.filter(({ recipient }) => !!recipient?.email)
      const skippedIds = paired
        .filter(({ recipient }) => !recipient?.email)
        .map(({ rv }) => rv.id)

      if (skippedIds.length > 0) {
        await db
          .update(competitionBroadcastRecipientsTable)
          .set({
            emailDeliveryStatus: BROADCAST_EMAIL_DELIVERY_STATUS.SKIPPED,
          })
          .where(inArray(competitionBroadcastRecipientsTable.id, skippedIds))
        logInfo({
          message: "[Broadcast] Skipped recipients with no email",
          attributes: {
            broadcastId: broadcast.id,
            skippedCount: skippedIds.length,
          },
        })
      }

      // Enqueue batches of up to 100 recipients into Cloudflare Queue
      const BATCH_SIZE = 100
      const queue = (env as unknown as Record<string, unknown>)
        .BROADCAST_EMAIL_QUEUE as Queue<BroadcastEmailMessage> | undefined

      if (queue) {
        const batchCount = Math.ceil(deliverable.length / BATCH_SIZE)
        for (let i = 0; i < deliverable.length; i += BATCH_SIZE) {
          const batchSlice = deliverable.slice(i, i + BATCH_SIZE)
          const message: BroadcastEmailMessage = {
            broadcastId: broadcast.id,
            competitionId: data.competitionId,
            batch: batchSlice.map(({ rv, recipient }) => ({
              recipientId: rv.id,
              email: recipient.email ?? "",
              athleteName: recipient.firstName ?? "Athlete",
            })),
            subject: `${data.title} — ${competition.name}`,
            bodyHtml,
            replyTo: "support@mail.wodsmith.com",
          }
          await queue.send(message)
        }

        logInfo({
          message: "[Broadcast] Emails queued for delivery",
          attributes: {
            broadcastId: broadcast.id,
            recipientCount: deliverable.length,
            batchCount,
          },
        })
      } else {
        // Dev fallback: send emails directly when Queue binding is unavailable
        logInfo({
          message:
            "[Broadcast] No queue binding, sending emails directly (dev fallback)",
          attributes: {
            broadcastId: broadcast.id,
            recipientCount: deliverable.length,
          },
        })

        const { sendEmail: sendEmailFn } = await import("@/utils/email")
        let sentCount = 0
        let failedCount = 0
        for (const { rv, recipient } of deliverable) {
          if (!recipient?.email) continue
          try {
            await sendEmailFn({
              to: recipient.email,
              subject: `${data.title} — ${competition.name}`,
              template: BroadcastNotificationEmail({
                competitionName: competition.name,
                competitionSlug: competition.slug,
                broadcastTitle: data.title,
                broadcastBody: data.body,
                organizerTeamName: team?.name ?? "Organizer",
              }),
              tags: [
                {
                  name: "type",
                  value: "competition-broadcast",
                },
              ],
            })
            await db
              .update(competitionBroadcastRecipientsTable)
              .set({
                emailDeliveryStatus: BROADCAST_EMAIL_DELIVERY_STATUS.SENT,
              })
              .where(eq(competitionBroadcastRecipientsTable.id, rv.id))
            sentCount++
          } catch (err) {
            await db
              .update(competitionBroadcastRecipientsTable)
              .set({
                emailDeliveryStatus: BROADCAST_EMAIL_DELIVERY_STATUS.FAILED,
              })
              .where(eq(competitionBroadcastRecipientsTable.id, rv.id))
            failedCount++
            logError({
              message: "[Broadcast] Dev fallback email send failed",
              error: err,
              attributes: {
                broadcastId: broadcast.id,
                recipientId: rv.id,
              },
            })
          }
        }

        logInfo({
          message: "[Broadcast] Dev fallback delivery complete",
          attributes: {
            broadcastId: broadcast.id,
            sent: sentCount,
            failed: failedCount,
          },
        })
      }
    } else {
      // No email — mark all recipients as skipped (in-app only)
      const allIds = recipientValues.map((rv) => rv.id)
      if (allIds.length > 0) {
        await db
          .update(competitionBroadcastRecipientsTable)
          .set({
            emailDeliveryStatus: BROADCAST_EMAIL_DELIVERY_STATUS.SKIPPED,
          })
          .where(inArray(competitionBroadcastRecipientsTable.id, allIds))
      }

      logInfo({
        message: "[Broadcast] Created as in-app only (no email)",
        attributes: {
          broadcastId: broadcast.id,
          recipientCount: recipients.length,
        },
      })
    }

    return {
      broadcastId: broadcast.id,
      recipientCount: recipients.length,
    }
  })

// ============================================================================
// Organizer: Get Broadcast Detail
// ============================================================================

export const getBroadcastFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getBroadcastInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Authentication required")

    const db = getDb()

    const broadcast = await db.query.competitionBroadcastsTable.findFirst({
      where: eq(competitionBroadcastsTable.id, data.broadcastId),
    })
    if (!broadcast) throw new Error("Broadcast not found")

    await requireTeamPermission(
      broadcast.teamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    // Get recipients with delivery status.
    // Left-join userTable because pending-invite rows have userId=null and
    // should still appear in the list using their captured email.
    const rows = await db
      .select({
        id: competitionBroadcastRecipientsTable.id,
        userId: competitionBroadcastRecipientsTable.userId,
        invitationId: competitionBroadcastRecipientsTable.invitationId,
        recipientEmail: competitionBroadcastRecipientsTable.email,
        emailDeliveryStatus:
          competitionBroadcastRecipientsTable.emailDeliveryStatus,
        firstName: userTable.firstName,
        userEmail: userTable.email,
      })
      .from(competitionBroadcastRecipientsTable)
      .leftJoin(
        userTable,
        eq(competitionBroadcastRecipientsTable.userId, userTable.id),
      )
      .where(
        eq(competitionBroadcastRecipientsTable.broadcastId, data.broadcastId),
      )

    // Normalize: surface `email` as the delivery address (user email > captured email)
    // and expose `invitationId` so UI can tag pending-invite rows.
    const recipients = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      invitationId: r.invitationId,
      emailDeliveryStatus: r.emailDeliveryStatus,
      firstName: r.firstName,
      email: r.userEmail ?? r.recipientEmail ?? null,
    }))

    return { broadcast, recipients }
  })

// ============================================================================
// Athlete: List Broadcasts for Competition
// ============================================================================

export const listAthleteBroadcastsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    listAthleteBroadcastsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    const db = getDb()

    // Public broadcasts are visible to everyone (no auth required)
    const publicBroadcasts = await db.query.competitionBroadcastsTable.findMany(
      {
        where: and(
          eq(competitionBroadcastsTable.competitionId, data.competitionId),
          eq(competitionBroadcastsTable.status, BROADCAST_STATUS.SENT),
          eq(
            competitionBroadcastsTable.audienceFilter,
            JSON.stringify({ type: "public" }),
          ),
        ),
        orderBy: [desc(competitionBroadcastsTable.sentAt)],
      },
    )

    // Targeted broadcasts require auth — only show if user is a recipient
    let targetedBroadcasts: typeof publicBroadcasts = []
    if (session?.userId) {
      const recipientBroadcasts = await db
        .select({
          broadcastId: competitionBroadcastRecipientsTable.broadcastId,
        })
        .from(competitionBroadcastRecipientsTable)
        .where(eq(competitionBroadcastRecipientsTable.userId, session.userId))

      if (recipientBroadcasts.length > 0) {
        const broadcastIds = recipientBroadcasts.map((r) => r.broadcastId)
        targetedBroadcasts = await db.query.competitionBroadcastsTable.findMany(
          {
            where: and(
              eq(competitionBroadcastsTable.competitionId, data.competitionId),
              inArray(competitionBroadcastsTable.id, broadcastIds),
              eq(competitionBroadcastsTable.status, BROADCAST_STATUS.SENT),
            ),
            orderBy: [desc(competitionBroadcastsTable.sentAt)],
          },
        )
      }
    }

    // Merge and deduplicate, sorted by sentAt descending
    const seenIds = new Set<string>()
    const broadcasts = [...publicBroadcasts, ...targetedBroadcasts]
      .filter((b) => {
        if (seenIds.has(b.id)) return false
        seenIds.add(b.id)
        return true
      })
      .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))

    return { broadcasts }
  })

// ============================================================================
// Organizer: Preview Audience Count
// ============================================================================

const previewAudienceInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  audienceFilter: audienceFilterSchema.optional(),
})

export const previewAudienceFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => previewAudienceInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Authentication required")

    const db = getDb()

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
      columns: {
        id: true,
        organizingTeamId: true,
        competitionTeamId: true,
      },
    })
    if (!competition) throw new Error("Competition not found")

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const filterType = data.audienceFilter?.type ?? "all"

    const includeAthletes =
      filterType === "all" ||
      filterType === "division" ||
      filterType === "public"
    const includeVolunteers =
      filterType === "public" ||
      filterType === "volunteers" ||
      filterType === "volunteer_role"
    const isPendingTeammates = filterType === "pending_teammates"

    // Build the athlete-side recipient set via the shared helper so preview
    // and send stay in lock-step on audience expansion + dedup rules.
    let athleteRecipients: Recipient[] = []
    if (includeAthletes || isPendingTeammates) {
      const audienceRows = await fetchAthleteAudienceRows({
        competitionId: data.competitionId,
        divisionId:
          filterType === "division" || isPendingTeammates
            ? (data.audienceFilter?.divisionId ?? null)
            : null,
      })
      athleteRecipients = buildBroadcastRecipients({
        athleteRegistrations: audienceRows.athleteRegistrations,
        teammateMemberships: audienceRows.teammateMemberships,
        pendingInvitations: audienceRows.pendingInvitations,
        pendingNames: audienceRows.pendingNames,
        onlyPendingInvites: isPendingTeammates,
      })
    }

    // Volunteers come from teamMembershipTable on the competition team.
    let volunteerRecipients: Recipient[] = []
    if (includeVolunteers) {
      const volunteerRows = await db
        .select({
          userId: teamMembershipTable.userId,
          email: userTable.email,
          firstName: userTable.firstName,
          metadata: teamMembershipTable.metadata,
        })
        .from(teamMembershipTable)
        .innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
        .where(
          and(
            eq(teamMembershipTable.teamId, competition.competitionTeamId),
            eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
            eq(teamMembershipTable.isSystemRole, true),
          ),
        )

      let filtered = volunteerRows
      if (
        filterType === "volunteer_role" &&
        data.audienceFilter?.volunteerRole
      ) {
        const targetRole = data.audienceFilter.volunteerRole
        filtered = volunteerRows.filter((v) => {
          try {
            const meta = JSON.parse(v.metadata || "{}") as {
              volunteerRoleTypes?: string[]
            }
            return meta.volunteerRoleTypes?.includes(targetRole)
          } catch {
            return false
          }
        })
      }

      const existingUserIds = new Set(
        athleteRecipients
          .map((r) => r.userId)
          .filter((id): id is string => id !== null),
      )
      for (const v of filtered) {
        if (!existingUserIds.has(v.userId)) {
          volunteerRecipients.push({
            registrationId: null,
            userId: v.userId,
            invitationId: null,
            email: v.email,
            firstName: v.firstName,
            athleteTeamId: null,
          })
          existingUserIds.add(v.userId)
        }
      }

      // Drop pending-invite athlete rows whose email collides with a volunteer
      // — keep preview count in lock-step with send-time dedup.
      if (volunteerRecipients.length > 0) {
        const volunteerEmails = new Set(
          volunteerRecipients
            .map((v) => v.email?.toLowerCase())
            .filter((e): e is string => !!e),
        )
        athleteRecipients = athleteRecipients.filter(
          (r) =>
            !(
              r.invitationId !== null &&
              r.email !== null &&
              volunteerEmails.has(r.email.toLowerCase())
            ),
        )
      }
    }

    // Apply question filters if present. Skip for pending_teammates — invitees
    // don't have registration answers to match against.
    const questionFilters = data.audienceFilter?.questionFilters
    if (!isPendingTeammates && questionFilters && questionFilters.length > 0) {
      const { athleteFilters, volunteerFilters } =
        await partitionQuestionFilters(questionFilters)

      athleteRecipients =
        athleteFilters.length > 0
          ? await applyAthleteQuestionFilters(athleteRecipients, athleteFilters)
          : athleteRecipients

      volunteerRecipients =
        volunteerFilters.length > 0
          ? await applyVolunteerQuestionFilters(
              volunteerRecipients,
              volunteerFilters,
              competition.competitionTeamId,
            )
          : volunteerRecipients
    }

    return {
      count: athleteRecipients.length + volunteerRecipients.length,
    }
  })
