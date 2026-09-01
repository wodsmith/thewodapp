import { and, eq, isNull } from "drizzle-orm"
import type { Database } from "@/db"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import type { CompetitionResultRevision } from "./decision"
import { CompetitionResultError } from "./domain"

export interface CompetitionResultTarget {
  athleteUserId: string
  ownerTeamId: string
  workoutId: string
  trackWorkoutId: string
  divisionId: string | null
}

/** Atomically replaces the current competition result and its exact round set. */
export async function persistCompetitionResult(input: {
  db: Database
  target: CompetitionResultTarget
  revision: CompetitionResultRevision
  recordedAt: Date
}): Promise<{ scoreId: string; isNew: boolean }> {
  const { db, target, revision, recordedAt } = input

  return db.transaction(async (tx) => {
    const exactKey = and(
      eq(scoresTable.competitionEventId, target.trackWorkoutId),
      eq(scoresTable.userId, target.athleteUserId),
      target.divisionId
        ? eq(scoresTable.scalingLevelId, target.divisionId)
        : isNull(scoresTable.scalingLevelId),
    )
    const [existing] = await tx
      .select({ id: scoresTable.id })
      .from(scoresTable)
      .where(exactKey)
      .limit(1)

    await tx
      .insert(scoresTable)
      .values({
        userId: target.athleteUserId,
        teamId: target.ownerTeamId,
        workoutId: target.workoutId,
        competitionEventId: target.trackWorkoutId,
        scheme: revision.scheme,
        scoreType: revision.scoreType,
        scoreValue: revision.scoreValue,
        status: revision.status,
        statusOrder: revision.statusOrder,
        sortKey: revision.sortKey,
        tiebreakScheme: revision.tiebreakScheme,
        tiebreakValue: revision.tiebreakValue,
        timeCapMs: revision.timeCapMs,
        secondaryValue: revision.secondaryValue,
        scalingLevelId: target.divisionId,
        asRx: true,
        recordedAt,
      })
      .onDuplicateKeyUpdate({
        set: {
          teamId: target.ownerTeamId,
          workoutId: target.workoutId,
          scheme: revision.scheme,
          scoreType: revision.scoreType,
          scoreValue: revision.scoreValue,
          status: revision.status,
          statusOrder: revision.statusOrder,
          sortKey: revision.sortKey,
          tiebreakScheme: revision.tiebreakScheme,
          tiebreakValue: revision.tiebreakValue,
          timeCapMs: revision.timeCapMs,
          secondaryValue: revision.secondaryValue,
          updatedAt: recordedAt,
        },
      })

    const [current] = await tx
      .select({ id: scoresTable.id })
      .from(scoresTable)
      .where(exactKey)
      .limit(1)
    if (!current) {
      throw new CompetitionResultError(
        "persistence_failed",
        "Failed to retrieve result after upsert",
      )
    }

    // Replacement is total: an empty round set intentionally clears stale rows.
    await tx
      .delete(scoreRoundsTable)
      .where(eq(scoreRoundsTable.scoreId, current.id))
    if (revision.rounds.length > 0) {
      await tx.insert(scoreRoundsTable).values(
        revision.rounds.map((round) => ({
          scoreId: current.id,
          roundNumber: round.roundNumber,
          value: round.value,
          status: round.status,
          secondaryValue: round.secondaryValue,
        })),
      )
    }

    return { scoreId: current.id, isNew: !existing }
  })
}
