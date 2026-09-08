import { and, eq, inArray, isNull, ne, or } from "drizzle-orm"
import { purchaseTransfersTable } from "@/db/schemas/commerce"
import {
  competitionEventsTable,
  competitionRegistrationsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { teamMembershipTable } from "@/db/schemas/teams"
import type { ResultTransaction } from "./repository"

export class RegistrationChangedError extends Error {
  constructor(
    message = "Registration changed. Reload the competition before submitting a result.",
  ) {
    super(message)
    this.name = "RegistrationChangedError"
  }
}

// @lat: [[registration#Registration#Division Transfer#Concurrent submissions]]
export async function lockRegistrationForResult(
  db: ResultTransaction,
  target: {
    athleteUserId: string
    trackWorkoutId: string
    divisionId: string | null
    registrationId?: string
    competitionId?: string
  },
): Promise<void> {
  const events = await db.query.competitionEventsTable.findMany({
    columns: { competitionId: true },
    where: and(
      eq(competitionEventsTable.trackWorkoutId, target.trackWorkoutId),
      target.competitionId
        ? eq(competitionEventsTable.competitionId, target.competitionId)
        : undefined,
    ),
    limit: 2,
  })
  // Only standalone programmed-workout persistence may omit competition scope.
  // Never choose an arbitrary competition when a workout is reused.
  if (events.length === 0 && !target.competitionId && !target.registrationId)
    return
  if (events.length !== 1) throw new RegistrationChangedError()
  const event = events[0]
  await assertUnambiguousResultOwnership(db, {
    ...target,
    competitionId: event.competitionId,
  })

  // Discover candidate IDs, then lock by primary key. Locking a division index
  // range here can deadlock with the move that is changing that index key.
  // Discovery can use a snapshot; eligibility below must use current reads.
  const candidates = await db
    .select({ id: competitionRegistrationsTable.id })
    .from(competitionRegistrationsTable)
    .leftJoin(
      teamMembershipTable,
      and(
        eq(
          teamMembershipTable.teamId,
          competitionRegistrationsTable.athleteTeamId,
        ),
        eq(teamMembershipTable.userId, target.athleteUserId),
        eq(teamMembershipTable.isActive, true),
      ),
    )
    .where(
      and(
        eq(competitionRegistrationsTable.eventId, event.competitionId),
        eq(competitionRegistrationsTable.status, REGISTRATION_STATUS.ACTIVE),
        target.divisionId === null
          ? isNull(competitionRegistrationsTable.divisionId)
          : eq(competitionRegistrationsTable.divisionId, target.divisionId),
        target.registrationId
          ? eq(competitionRegistrationsTable.id, target.registrationId)
          : undefined,
        or(
          eq(competitionRegistrationsTable.userId, target.athleteUserId),
          eq(teamMembershipTable.userId, target.athleteUserId),
        ),
      ),
    )
    .orderBy(competitionRegistrationsTable.id)

  for (const candidate of candidates) {
    const [registration] = await db
      .select({
        userId: competitionRegistrationsTable.userId,
        eventId: competitionRegistrationsTable.eventId,
        divisionId: competitionRegistrationsTable.divisionId,
        status: competitionRegistrationsTable.status,
        athleteTeamId: competitionRegistrationsTable.athleteTeamId,
      })
      .from(competitionRegistrationsTable)
      .where(eq(competitionRegistrationsTable.id, candidate.id))
      .for("update")
    if (
      !registration ||
      registration.eventId !== event.competitionId ||
      registration.divisionId !== target.divisionId ||
      registration.status !== REGISTRATION_STATUS.ACTIVE
    )
      continue
    if (registration.userId === target.athleteUserId) return
    if (registration.athleteTeamId) {
      const [membership] = await db
        .select({ id: teamMembershipTable.id })
        .from(teamMembershipTable)
        .where(
          and(
            eq(teamMembershipTable.teamId, registration.athleteTeamId),
            eq(teamMembershipTable.userId, target.athleteUserId),
            eq(teamMembershipTable.isActive, true),
          ),
        )
        .for("update")
      if (membership) return
    }
  }
  throw new RegistrationChangedError()
}

// A physical score has no competition ID. Include removed registrations,
// inactive team memberships and completed ownership transfers when checking
// whether another participation may own the same legacy score tuple.
export async function assertUnambiguousResultOwnership(
  db: ResultTransaction,
  target: {
    competitionId: string
    trackWorkoutId: string
    athleteUserId: string
    divisionId: string | null
  },
): Promise<void> {
  const otherEvents = await db
    .select({ competitionId: competitionEventsTable.competitionId })
    .from(competitionEventsTable)
    .where(
      and(
        eq(competitionEventsTable.trackWorkoutId, target.trackWorkoutId),
        ne(competitionEventsTable.competitionId, target.competitionId),
      ),
    )
    .for("share")
  if (otherEvents.length === 0) return

  const [otherParticipation] = await db
    .select({ id: competitionRegistrationsTable.id })
    .from(competitionRegistrationsTable)
    .leftJoin(
      teamMembershipTable,
      and(
        eq(
          teamMembershipTable.teamId,
          competitionRegistrationsTable.athleteTeamId,
        ),
        eq(teamMembershipTable.userId, target.athleteUserId),
      ),
    )
    .leftJoin(
      purchaseTransfersTable,
      and(
        eq(
          purchaseTransfersTable.purchaseId,
          competitionRegistrationsTable.commercePurchaseId,
        ),
        eq(purchaseTransfersTable.transferState, "COMPLETED"),
        or(
          eq(purchaseTransfersTable.sourceUserId, target.athleteUserId),
          eq(purchaseTransfersTable.targetUserId, target.athleteUserId),
        ),
      ),
    )
    .where(
      and(
        inArray(
          competitionRegistrationsTable.eventId,
          otherEvents.map((event) => event.competitionId),
        ),
        target.divisionId === null
          ? isNull(competitionRegistrationsTable.divisionId)
          : eq(competitionRegistrationsTable.divisionId, target.divisionId),
        or(
          eq(competitionRegistrationsTable.userId, target.athleteUserId),
          eq(competitionRegistrationsTable.captainUserId, target.athleteUserId),
          eq(teamMembershipTable.userId, target.athleteUserId),
          eq(purchaseTransfersTable.sourceUserId, target.athleteUserId),
          eq(purchaseTransfersTable.targetUserId, target.athleteUserId),
        ),
      ),
    )
    .for("share")
    .limit(1)
  if (otherParticipation)
    throw new RegistrationChangedError(
      "This result may belong to registrations in multiple competitions. Contact competition support to resolve its ownership; all results have been preserved.",
    )
}
