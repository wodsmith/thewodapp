import { and, eq, isNull, or } from "drizzle-orm"
import {
  competitionEventsTable,
  competitionRegistrationsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { teamMembershipTable } from "@/db/schemas/teams"
import type { ResultTransaction } from "./repository"

export class RegistrationChangedError extends Error {
  constructor() {
    super(
      "Registration changed. Reload the competition before submitting a result.",
    )
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
  },
): Promise<void> {
  const event = await db.query.competitionEventsTable.findFirst({
    columns: { competitionId: true },
    where: eq(competitionEventsTable.trackWorkoutId, target.trackWorkoutId),
  })
  // Programmed workouts can also be persisted outside a competition.
  if (!event && !target.registrationId) return
  if (!event) throw new RegistrationChangedError()

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
