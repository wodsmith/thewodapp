/**
 * Cohost Registration Server Functions
 * Mirrors organizer registration functions for cohost access.
 * Uses requireCohostPermission instead of requireTeamPermission.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray, ne } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  COMMERCE_PAYMENT_STATUS,
  competitionEventsTable,
  competitionHeatAssignmentsTable,
  competitionRegistrationAnswersTable,
  competitionRegistrationQuestionsTable,
  competitionRegistrationsTable,
  competitionsTable,
  createTeamId,
  createTeamMembershipId,
  createUserId,
  INVITATION_STATUS,
  REGISTRATION_STATUS,
  scalingLevelsTable,
  scoresTable,
  teamInvitationTable,
  teamMembershipTable,
  teamTable,
  userTable,
} from "@/db/schema"
import { getRegistrationFee } from "@/lib/commerce-stubs"
import { getEvlog } from "@/lib/evlog"
import {
  addRequestContextAttribute,
  logEntityCreated,
  logInfo,
  updateRequestContext,
} from "@/lib/logging"
import {
  notifyRegistrationConfirmed,
  registerForCompetition,
} from "@/lib/registration-stubs"
import {
  requireCohostCompetitionOwnership,
  requireCohostPermission,
} from "@/utils/cohost-auth"
import { requireVerifiedEmail } from "@/utils/auth"

// ============================================================================
// Input Schemas
// ============================================================================

const getOrganizerRegistrationsInputSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionFilter: z.string().optional(),
})

const removeRegistrationInputSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
  registrationId: z.string().min(1, "Registration ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const transferRegistrationDivisionInputSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
  registrationId: z.string().min(1, "Registration ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  targetDivisionId: z.string().min(1, "Target division ID is required"),
})

const createManualRegistrationInputSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
  competitionId: z.string().min(1),
  athleteEmail: z.string().email(),
  athleteFirstName: z.string().max(255).optional(),
  athleteLastName: z.string().max(255).optional(),
  divisionId: z.string().min(1),
  paymentStatus: z.enum(["COMP", "PAID_OFFLINE"]),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().max(5000),
      }),
    )
    .optional(),
  teamName: z.string().max(255).optional(),
  teammates: z
    .array(
      z.object({
        email: z.string().email(),
        firstName: z.string().max(255).optional(),
        lastName: z.string().max(255).optional(),
      }),
    )
    .optional(),
})

const getRegistrationQuestionsInputSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse options JSON string to array
 */
function parseOptions(options: string | null): string[] | null {
  if (!options) return null
  try {
    const parsed = JSON.parse(options)
    if (Array.isArray(parsed)) return parsed
    return null
  } catch {
    return null
  }
}

/**
 * Store registration answers in the database
 */
async function storeRegistrationAnswers(
  registrationId: string,
  userId: string,
  answers: Array<{ questionId: string; answer: string }> | undefined,
): Promise<void> {
  if (!answers || answers.length === 0) return

  const db = getDb()

  await db.insert(competitionRegistrationAnswersTable).values(
    answers.map((answer) => ({
      questionId: answer.questionId,
      registrationId,
      userId,
      answer: answer.answer,
    })),
  )
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get registrations for cohost view with full user and division details
 */
export const cohostGetOrganizerRegistrationsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getOrganizerRegistrationsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "viewRegistrations")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    const whereConditions = [
      eq(competitionRegistrationsTable.eventId, data.competitionId),
    ]

    const registrations = await db.query.competitionRegistrationsTable.findMany(
      {
        where: and(...whereConditions),
        orderBy: (table, { desc }) => [desc(table.registeredAt)],
        with: {
          user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              gender: true,
              dateOfBirth: true,
              affiliateName: true,
            },
          },
          division: {
            columns: {
              id: true,
              label: true,
              teamSize: true,
            },
          },
          athleteTeam: {
            with: {
              memberships: {
                columns: {
                  id: true,
                  userId: true,
                  joinedAt: true,
                },
                where: eq(teamMembershipTable.isActive, true),
                with: {
                  user: {
                    columns: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      avatar: true,
                      affiliateName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    )

    const filteredRegistrations = data.divisionFilter
      ? registrations.filter((r) => r.divisionId === data.divisionFilter)
      : registrations

    return { registrations: filteredRegistrations }
  })

/**
 * Create a manual registration from the cohost dashboard
 */
export const cohostCreateManualRegistrationFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    createManualRegistrationInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    await requireCohostPermission(input.competitionTeamId, "editRegistrations")
    await requireCohostCompetitionOwnership(input.competitionTeamId, input.competitionId)

    const session = await requireVerifiedEmail()
    const db = getDb()

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", input.competitionId)
    getEvlog()?.set({
      action: "cohost_manual_register",
      registration: { competitionId: input.competitionId },
    })

    // 1. Get competition
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
      columns: { id: true, organizingTeamId: true },
    })

    if (!competition) throw new Error("Competition not found")

    // 2. Look up or create athlete user
    const athleteEmail = input.athleteEmail.toLowerCase()
    let athleteUser = await db.query.userTable.findFirst({
      where: eq(userTable.email, athleteEmail),
    })

    if (!athleteUser) {
      const userId = createUserId()
      await db.insert(userTable).values({
        id: userId,
        email: athleteEmail,
        firstName: input.athleteFirstName ?? null,
        lastName: input.athleteLastName ?? null,
        passwordHash: null,
        emailVerified: null,
      })

      athleteUser = await db.query.userTable.findFirst({
        where: eq(userTable.id, userId),
      })

      if (!athleteUser) {
        throw new Error("Failed to create placeholder user")
      }

      // Create personal team
      const personalTeamId = createTeamId()
      const personalTeamName = `${input.athleteFirstName || "Personal"}'s Team (personal)`
      const personalTeamSlug = `${
        input.athleteFirstName?.toLowerCase() || "personal"
      }-${userId.slice(-6)}`

      await db.insert(teamTable).values({
        id: personalTeamId,
        name: personalTeamName,
        slug: personalTeamSlug,
        description:
          "Personal team for individual programming track subscriptions",
        isPersonalTeam: true,
        personalTeamOwnerId: userId,
      })

      await db.insert(teamMembershipTable).values({
        id: createTeamMembershipId(),
        teamId: personalTeamId,
        userId,
        roleId: "owner",
        isSystemRole: true,
        joinedAt: new Date(),
        isActive: true,
      })

      logEntityCreated({
        entity: "user",
        id: userId,
        attributes: {
          email: athleteEmail,
          isPlaceholder: true,
          createdByCohostManualRegistration: true,
        },
      })
    }

    // 3. Determine final payment status
    const divisionFeeCents = await getRegistrationFee(
      input.competitionId,
      input.divisionId,
    )

    const finalPaymentStatus =
      divisionFeeCents === 0
        ? COMMERCE_PAYMENT_STATUS.FREE
        : input.paymentStatus

    // 4. Register for competition (bypasses registration window)
    const result = await registerForCompetition({
      competitionId: input.competitionId,
      userId: athleteUser.id,
      divisionId: input.divisionId,
      teamName: input.teamName,
      teammates: input.teammates,
      isOrganizerOverride: true,
    })

    // 5. Set payment status on registration
    await db
      .update(competitionRegistrationsTable)
      .set({ paymentStatus: finalPaymentStatus })
      .where(eq(competitionRegistrationsTable.id, result.registrationId))

    // 6. Store answers
    await storeRegistrationAnswers(
      result.registrationId,
      athleteUser.id,
      input.answers,
    )

    // 7. Send registration confirmation email
    await notifyRegistrationConfirmed({
      userId: athleteUser.id,
      registrationId: result.registrationId,
      competitionId: input.competitionId,
      isPaid: divisionFeeCents > 0,
    })

    logInfo({
      message: "[Cohost Registration] Manual registration created",
      attributes: {
        registrationId: result.registrationId,
        competitionId: input.competitionId,
        athleteEmail,
        divisionId: input.divisionId,
        paymentStatus: finalPaymentStatus,
      },
    })

    return { success: true, registrationId: result.registrationId }
  })

/**
 * Remove a registration (soft delete) by a cohost
 */
export const cohostRemoveRegistrationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    removeRegistrationInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    await requireCohostPermission(input.competitionTeamId, "editRegistrations")
    await requireCohostCompetitionOwnership(input.competitionTeamId, input.competitionId)

    const session = await requireVerifiedEmail()
    const db = getDb()

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", input.competitionId)
    addRequestContextAttribute("registrationId", input.registrationId)
    getEvlog()?.set({
      action: "cohost_remove_registration",
      registration: {
        id: input.registrationId,
        competitionId: input.competitionId,
      },
    })

    // Get the registration and verify it belongs to this competition
    const registration = await db.query.competitionRegistrationsTable.findFirst(
      {
        where: and(
          eq(competitionRegistrationsTable.id, input.registrationId),
          eq(competitionRegistrationsTable.eventId, input.competitionId),
        ),
      },
    )

    if (!registration) throw new Error("Registration not found")

    if (registration.status === REGISTRATION_STATUS.REMOVED) {
      throw new Error("Registration is already removed")
    }

    logInfo({
      message: "[Cohost Registration] Removing registration",
      attributes: {
        registrationId: input.registrationId,
        competitionId: input.competitionId,
        userId: registration.userId,
        athleteTeamId: registration.athleteTeamId ?? "none",
      },
    })

    // Perform all writes in a transaction for atomicity
    await db.transaction(async (tx) => {
      // Set registration status to REMOVED
      await tx
        .update(competitionRegistrationsTable)
        .set({
          status: REGISTRATION_STATUS.REMOVED,
          updatedAt: new Date(),
        })
        .where(eq(competitionRegistrationsTable.id, input.registrationId))

      // Deactivate the captain's team membership
      await tx
        .update(teamMembershipTable)
        .set({ isActive: false })
        .where(eq(teamMembershipTable.id, registration.teamMemberId))

      // For team registrations, deactivate all athlete team memberships and cancel invitations
      if (registration.athleteTeamId) {
        await tx
          .update(teamMembershipTable)
          .set({ isActive: false })
          .where(
            and(
              eq(teamMembershipTable.teamId, registration.athleteTeamId),
              eq(teamMembershipTable.isActive, true),
            ),
          )

        await tx
          .update(teamInvitationTable)
          .set({ status: INVITATION_STATUS.CANCELLED })
          .where(
            and(
              eq(teamInvitationTable.teamId, registration.athleteTeamId),
              eq(teamInvitationTable.status, INVITATION_STATUS.PENDING),
            ),
          )
      }

      // Delete heat assignments for this registration
      await tx
        .delete(competitionHeatAssignmentsTable)
        .where(
          eq(
            competitionHeatAssignmentsTable.registrationId,
            input.registrationId,
          ),
        )

      // Delete scores for the registered user(s) in this competition's events
      const competitionEvents = await tx
        .select({ id: competitionEventsTable.id })
        .from(competitionEventsTable)
        .where(eq(competitionEventsTable.competitionId, input.competitionId))

      if (competitionEvents.length > 0) {
        const eventIds = competitionEvents.map((e) => e.id)
        const userIds = [registration.userId]

        if (registration.athleteTeamId) {
          const teammates = await tx
            .select({ userId: teamMembershipTable.userId })
            .from(teamMembershipTable)
            .where(eq(teamMembershipTable.teamId, registration.athleteTeamId))

          for (const tm of teammates) {
            if (tm.userId && !userIds.includes(tm.userId)) {
              userIds.push(tm.userId)
            }
          }
        }

        await tx
          .delete(scoresTable)
          .where(
            and(
              inArray(scoresTable.competitionEventId, eventIds),
              inArray(scoresTable.userId, userIds),
            ),
          )
      }
    })

    logInfo({
      message: "[Cohost Registration] Registration removed successfully",
      attributes: {
        registrationId: input.registrationId,
        competitionId: input.competitionId,
        userId: registration.userId,
      },
    })

    return { success: true }
  })

/**
 * Transfer an athlete's registration to a different division (cohost)
 */
export const cohostTransferRegistrationDivisionFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    transferRegistrationDivisionInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    await requireCohostPermission(input.competitionTeamId, "editRegistrations")
    await requireCohostCompetitionOwnership(input.competitionTeamId, input.competitionId)

    const session = await requireVerifiedEmail()
    const db = getDb()

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", input.competitionId)
    addRequestContextAttribute("registrationId", input.registrationId)
    addRequestContextAttribute("targetDivisionId", input.targetDivisionId)

    // Get the registration
    const registration = await db.query.competitionRegistrationsTable.findFirst(
      {
        where: and(
          eq(competitionRegistrationsTable.id, input.registrationId),
          eq(competitionRegistrationsTable.eventId, input.competitionId),
        ),
      },
    )

    if (!registration) throw new Error("Registration not found")

    if (registration.status === REGISTRATION_STATUS.REMOVED) {
      throw new Error("Cannot transfer a removed registration")
    }

    if (registration.divisionId === input.targetDivisionId) {
      throw new Error("Registration is already in this division")
    }

    // Fetch source + target divisions, compare teamSize
    const sourceDivision = registration.divisionId
      ? await db.query.scalingLevelsTable.findFirst({
          where: eq(scalingLevelsTable.id, registration.divisionId),
          columns: { id: true, teamSize: true },
        })
      : null

    const targetDivision = await db.query.scalingLevelsTable.findFirst({
      where: eq(scalingLevelsTable.id, input.targetDivisionId),
      columns: { id: true, teamSize: true },
    })

    if (!targetDivision) throw new Error("Target division not found")

    const sourceTeamSize = sourceDivision?.teamSize ?? 1
    const targetTeamSize = targetDivision.teamSize

    if (sourceTeamSize !== targetTeamSize) {
      throw new Error(
        `Cannot transfer between divisions with different team sizes (${sourceTeamSize} → ${targetTeamSize})`,
      )
    }

    // Unique constraint check
    const existingRegistration =
      await db.query.competitionRegistrationsTable.findFirst({
        where: and(
          eq(competitionRegistrationsTable.eventId, input.competitionId),
          eq(competitionRegistrationsTable.userId, registration.userId),
          eq(competitionRegistrationsTable.divisionId, input.targetDivisionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
        columns: { id: true },
      })

    if (existingRegistration) {
      throw new Error(
        "Athlete already has a registration in the target division",
      )
    }

    logInfo({
      message:
        "[Cohost Registration] Transferring registration to new division",
      attributes: {
        registrationId: input.registrationId,
        competitionId: input.competitionId,
        fromDivisionId: registration.divisionId ?? "none",
        toDivisionId: input.targetDivisionId,
        userId: registration.userId,
      },
    })

    // Perform writes in a transaction
    let removedHeatAssignments = 0

    await db.transaction(async (tx) => {
      await tx
        .update(competitionRegistrationsTable)
        .set({
          divisionId: input.targetDivisionId,
          updatedAt: new Date(),
        })
        .where(eq(competitionRegistrationsTable.id, input.registrationId))

      const deletedHeatAssignments = await tx
        .delete(competitionHeatAssignmentsTable)
        .where(
          eq(
            competitionHeatAssignmentsTable.registrationId,
            input.registrationId,
          ),
        )

      removedHeatAssignments = deletedHeatAssignments[0]?.affectedRows ?? 0
    })

    logInfo({
      message: "[Cohost Registration] Division transfer completed",
      attributes: {
        registrationId: input.registrationId,
        competitionId: input.competitionId,
        toDivisionId: input.targetDivisionId,
        removedHeatAssignments: String(removedHeatAssignments),
      },
    })

    return { success: true, removedHeatAssignments }
  })

/**
 * Get registration questions for a competition (cohost view)
 */
export const cohostGetRegistrationQuestionsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getRegistrationQuestionsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "viewRegistrations")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
      columns: { groupId: true },
    })

    // Fetch competition-specific athlete questions
    const competitionQuestions = await db
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
      .orderBy(competitionRegistrationQuestionsTable.sortOrder)

    // If competition belongs to a series, also fetch series-level questions
    let seriesQuestions: (typeof competitionRegistrationQuestionsTable.$inferSelect)[] =
      []
    if (competition?.groupId) {
      seriesQuestions = await db
        .select()
        .from(competitionRegistrationQuestionsTable)
        .where(
          and(
            eq(
              competitionRegistrationQuestionsTable.groupId,
              competition.groupId,
            ),
            eq(competitionRegistrationQuestionsTable.questionTarget, "athlete"),
          ),
        )
        .orderBy(competitionRegistrationQuestionsTable.sortOrder)
    }

    const questions = [
      ...seriesQuestions.map((q) => ({
        id: q.id,
        competitionId: q.competitionId,
        groupId: q.groupId,
        type: q.type,
        label: q.label,
        helpText: q.helpText,
        options: parseOptions(q.options),
        required: q.required,
        forTeammates: q.forTeammates,
        sortOrder: q.sortOrder,
        questionTarget: q.questionTarget,
        source: "series" as const,
      })),
      ...competitionQuestions.map((q) => ({
        id: q.id,
        competitionId: q.competitionId,
        groupId: q.groupId,
        type: q.type,
        label: q.label,
        helpText: q.helpText,
        options: parseOptions(q.options),
        required: q.required,
        forTeammates: q.forTeammates,
        sortOrder: q.sortOrder,
        questionTarget: q.questionTarget,
        source: "competition" as const,
      })),
    ]

    return { questions }
  })

/**
 * Get all registration answers for a competition (cohost view)
 */
export const cohostGetCompetitionRegistrationAnswersFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
        competitionId: z.string().min(1, "Competition ID is required"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "viewRegistrations")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    const answers = await db
      .select({
        id: competitionRegistrationAnswersTable.id,
        questionId: competitionRegistrationAnswersTable.questionId,
        registrationId: competitionRegistrationAnswersTable.registrationId,
        userId: competitionRegistrationAnswersTable.userId,
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
      .where(eq(competitionRegistrationsTable.eventId, data.competitionId))

    const answersByRegistration = answers.reduce(
      (acc, answer) => {
        if (!acc[answer.registrationId]) {
          acc[answer.registrationId] = []
        }
        acc[answer.registrationId]?.push({
          id: answer.id,
          questionId: answer.questionId,
          userId: answer.userId,
          answer: answer.answer,
        })
        return acc
      },
      {} as Record<
        string,
        Array<{
          id: string
          questionId: string
          userId: string
          answer: string
        }>
      >,
    )

    return { answersByRegistration }
  })
