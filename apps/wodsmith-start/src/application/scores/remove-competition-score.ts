import { err, ok, type Result } from "@repo/wodsmith-application/core"
import type {
  CompetitionDivisionId,
  CompetitionEventId,
  CompetitionId,
  OrganizationId,
  RegistrationId,
  UserId,
} from "@repo/wodsmith-application/identity"
import {
  handleRemoveCompetitionScore,
  type ParticipationEventProof,
  type RemoveCompetitionScoreCommand,
  type ScoreCommandError,
  type ScoreRemovalReceipt,
  type ScoreRemovalStore,
  type ScoreRemovalTransaction,
  type ScoreResultId,
} from "@repo/wodsmith-application/scores"
import { and, eq, inArray, isNull, or } from "drizzle-orm"
import type { Database } from "@/db"
import {
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import { teamMembershipTable } from "@/db/schemas/teams"

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

export interface LegacyRemoveCompetitionScoreInput {
  readonly competitionId: string
  readonly organizingTeamId: string
  readonly trackWorkoutId: string
  readonly userId: string
  readonly divisionId: string | null
}

/**
 * This adapter is the sole legacy string-to-domain bridge for organizer clear.
 * The database resolution below proves every branded relationship before use.
 */
export function legacyRemoveCompetitionScoreCommand(
  input: LegacyRemoveCompetitionScoreInput,
): RemoveCompetitionScoreCommand {
  return {
    kind: "RemoveCompetitionScore",
    competitionId: input.competitionId as CompetitionId,
    organizationId: input.organizingTeamId as OrganizationId,
    competitionEventId: input.trackWorkoutId as CompetitionEventId,
    athleteId: input.userId as UserId,
    division: input.divisionId
      ? {
          kind: "division",
          divisionId: input.divisionId as CompetitionDivisionId,
        }
      : { kind: "open" },
    reason: "organizer-clear",
  }
}

function divisionCondition(
  division: RemoveCompetitionScoreCommand["division"],
) {
  return division.kind === "division"
    ? eq(competitionRegistrationsTable.divisionId, division.divisionId)
    : isNull(competitionRegistrationsTable.divisionId)
}

function scoreDivisionCondition(identity: ParticipationEventProof) {
  return identity.division.kind === "division"
    ? eq(scoresTable.scalingLevelId, identity.division.divisionId)
    : isNull(scoresTable.scalingLevelId)
}

function createTransactionAdapter(tx: Transaction): ScoreRemovalTransaction {
  return {
    async resolveIdentity(command) {
      const [competition] = await tx
        .select({
          id: competitionsTable.id,
          organizingTeamId: competitionsTable.organizingTeamId,
        })
        .from(competitionsTable)
        .where(eq(competitionsTable.id, command.competitionId))
        .limit(1)
      if (!competition) return err({ kind: "CompetitionNotFound" })
      if (competition.organizingTeamId !== command.organizationId) {
        return err({
          kind: "ContextMismatch",
          mismatches: ["organization"],
        })
      }

      const [event] = await tx
        .select({
          id: trackWorkoutsTable.id,
          competitionId: programmingTracksTable.competitionId,
        })
        .from(trackWorkoutsTable)
        .innerJoin(
          programmingTracksTable,
          eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
        )
        .where(
          and(
            eq(trackWorkoutsTable.id, command.competitionEventId),
            eq(programmingTracksTable.competitionId, command.competitionId),
          ),
        )
        .limit(1)
      if (!event) return err({ kind: "EventNotFound" })

      const registrations = await tx
        .select({
          id: competitionRegistrationsTable.id,
          competitionId: competitionRegistrationsTable.eventId,
          divisionId: competitionRegistrationsTable.divisionId,
        })
        .from(competitionRegistrationsTable)
        .leftJoin(
          teamMembershipTable,
          and(
            eq(
              teamMembershipTable.teamId,
              competitionRegistrationsTable.athleteTeamId,
            ),
            eq(teamMembershipTable.userId, command.athleteId),
            eq(teamMembershipTable.isActive, true),
          ),
        )
        .where(
          and(
            eq(competitionRegistrationsTable.eventId, command.competitionId),
            eq(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.ACTIVE,
            ),
            divisionCondition(command.division),
            or(
              eq(competitionRegistrationsTable.userId, command.athleteId),
              eq(teamMembershipTable.userId, command.athleteId),
            ),
          ),
        )

      if (registrations.length === 0)
        return err({ kind: "ParticipationNotFound" })
      if (registrations.length > 1)
        return err({ kind: "AmbiguousParticipation" })

      const [registration] = registrations
      if (!registration) return err({ kind: "ParticipationNotFound" })
      return ok({
        registrationId: registration.id as RegistrationId,
        competitionId: registration.competitionId as CompetitionId,
        organizationId: competition.organizingTeamId as OrganizationId,
        competitionEventId: event.id as CompetitionEventId,
        athleteId: command.athleteId,
        division: registration.divisionId
          ? {
              kind: "division",
              divisionId: registration.divisionId as CompetitionDivisionId,
            }
          : { kind: "open" },
      })
    },

    async findResultIds(identity) {
      const rows = await tx
        .select({ id: scoresTable.id })
        .from(scoresTable)
        .where(
          and(
            eq(scoresTable.competitionEventId, identity.competitionEventId),
            eq(scoresTable.userId, identity.athleteId),
            scoreDivisionCondition(identity),
          ),
        )
      return rows.map((row) => row.id as ScoreResultId)
    },

    async removeRoundProjections(resultIds) {
      await tx
        .delete(scoreRoundsTable)
        .where(inArray(scoreRoundsTable.scoreId, [...resultIds]))
    },

    async removeResultProjections(resultIds) {
      await tx
        .delete(scoresTable)
        .where(inArray(scoresTable.id, [...resultIds]))
    },
  }
}

function createRemovalStore(db: Database): ScoreRemovalStore {
  return {
    transaction: (work) =>
      db.transaction((tx) => work(createTransactionAdapter(tx))),
  }
}

// @lat: [[domain#Domain Model#Scoring#Authoritative score removal]]
export function removeCompetitionScore(input: {
  readonly db: Database
  readonly command: RemoveCompetitionScoreCommand
}): Promise<Result<ScoreRemovalReceipt, ScoreCommandError>> {
  return handleRemoveCompetitionScore({
    command: input.command,
    store: createRemovalStore(input.db),
  })
}
