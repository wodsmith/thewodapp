import "server-only"

/**
 * Organizer Athlete Detail Server Functions for TanStack Start
 *
 * Organizer-scoped mutations + fetch for a single competition registration.
 * All endpoints require MANAGE_COMPETITIONS on the organizing team (or site admin).
 */
// @lat: [[organizer-dashboard#Registrations (Athletes)]]

import { createId } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  commercePurchaseTable,
  competitionEventsTable,
  competitionRegistrationAnswersTable,
  competitionRegistrationQuestionsTable,
  competitionRegistrationsTable,
  competitionsTable,
  createCompetitionRegistrationAnswerId,
  createTeamInvitationId,
  createVideoSubmissionId,
  INVITATION_STATUS,
  REGISTRATION_STATUS,
  ROLES_ENUM,
  SYSTEM_ROLES_ENUM,
  scalingLevelsTable,
  scoreRoundsTable,
  scoresTable,
  TEAM_PERMISSIONS,
  teamInvitationTable,
  teamMembershipTable,
  teamTable,
  userTable,
  videoSubmissionsTable,
  waiverSignaturesTable,
  waiversTable,
} from "@/db/schema"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { workouts } from "@/db/schemas/workouts"
import { getEvlog } from "@/lib/evlog"
import {
  addRequestContextAttribute,
  logEntityCreated,
  logEntityDeleted,
  logEntityUpdated,
  logInfo,
  updateRequestContext,
} from "@/lib/logging"
import { requireVerifiedEmail } from "@/utils/auth"
import { saveCompetitionScoreFn } from "./competition-score-fns"

// ============================================================================
// Helpers
// ============================================================================

type Session = Awaited<ReturnType<typeof requireVerifiedEmail>>

async function loadCompetitionForAuth(competitionId: string) {
  const db = getDb()
  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, competitionId),
    columns: {
      id: true,
      name: true,
      slug: true,
      organizingTeamId: true,
      competitionTeamId: true,
      competitionType: true,
      startDate: true,
      endDate: true,
    },
  })
  if (!competition) throw new Error("Competition not found")
  return competition
}

function requireCanManage(session: Session, organizingTeamId: string): void {
  const canManage =
    session.user?.role === ROLES_ENUM.ADMIN ||
    !!session.teams?.find(
      (t) =>
        t.id === organizingTeamId &&
        t.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS),
    )
  if (!canManage) throw new Error("Forbidden")
}

async function loadRegistrationOrThrow(
  registrationId: string,
  competitionId: string,
) {
  const db = getDb()
  const registration = await db.query.competitionRegistrationsTable.findFirst({
    where: and(
      eq(competitionRegistrationsTable.id, registrationId),
      eq(competitionRegistrationsTable.eventId, competitionId),
    ),
  })
  if (!registration) throw new Error("Registration not found")
  return registration
}

// ============================================================================
// A1. getOrganizerAthleteDetailFn
// ============================================================================

const getOrganizerAthleteDetailInputSchema = z.object({
  registrationId: z.string().min(1),
  competitionId: z.string().min(1),
})

export const getOrganizerAthleteDetailFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getOrganizerAthleteDetailInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("registrationId", data.registrationId)

    const competition = await loadCompetitionForAuth(data.competitionId)
    requireCanManage(session, competition.organizingTeamId)

    // Fetch registration + captain + division + athlete team + memberships
    const registration = await db.query.competitionRegistrationsTable.findFirst(
      {
        where: and(
          eq(competitionRegistrationsTable.id, data.registrationId),
          eq(competitionRegistrationsTable.eventId, data.competitionId),
        ),
        with: {
          captain: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          division: {
            columns: { id: true, label: true, teamSize: true },
          },
          athleteTeam: {
            columns: { id: true, name: true },
            with: {
              memberships: {
                columns: {
                  id: true,
                  userId: true,
                  joinedAt: true,
                  isActive: true,
                  roleId: true,
                },
                with: {
                  user: {
                    columns: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      avatar: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    )

    if (!registration) throw new Error("Registration not found")

    // Build member userIds (include captain always)
    const memberUserIds = new Set<string>([registration.userId])
    const athleteTeam = registration.athleteTeam
      ? Array.isArray(registration.athleteTeam)
        ? registration.athleteTeam[0]
        : registration.athleteTeam
      : null
    if (athleteTeam?.memberships) {
      for (const m of athleteTeam.memberships) {
        if (m.userId) memberUserIds.add(m.userId)
      }
    }
    const memberUserIdList = [...memberUserIds]

    // Parallel-fetch: pending invites, questions, answers, waivers, signatures,
    // events + scores + video submissions, commerce purchase
    const [
      pendingInvitesRows,
      questions,
      answersRows,
      waivers,
      waiverSignaturesRows,
      competitionEvents,
      videoSubmissionsRows,
      scoresRows,
      commercePurchase,
    ] = await Promise.all([
      athleteTeam?.id
        ? db.query.teamInvitationTable.findMany({
            where: and(
              eq(teamInvitationTable.teamId, athleteTeam.id),
              ne(teamInvitationTable.status, INVITATION_STATUS.CANCELLED),
              isNull(teamInvitationTable.acceptedAt),
            ),
          })
        : Promise.resolve([]),
      db
        .select()
        .from(competitionRegistrationQuestionsTable)
        .where(
          and(
            eq(
              competitionRegistrationQuestionsTable.competitionId,
              data.competitionId,
            ),
            eq(competitionRegistrationQuestionsTable.questionTarget, "athlete"),
          ),
        )
        .orderBy(asc(competitionRegistrationQuestionsTable.sortOrder)),
      db
        .select()
        .from(competitionRegistrationAnswersTable)
        .where(
          eq(
            competitionRegistrationAnswersTable.registrationId,
            data.registrationId,
          ),
        ),
      db
        .select({
          id: waiversTable.id,
          title: waiversTable.title,
          required: waiversTable.required,
        })
        .from(waiversTable)
        .where(eq(waiversTable.competitionId, data.competitionId)),
      memberUserIdList.length > 0
        ? db
            .select({
              userId: waiverSignaturesTable.userId,
              waiverId: waiverSignaturesTable.waiverId,
              signedAt: waiverSignaturesTable.signedAt,
            })
            .from(waiverSignaturesTable)
            .innerJoin(
              waiversTable,
              eq(waiverSignaturesTable.waiverId, waiversTable.id),
            )
            .where(
              and(
                eq(waiversTable.competitionId, data.competitionId),
                inArray(waiverSignaturesTable.userId, memberUserIdList),
              ),
            )
        : Promise.resolve([]),
      db
        .select({
          id: competitionEventsTable.id,
          trackWorkoutId: competitionEventsTable.trackWorkoutId,
          submissionOpensAt: competitionEventsTable.submissionOpensAt,
          submissionClosesAt: competitionEventsTable.submissionClosesAt,
          ordinal: trackWorkoutsTable.trackOrder,
          workoutId: workouts.id,
          workoutName: workouts.name,
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          timeCap: workouts.timeCap,
          tiebreakScheme: workouts.tiebreakScheme,
        })
        .from(competitionEventsTable)
        .innerJoin(
          trackWorkoutsTable,
          eq(competitionEventsTable.trackWorkoutId, trackWorkoutsTable.id),
        )
        .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
        .where(eq(competitionEventsTable.competitionId, data.competitionId))
        .orderBy(asc(trackWorkoutsTable.trackOrder)),
      db
        .select()
        .from(videoSubmissionsTable)
        .where(eq(videoSubmissionsTable.registrationId, data.registrationId)),
      memberUserIdList.length > 0
        ? db
            .select()
            .from(scoresTable)
            .where(inArray(scoresTable.userId, memberUserIdList))
        : Promise.resolve([] as (typeof scoresTable.$inferSelect)[]),
      registration.commercePurchaseId
        ? db.query.commercePurchaseTable.findFirst({
            where: eq(
              commercePurchaseTable.id,
              registration.commercePurchaseId,
            ),
            columns: {
              id: true,
              totalCents: true,
              status: true,
              completedAt: true,
              stripePaymentIntentId: true,
            },
          })
        : Promise.resolve(null),
    ])

    // Filter scores to only those for this competition's events
    const trackWorkoutIdSet = new Set(
      competitionEvents.map((e) => e.trackWorkoutId),
    )
    const relevantScores = (
      scoresRows as (typeof scoresTable.$inferSelect)[]
    ).filter(
      (s) =>
        s.competitionEventId !== null &&
        trackWorkoutIdSet.has(s.competitionEventId),
    )

    // Load rounds for relevant scores in one query
    const scoreIds = relevantScores.map((s) => s.id)
    const scoreRoundsRows =
      scoreIds.length > 0
        ? await db
            .select({
              scoreId: scoreRoundsTable.scoreId,
              roundNumber: scoreRoundsTable.roundNumber,
              value: scoreRoundsTable.value,
            })
            .from(scoreRoundsTable)
            .where(inArray(scoreRoundsTable.scoreId, scoreIds))
            .orderBy(asc(scoreRoundsTable.roundNumber))
        : []

    const roundsByScoreId = new Map<
      string,
      { roundIndex: number; scoreValue: number }[]
    >()
    for (const r of scoreRoundsRows) {
      const list = roundsByScoreId.get(r.scoreId) ?? []
      list.push({ roundIndex: r.roundNumber, scoreValue: r.value })
      roundsByScoreId.set(r.scoreId, list)
    }

    // Shape answers keyed by `${userId}:${questionId}`
    const answers: Record<string, string> = {}
    for (const a of answersRows) {
      answers[`${a.userId}:${a.questionId}`] = a.answer
    }

    // Shape pending invites
    const pendingInvites = pendingInvitesRows.map((inv) => {
      let pendingAnswers:
        | Array<{ questionId: string; answer: string }>
        | undefined
      let pendingSignatures:
        | Array<{ waiverId: string; signedAt: string; signatureName: string }>
        | undefined
      let submittedAt: string | undefined
      let guestName: string | undefined
      if (inv.metadata) {
        try {
          const meta = JSON.parse(inv.metadata) as Record<string, unknown>
          if (Array.isArray(meta.pendingAnswers)) {
            pendingAnswers = meta.pendingAnswers as typeof pendingAnswers
          }
          if (Array.isArray(meta.pendingSignatures)) {
            pendingSignatures =
              meta.pendingSignatures as typeof pendingSignatures
          }
          if (typeof meta.submittedAt === "string") {
            submittedAt = meta.submittedAt
          }
          if (typeof meta.guestName === "string") {
            guestName = meta.guestName
          }
        } catch {
          // ignore invalid JSON
        }
      }
      return {
        id: inv.id,
        email: inv.email,
        status: inv.status,
        guestName,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        pendingAnswers,
        pendingSignatures,
        submittedAt,
      }
    })

    const captain = Array.isArray(registration.captain)
      ? registration.captain[0]
      : registration.captain

    const division = Array.isArray(registration.division)
      ? registration.division[0]
      : registration.division

    return {
      registration: {
        id: registration.id,
        status: registration.status,
        teamName: registration.teamName,
        divisionId: registration.divisionId,
        paymentStatus: registration.paymentStatus,
        paidAt: registration.paidAt,
        registeredAt: registration.registeredAt,
        metadata: registration.metadata,
        commercePurchaseId: registration.commercePurchaseId,
        userId: registration.userId,
        athleteTeamId: registration.athleteTeamId,
      },
      competition: {
        id: competition.id,
        name: competition.name,
        organizingTeamId: competition.organizingTeamId,
        competitionType: competition.competitionType,
        startDate: competition.startDate,
        endDate: competition.endDate,
      },
      division: division
        ? {
            id: division.id,
            label: division.label,
            teamSize: division.teamSize,
          }
        : null,
      captain: captain ?? null,
      athleteTeam: athleteTeam
        ? {
            id: athleteTeam.id,
            name: athleteTeam.name,
            memberships: (
              (athleteTeam.memberships ?? []) as Array<{
                id: string
                userId: string
                joinedAt: Date | null
                isActive: boolean
                roleId: string
                user:
                  | {
                      id: string
                      firstName: string | null
                      lastName: string | null
                      email: string
                      avatar: string | null
                    }
                  | null
                  | Array<{
                      id: string
                      firstName: string | null
                      lastName: string | null
                      email: string
                      avatar: string | null
                    }>
              }>
            ).map((m) => ({
              id: m.id,
              userId: m.userId,
              joinedAt: m.joinedAt,
              isActive: m.isActive,
              role: m.roleId,
              user: Array.isArray(m.user) ? m.user[0] : m.user,
            })),
          }
        : null,
      pendingInvites,
      questions,
      answers,
      waivers,
      waiverSignatures: waiverSignaturesRows,
      events: competitionEvents.map((e) => ({
        id: e.id,
        trackWorkoutId: e.trackWorkoutId,
        workoutName: e.workoutName,
        scheme: e.scheme,
        scoreType: e.scoreType,
        timeCap: e.timeCap,
        tiebreakScheme: e.tiebreakScheme,
        submissionWindowStartsAt: e.submissionOpensAt,
        submissionWindowEndsAt: e.submissionClosesAt,
        ordinal: e.ordinal,
      })),
      videoSubmissions: videoSubmissionsRows.map((v) => ({
        id: v.id,
        eventId: v.trackWorkoutId, // keyed by trackWorkoutId in this system
        trackWorkoutId: v.trackWorkoutId,
        videoIndex: v.videoIndex,
        userId: v.userId,
        videoUrl: v.videoUrl,
        notes: v.notes,
        reviewedAt: v.reviewedAt,
        status: v.reviewStatus,
        scoreId:
          relevantScores.find(
            (s) =>
              s.competitionEventId === v.trackWorkoutId &&
              s.userId === v.userId,
          )?.id ?? null,
      })),
      scores: relevantScores.map((s) => ({
        id: s.id,
        trackWorkoutId: s.competitionEventId,
        userId: s.userId,
        divisionId: s.scalingLevelId,
        scoreStatus: s.status,
        scoreValue: s.scoreValue,
        secondaryScore: s.secondaryValue,
        tieBreakScore: s.tiebreakValue,
        scoreRounds: roundsByScoreId.get(s.id) ?? [],
        updatedAt: s.updatedAt,
      })),
      commercePurchase: commercePurchase ?? null,
    }
  })

// ============================================================================
// A2. updateRegistrationTeamNameFn
// ============================================================================

const updateRegistrationTeamNameInputSchema = z.object({
  registrationId: z.string().min(1),
  competitionId: z.string().min(1),
  teamName: z.string().min(1).max(255).nullable(),
})

export const updateRegistrationTeamNameFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateRegistrationTeamNameInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("registrationId", data.registrationId)
    getEvlog()?.set({
      action: "organizer_update_team_name",
      registration: {
        id: data.registrationId,
        competitionId: data.competitionId,
      },
    })

    const competition = await loadCompetitionForAuth(data.competitionId)
    requireCanManage(session, competition.organizingTeamId)

    const registration = await loadRegistrationOrThrow(
      data.registrationId,
      data.competitionId,
    )

    await db
      .update(competitionRegistrationsTable)
      .set({ teamName: data.teamName, updatedAt: new Date() })
      .where(eq(competitionRegistrationsTable.id, data.registrationId))

    if (registration.athleteTeamId && data.teamName) {
      await db
        .update(teamTable)
        .set({ name: data.teamName, updatedAt: new Date() })
        .where(eq(teamTable.id, registration.athleteTeamId))
    }

    logEntityUpdated({
      entity: "competition_registration",
      id: data.registrationId,
      fields: ["teamName"],
      attributes: {
        competitionId: data.competitionId,
        athleteTeamId: registration.athleteTeamId ?? null,
      },
    })

    return { success: true }
  })

// ============================================================================
// A3. updateAthleteUserProfileFn
// ============================================================================

const updateAthleteUserProfileInputSchema = z.object({
  registrationId: z.string().min(1),
  competitionId: z.string().min(1),
  userId: z.string().min(1),
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
})

export const updateAthleteUserProfileFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateAthleteUserProfileInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("registrationId", data.registrationId)
    addRequestContextAttribute("targetUserId", data.userId)

    const competition = await loadCompetitionForAuth(data.competitionId)
    requireCanManage(session, competition.organizingTeamId)

    const registration = await loadRegistrationOrThrow(
      data.registrationId,
      data.competitionId,
    )

    // Verify target user is either captain or member of athlete team
    let isAuthorizedTarget = registration.userId === data.userId
    if (!isAuthorizedTarget && registration.athleteTeamId) {
      const membership = await db.query.teamMembershipTable.findFirst({
        where: and(
          eq(teamMembershipTable.teamId, registration.athleteTeamId),
          eq(teamMembershipTable.userId, data.userId),
        ),
      })
      isAuthorizedTarget = !!membership
    }
    if (!isAuthorizedTarget) {
      throw new Error("User is not a member of this registration")
    }

    // Check email uniqueness if email is being changed
    const updates: {
      firstName?: string
      lastName?: string
      email?: string
      updatedAt: Date
    } = { updatedAt: new Date() }

    if (data.firstName !== undefined) updates.firstName = data.firstName
    if (data.lastName !== undefined) updates.lastName = data.lastName

    if (data.email !== undefined) {
      const normalized = data.email.toLowerCase()
      const existing = await db.query.userTable.findFirst({
        where: eq(userTable.email, normalized),
        columns: { id: true },
      })
      if (existing && existing.id !== data.userId) {
        throw new Error("That email is already in use by another account")
      }
      updates.email = normalized
    }

    const hasChanges = Object.keys(updates).length > 1 // more than just updatedAt
    if (!hasChanges) {
      return { success: true }
    }

    await db.update(userTable).set(updates).where(eq(userTable.id, data.userId))

    logEntityUpdated({
      entity: "user",
      id: data.userId,
      fields: Object.keys(updates).filter((k) => k !== "updatedAt"),
      attributes: {
        competitionId: data.competitionId,
        registrationId: data.registrationId,
        performedBy: session.userId,
      },
    })

    return { success: true }
  })

// ============================================================================
// A4. updateRegistrationAnswerFn
// ============================================================================

const updateRegistrationAnswerInputSchema = z.object({
  registrationId: z.string().min(1),
  competitionId: z.string().min(1),
  userId: z.string().min(1),
  questionId: z.string().min(1),
  answer: z.string(),
})

export const updateRegistrationAnswerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateRegistrationAnswerInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("registrationId", data.registrationId)

    const competition = await loadCompetitionForAuth(data.competitionId)
    requireCanManage(session, competition.organizingTeamId)

    await loadRegistrationOrThrow(data.registrationId, data.competitionId)

    const trimmed = data.answer.trim()

    if (trimmed === "") {
      // Delete row if empty
      await db
        .delete(competitionRegistrationAnswersTable)
        .where(
          and(
            eq(
              competitionRegistrationAnswersTable.registrationId,
              data.registrationId,
            ),
            eq(competitionRegistrationAnswersTable.userId, data.userId),
            eq(competitionRegistrationAnswersTable.questionId, data.questionId),
          ),
        )
      logEntityDeleted({
        entity: "registration_answer",
        id: `${data.registrationId}:${data.userId}:${data.questionId}`,
        attributes: { competitionId: data.competitionId },
      })
      return { success: true }
    }

    // Upsert — insert with onDuplicateKeyUpdate via unique (questionId, registrationId, userId)
    await db
      .insert(competitionRegistrationAnswersTable)
      .values({
        id: createCompetitionRegistrationAnswerId(),
        questionId: data.questionId,
        registrationId: data.registrationId,
        userId: data.userId,
        answer: trimmed,
      })
      .onDuplicateKeyUpdate({
        set: { answer: trimmed, updatedAt: new Date() },
      })

    logEntityUpdated({
      entity: "registration_answer",
      id: `${data.registrationId}:${data.userId}:${data.questionId}`,
      attributes: { competitionId: data.competitionId },
    })

    return { success: true }
  })

// ============================================================================
// A5. removeTeammateFromRegistrationFn
// ============================================================================

const removeTeammateFromRegistrationInputSchema = z.object({
  registrationId: z.string().min(1),
  competitionId: z.string().min(1),
  userId: z.string().min(1),
})

export const removeTeammateFromRegistrationFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    removeTeammateFromRegistrationInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("registrationId", data.registrationId)
    addRequestContextAttribute("targetUserId", data.userId)

    const competition = await loadCompetitionForAuth(data.competitionId)
    requireCanManage(session, competition.organizingTeamId)

    const registration = await loadRegistrationOrThrow(
      data.registrationId,
      data.competitionId,
    )

    if (data.userId === registration.userId) {
      throw new Error(
        "Cannot remove the captain via this endpoint — remove the registration instead.",
      )
    }

    if (!registration.athleteTeamId) {
      throw new Error("This registration has no athlete team")
    }

    // Deactivate athlete-team membership
    await db
      .update(teamMembershipTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(teamMembershipTable.teamId, registration.athleteTeamId),
          eq(teamMembershipTable.userId, data.userId),
        ),
      )

    // Deactivate the competition_event team membership too
    if (competition.competitionTeamId) {
      await db
        .update(teamMembershipTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(teamMembershipTable.teamId, competition.competitionTeamId),
            eq(teamMembershipTable.userId, data.userId),
          ),
        )
    }

    logInfo({
      message: "[OrganizerAthlete] Teammate removed from registration",
      attributes: {
        registrationId: data.registrationId,
        competitionId: data.competitionId,
        targetUserId: data.userId,
        athleteTeamId: registration.athleteTeamId,
      },
    })

    return { success: true }
  })

// ============================================================================
// A6. cancelPendingTeamInviteFn
// ============================================================================

const cancelPendingTeamInviteInputSchema = z.object({
  invitationId: z.string().min(1),
  competitionId: z.string().min(1),
  registrationId: z.string().min(1),
})

export const cancelPendingTeamInviteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cancelPendingTeamInviteInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("registrationId", data.registrationId)
    addRequestContextAttribute("invitationId", data.invitationId)

    const competition = await loadCompetitionForAuth(data.competitionId)
    requireCanManage(session, competition.organizingTeamId)

    const registration = await loadRegistrationOrThrow(
      data.registrationId,
      data.competitionId,
    )

    if (!registration.athleteTeamId) {
      throw new Error("This registration has no athlete team")
    }

    // Make sure invite belongs to this registration's athlete team
    const invitation = await db.query.teamInvitationTable.findFirst({
      where: and(
        eq(teamInvitationTable.id, data.invitationId),
        eq(teamInvitationTable.teamId, registration.athleteTeamId),
      ),
    })
    if (!invitation) throw new Error("Invitation not found")

    await db
      .update(teamInvitationTable)
      .set({
        status: INVITATION_STATUS.CANCELLED,
        updatedAt: new Date(),
      })
      .where(eq(teamInvitationTable.id, data.invitationId))

    logEntityUpdated({
      entity: "team_invitation",
      id: data.invitationId,
      fields: ["status"],
      attributes: {
        competitionId: data.competitionId,
        registrationId: data.registrationId,
        newStatus: INVITATION_STATUS.CANCELLED,
      },
    })

    return { success: true }
  })

// ============================================================================
// A7. addTeammateToRegistrationFn
// ============================================================================

const addTeammateToRegistrationInputSchema = z.object({
  registrationId: z.string().min(1),
  competitionId: z.string().min(1),
  email: z.string().email().max(255),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
})

export const addTeammateToRegistrationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    addTeammateToRegistrationInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("registrationId", data.registrationId)

    const competition = await loadCompetitionForAuth(data.competitionId)
    requireCanManage(session, competition.organizingTeamId)

    const registration = await loadRegistrationOrThrow(
      data.registrationId,
      data.competitionId,
    )

    if (!registration.athleteTeamId || !registration.divisionId) {
      throw new Error("This registration is not a team registration")
    }

    // Load division
    const division = await db.query.scalingLevelsTable.findFirst({
      where: eq(scalingLevelsTable.id, registration.divisionId),
      columns: { id: true, label: true, teamSize: true },
    })
    if (!division) throw new Error("Division not found")
    const teamSize = division.teamSize ?? 1
    if (teamSize <= 1) {
      throw new Error("Cannot add teammates to an individual registration")
    }

    const normalizedEmail = data.email.toLowerCase()

    // Count active members
    const activeMembers = await db
      .select({
        id: teamMembershipTable.id,
        userId: teamMembershipTable.userId,
      })
      .from(teamMembershipTable)
      .where(
        and(
          eq(teamMembershipTable.teamId, registration.athleteTeamId),
          eq(teamMembershipTable.isActive, true),
        ),
      )

    // Count pending (non-cancelled, not yet accepted) invites
    const pendingInvites = await db
      .select({ id: teamInvitationTable.id, email: teamInvitationTable.email })
      .from(teamInvitationTable)
      .where(
        and(
          eq(teamInvitationTable.teamId, registration.athleteTeamId),
          ne(teamInvitationTable.status, INVITATION_STATUS.CANCELLED),
          isNull(teamInvitationTable.acceptedAt),
        ),
      )

    const currentCount = activeMembers.length + pendingInvites.length
    if (currentCount >= teamSize) {
      throw new Error(
        `Team is already at capacity (${teamSize} members including pending invites)`,
      )
    }

    // Prevent duplicates: existing active user on team, or outstanding invite
    const existingUser = await db.query.userTable.findFirst({
      where: eq(userTable.email, normalizedEmail),
      columns: { id: true },
    })
    if (existingUser) {
      const alreadyMember = activeMembers.find(
        (m) => m.userId === existingUser.id,
      )
      if (alreadyMember) {
        throw new Error("That user is already on the team")
      }
      // Check they're not registered for this competition on a different team
      const existingReg =
        await db.query.competitionRegistrationsTable.findFirst({
          where: and(
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            eq(competitionRegistrationsTable.userId, existingUser.id),
            eq(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.ACTIVE,
            ),
            ne(competitionRegistrationsTable.id, data.registrationId),
          ),
        })
      if (existingReg) {
        throw new Error(
          "That user is already registered for this competition on another registration",
        )
      }
    }
    if (pendingInvites.find((p) => p.email.toLowerCase() === normalizedEmail)) {
      throw new Error("An invitation is already pending for that email")
    }

    // Always create an invitation (forceInvitation behavior) so the teammate
    // completes the acceptance form (answers, signatures) themselves.
    const token = createId()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const invitationId = createTeamInvitationId()
    const guestName = [data.firstName, data.lastName]
      .filter(Boolean)
      .join(" ")
      .trim()
    const metadataJson =
      guestName.length > 0 ? JSON.stringify({ guestName }) : null

    await db.insert(teamInvitationTable).values({
      id: invitationId,
      teamId: registration.athleteTeamId,
      email: normalizedEmail,
      roleId: SYSTEM_ROLES_ENUM.MEMBER,
      isSystemRole: true,
      token,
      invitedBy: session.userId,
      expiresAt,
      status: INVITATION_STATUS.PENDING,
      metadata: metadataJson,
    })

    // Send the invite email
    try {
      const { sendCompetitionTeamInviteEmail } = await import("@/utils/email")
      const inviter = await db.query.userTable.findFirst({
        where: eq(userTable.id, session.userId),
        columns: { firstName: true, lastName: true },
      })
      const inviterName = inviter
        ? `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim() ||
          "Competition Organizer"
        : "Competition Organizer"

      await sendCompetitionTeamInviteEmail({
        email: normalizedEmail,
        invitationToken: token,
        teamName: registration.teamName ?? "Team",
        competitionName: competition.name,
        divisionName: division.label,
        inviterName,
      })
    } catch (err) {
      logInfo({
        message:
          "[OrganizerAthlete] Invite email failed — invitation still created",
        attributes: {
          registrationId: data.registrationId,
          competitionId: data.competitionId,
          error: err instanceof Error ? err.message : String(err),
        },
      })
    }

    logEntityCreated({
      entity: "team_invitation",
      id: invitationId,
      parentId: registration.athleteTeamId,
      parentEntity: "team",
      attributes: {
        competitionId: data.competitionId,
        registrationId: data.registrationId,
        email: normalizedEmail,
      },
    })

    return { success: true, invitationId, token }
  })

// ============================================================================
// A8. createOrganizerVideoSubmissionFn
// ============================================================================

const createOrganizerVideoSubmissionInputSchema = z.object({
  registrationId: z.string().min(1),
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  userId: z.string().min(1),
  videoUrl: z.string().url().max(2000),
  videoIndex: z.number().int().min(0).default(0),
  notes: z.string().max(1000).optional(),
  score: z.string().optional(),
  roundScores: z.array(z.object({ score: z.string() })).optional(),
  scoreStatus: z.enum(["scored", "cap", "dq", "withdrawn"]).optional(),
  secondaryScore: z.string().optional(),
  tieBreakScore: z.string().optional(),
})

export const createOrganizerVideoSubmissionFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    createOrganizerVideoSubmissionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("registrationId", data.registrationId)
    addRequestContextAttribute("trackWorkoutId", data.trackWorkoutId)

    const competition = await loadCompetitionForAuth(data.competitionId)
    requireCanManage(session, competition.organizingTeamId)

    const registration = await loadRegistrationOrThrow(
      data.registrationId,
      data.competitionId,
    )

    // Look up the workout info needed to save the score
    const workoutInfo = await db
      .select({
        workoutId: workouts.id,
        scheme: workouts.scheme,
        scoreType: workouts.scoreType,
        timeCap: workouts.timeCap,
        tiebreakScheme: workouts.tiebreakScheme,
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
      .limit(1)

    const workout = workoutInfo[0]
    if (!workout) throw new Error("Track workout not found")

    const now = new Date()

    // Upsert video submission (one per registration + trackWorkoutId + videoIndex)
    const [existing] = await db
      .select({ id: videoSubmissionsTable.id })
      .from(videoSubmissionsTable)
      .where(
        and(
          eq(videoSubmissionsTable.registrationId, data.registrationId),
          eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
          eq(videoSubmissionsTable.videoIndex, data.videoIndex),
        ),
      )
      .limit(1)

    let submissionId: string
    if (existing) {
      submissionId = existing.id
      await db
        .update(videoSubmissionsTable)
        .set({
          userId: data.userId,
          videoUrl: data.videoUrl,
          notes: data.notes ?? null,
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(videoSubmissionsTable.id, existing.id))
      logEntityUpdated({
        entity: "video_submission",
        id: submissionId,
        attributes: {
          competitionId: data.competitionId,
          registrationId: data.registrationId,
          trackWorkoutId: data.trackWorkoutId,
          videoIndex: data.videoIndex,
        },
      })
    } else {
      submissionId = createVideoSubmissionId()
      await db.insert(videoSubmissionsTable).values({
        id: submissionId,
        registrationId: data.registrationId,
        trackWorkoutId: data.trackWorkoutId,
        videoIndex: data.videoIndex,
        userId: data.userId,
        videoUrl: data.videoUrl,
        notes: data.notes ?? null,
        submittedAt: now,
        reviewStatus: "pending",
      })
      logEntityCreated({
        entity: "video_submission",
        id: submissionId,
        parentId: data.registrationId,
        parentEntity: "competition_registration",
        attributes: {
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          videoIndex: data.videoIndex,
        },
      })
    }

    // Score is owned by videoIndex=0 only. Teammate slots intentionally carry
    // no score and must not overwrite the shared team score.
    const hasScore = data.score !== undefined && data.score.trim().length > 0
    const hasRoundScores =
      data.roundScores !== undefined && data.roundScores.length > 0
    const shouldCreateScore =
      data.videoIndex === 0 && (hasScore || hasRoundScores)

    let scoreResult: {
      resultId: string
      isNew: boolean
    } | null = null

    if (shouldCreateScore) {
      const result = await saveCompetitionScoreFn({
        data: {
          competitionId: data.competitionId,
          organizingTeamId: competition.organizingTeamId,
          trackWorkoutId: data.trackWorkoutId,
          workoutId: workout.workoutId,
          registrationId: data.registrationId,
          userId: data.userId,
          divisionId: registration.divisionId ?? null,
          score: data.score ?? "",
          scoreStatus: data.scoreStatus ?? "scored",
          tieBreakScore: data.tieBreakScore ?? null,
          secondaryScore: data.secondaryScore ?? null,
          roundScores: data.roundScores,
          workout: {
            scheme: workout.scheme,
            scoreType: workout.scoreType,
            timeCap: workout.timeCap,
            tiebreakScheme: workout.tiebreakScheme,
          },
        },
      })
      scoreResult = result.data
    }

    return {
      success: true,
      submissionId,
      scoreId: scoreResult?.resultId ?? null,
    }
  })

// ============================================================================
// A9. deleteOrganizerVideoSubmissionFn
// ============================================================================

const deleteOrganizerVideoSubmissionInputSchema = z.object({
  submissionId: z.string().min(1),
  competitionId: z.string().min(1),
})

export const deleteOrganizerVideoSubmissionFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    deleteOrganizerVideoSubmissionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("submissionId", data.submissionId)

    const competition = await loadCompetitionForAuth(data.competitionId)
    requireCanManage(session, competition.organizingTeamId)

    // Load submission + verify it belongs to a registration in this competition
    const submission = await db.query.videoSubmissionsTable.findFirst({
      where: eq(videoSubmissionsTable.id, data.submissionId),
    })
    if (!submission) throw new Error("Video submission not found")

    const registration = await db.query.competitionRegistrationsTable.findFirst(
      {
        where: and(
          eq(competitionRegistrationsTable.id, submission.registrationId),
          eq(competitionRegistrationsTable.eventId, data.competitionId),
        ),
      },
    )
    if (!registration)
      throw new Error("Submission does not belong to this competition")

    // If videoIndex === 0 this is the score owner — delete the linked score too
    if (submission.videoIndex === 0) {
      // Find the score keyed by (competitionEventId = trackWorkoutId, userId)
      const [score] = await db
        .select({ id: scoresTable.id })
        .from(scoresTable)
        .where(
          and(
            eq(scoresTable.competitionEventId, submission.trackWorkoutId),
            eq(scoresTable.userId, submission.userId),
          ),
        )
        .limit(1)
      if (score) {
        await db
          .delete(scoreRoundsTable)
          .where(eq(scoreRoundsTable.scoreId, score.id))
        await db.delete(scoresTable).where(eq(scoresTable.id, score.id))
        logEntityDeleted({
          entity: "score",
          id: score.id,
          attributes: {
            competitionId: data.competitionId,
            trackWorkoutId: submission.trackWorkoutId,
            userId: submission.userId,
          },
        })
      }
    }

    await db
      .delete(videoSubmissionsTable)
      .where(eq(videoSubmissionsTable.id, data.submissionId))

    logEntityDeleted({
      entity: "video_submission",
      id: data.submissionId,
      attributes: {
        competitionId: data.competitionId,
        registrationId: submission.registrationId,
        trackWorkoutId: submission.trackWorkoutId,
      },
    })

    return { success: true }
  })

// ============================================================================
// A10. resendTeamInviteAsOrganizerFn
// Organizer-scoped resend of a team invitation (captain-only version lives in
// registration-fns.ts and rejects non-captain callers + expired-only invites).
// ============================================================================

const resendTeamInviteAsOrganizerInputSchema = z.object({
  invitationId: z.string().min(1),
  registrationId: z.string().min(1),
  competitionId: z.string().min(1),
})

export const resendTeamInviteAsOrganizerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    resendTeamInviteAsOrganizerInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("registrationId", data.registrationId)
    addRequestContextAttribute("invitationId", data.invitationId)

    const competition = await loadCompetitionForAuth(data.competitionId)
    requireCanManage(session, competition.organizingTeamId)

    const registration = await loadRegistrationOrThrow(
      data.registrationId,
      data.competitionId,
    )
    if (!registration.athleteTeamId)
      throw new Error("This registration has no athlete team")

    const invitation = await db.query.teamInvitationTable.findFirst({
      where: and(
        eq(teamInvitationTable.id, data.invitationId),
        eq(teamInvitationTable.teamId, registration.athleteTeamId),
        eq(teamInvitationTable.status, INVITATION_STATUS.PENDING),
      ),
    })
    if (!invitation) throw new Error("Invitation not found")
    if (invitation.acceptedAt)
      throw new Error("Invitation has already been accepted")

    const newToken = createId()
    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + 30)

    await db
      .update(teamInvitationTable)
      .set({
        token: newToken,
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(teamInvitationTable.id, invitation.id))

    const division = registration.divisionId
      ? await db.query.scalingLevelsTable.findFirst({
          where: eq(scalingLevelsTable.id, registration.divisionId),
          columns: { label: true },
        })
      : null

    const inviter = await db.query.userTable.findFirst({
      where: eq(userTable.id, session.userId),
      columns: { firstName: true, lastName: true },
    })
    const inviterName = inviter
      ? `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim() ||
        "The competition organizer"
      : "The competition organizer"

    const { sendCompetitionTeamInviteEmail } = await import("@/utils/email")
    await sendCompetitionTeamInviteEmail({
      email: invitation.email,
      invitationToken: newToken,
      teamName: registration.teamName ?? "Team",
      competitionName: competition.name,
      divisionName: division?.label ?? "Division",
      inviterName,
    })

    logEntityUpdated({
      entity: "team_invitation",
      id: data.invitationId,
      fields: ["token", "expiresAt"],
      attributes: {
        competitionId: data.competitionId,
        registrationId: data.registrationId,
        resent: true,
      },
    })

    return { success: true, newToken }
  })
