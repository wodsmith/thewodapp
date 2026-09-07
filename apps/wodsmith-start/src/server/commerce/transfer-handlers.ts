import { and, eq, inArray, isNull } from "drizzle-orm"
import type { Database } from "@/db"
import {
  competitionEventsTable,
  competitionHeatAssignmentsTable,
  competitionRegistrationAnswersTable,
  competitionRegistrationsTable,
  SYSTEM_ROLES_ENUM,
  scoreRoundsTable,
  scoresTable,
  teamMembershipTable,
  waiverSignaturesTable,
  waiversTable,
} from "@/db/schema"

interface TransferContext {
  purchaseId: string
  sourceUserId: string
  targetUserId: string
  competitionId: string
  answers?: Array<{ questionId: string; answer: string }>
  waiverSignatures?: Array<{ waiverId: string; signatureName: string }>
}

type TransferTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

export async function handleCompetitionRegistrationTransfer(
  db: TransferTransaction,
  ctx: TransferContext,
) {
  // 1. Find the registration linked to this purchase
  const registration = await db.query.competitionRegistrationsTable.findFirst({
    where: and(
      eq(competitionRegistrationsTable.commercePurchaseId, ctx.purchaseId),
      eq(competitionRegistrationsTable.status, "active"),
    ),
  })

  if (!registration) {
    throw new Error("No active registration found for this purchase")
  }

  if (
    registration.userId !== ctx.sourceUserId ||
    registration.eventId !== ctx.competitionId
  ) {
    throw new Error("Registration no longer belongs to this transfer")
  }

  // Acceptance has already read the transfer, so use a current locking read
  // to validate the original registration before changing memberships/results.
  const [currentRegistration] = await db
    .select({ id: competitionRegistrationsTable.id })
    .from(competitionRegistrationsTable)
    .where(
      and(
        eq(competitionRegistrationsTable.id, registration.id),
        eq(competitionRegistrationsTable.userId, ctx.sourceUserId),
        eq(competitionRegistrationsTable.eventId, ctx.competitionId),
        eq(competitionRegistrationsTable.status, "active"),
        registration.divisionId === null
          ? isNull(competitionRegistrationsTable.divisionId)
          : eq(
              competitionRegistrationsTable.divisionId,
              registration.divisionId,
            ),
      ),
    )
    .for("update")
  if (!currentRegistration)
    throw new Error("Registration no longer belongs to this transfer")

  const waivers = await db.query.waiversTable.findMany({
    where: eq(waiversTable.competitionId, ctx.competitionId),
  })
  const signatures = ctx.waiverSignatures ?? []
  const signedIds = new Set(signatures.map((signature) => signature.waiverId))
  if (signedIds.size !== signatures.length) {
    throw new Error("Each waiver can only be signed once per acceptance")
  }
  if (
    signatures.some(
      (signature) =>
        !waivers.some((waiver) => waiver.id === signature.waiverId),
    )
  ) {
    throw new Error("Waiver does not belong to this competition")
  }
  if (waivers.some((waiver) => waiver.required && !signedIds.has(waiver.id))) {
    throw new Error(
      "Please sign all required waivers before accepting the transfer",
    )
  }

  // 2. Check target user doesn't already have registration in same division
  //    The unique index is on (eventId, userId, divisionId) regardless of status,
  //    so we must handle both active and removed registrations.
  if (registration.divisionId) {
    const existingReg = await db.query.competitionRegistrationsTable.findFirst({
      where: and(
        eq(competitionRegistrationsTable.eventId, registration.eventId),
        eq(competitionRegistrationsTable.userId, ctx.targetUserId),
        eq(competitionRegistrationsTable.divisionId, registration.divisionId),
      ),
    })
    if (existingReg) {
      if (existingReg.status === "active") {
        throw new Error(
          "Target user already has an active registration in this division",
        )
      }
      // Remove the old (non-active) registration so the unique index doesn't block
      await db
        .delete(competitionRegistrationsTable)
        .where(eq(competitionRegistrationsTable.id, existingReg.id))
    }
  }

  // 3. Deactivate source user's team membership in the competition_event team
  if (registration.teamMemberId) {
    await db
      .update(teamMembershipTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(teamMembershipTable.id, registration.teamMemberId))
  }

  // 4. Create new team membership for target user in the competition_event team
  let newTeamMemberId: string | null = null
  if (registration.teamMemberId) {
    const oldMembership = await db.query.teamMembershipTable.findFirst({
      where: eq(teamMembershipTable.id, registration.teamMemberId),
    })

    if (oldMembership) {
      const inserted = await db
        .insert(teamMembershipTable)
        .values({
          teamId: oldMembership.teamId,
          userId: ctx.targetUserId,
          roleId: oldMembership.roleId,
          isSystemRole: oldMembership.isSystemRole,
          isActive: true,
          joinedAt: new Date(),
        })
        .$returningId()
      newTeamMemberId = inserted[0]?.id ?? null
    }
  }

  // 5. Update registration: userId, captainUserId, teamMemberId
  await db
    .update(competitionRegistrationsTable)
    .set({
      userId: ctx.targetUserId,
      captainUserId: ctx.targetUserId,
      teamMemberId: newTeamMemberId ?? registration.teamMemberId,
      updatedAt: new Date(),
    })
    .where(eq(competitionRegistrationsTable.id, registration.id))

  // 6. Delete heat assignments (athlete needs re-scheduling)
  await db
    .delete(competitionHeatAssignmentsTable)
    .where(eq(competitionHeatAssignmentsTable.registrationId, registration.id))

  // 7. Delete old registration answers
  await db
    .delete(competitionRegistrationAnswersTable)
    .where(
      eq(competitionRegistrationAnswersTable.registrationId, registration.id),
    )

  // 8. Save new registration answers if provided
  if (ctx.answers && ctx.answers.length > 0) {
    for (const answer of ctx.answers) {
      await db.insert(competitionRegistrationAnswersTable).values({
        registrationId: registration.id,
        questionId: answer.questionId,
        userId: ctx.targetUserId,
        answer: answer.answer,
      })
    }
  }

  // 9. Save waiver signatures if provided
  if (ctx.waiverSignatures && ctx.waiverSignatures.length > 0) {
    for (const sig of ctx.waiverSignatures) {
      const acknowledgement = {
        signatureName: sig.signatureName,
        registrationId: registration.id,
        signedAt: new Date(),
      }
      await db
        .insert(waiverSignaturesTable)
        .values({
          waiverId: sig.waiverId,
          userId: ctx.targetUserId,
          ...acknowledgement,
        })
        .onDuplicateKeyUpdate({ set: acknowledgement })
    }
  }

  // 10. For team registrations: swap source→target in athlete team memberships
  if (registration.athleteTeamId) {
    const athleteTeamMemberships = await db
      .select()
      .from(teamMembershipTable)
      .where(
        and(
          eq(teamMembershipTable.teamId, registration.athleteTeamId),
          eq(teamMembershipTable.userId, ctx.sourceUserId),
          eq(teamMembershipTable.isActive, true),
        ),
      )

    for (const membership of athleteTeamMemberships) {
      await db
        .update(teamMembershipTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(teamMembershipTable.id, membership.id))
    }

    await db.insert(teamMembershipTable).values({
      teamId: registration.athleteTeamId,
      userId: ctx.targetUserId,
      roleId: SYSTEM_ROLES_ENUM.CAPTAIN,
      isSystemRole: true,
      isActive: true,
      joinedAt: new Date(),
    })
  }

  // 11. Scores reference track-workout IDs, and belong to one division.
  // Preserve the source athlete's results in every retained registration.
  const competitionEvents = await db
    .select({ trackWorkoutId: competitionEventsTable.trackWorkoutId })
    .from(competitionEventsTable)
    .where(eq(competitionEventsTable.competitionId, ctx.competitionId))

  if (competitionEvents.length > 0) {
    const eventIds = competitionEvents.map((e) => e.trackWorkoutId)
    const transferredScores = await db
      .select({ id: scoresTable.id })
      .from(scoresTable)
      .where(
        and(
          inArray(scoresTable.competitionEventId, eventIds),
          eq(scoresTable.userId, ctx.sourceUserId),
          registration.divisionId
            ? eq(scoresTable.scalingLevelId, registration.divisionId)
            : isNull(scoresTable.scalingLevelId),
        ),
      )
      .for("update")

    if (transferredScores.length > 0) {
      const scoreIds = transferredScores.map((score) => score.id)
      await db
        .delete(scoreRoundsTable)
        .where(inArray(scoreRoundsTable.scoreId, scoreIds))
      await db.delete(scoresTable).where(inArray(scoresTable.id, scoreIds))
    }
  }
}
