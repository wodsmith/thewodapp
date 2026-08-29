import { and, eq, isNull } from "drizzle-orm"
import type { Database } from "@/db"
import { scoresTable } from "@/db/schemas/scores"
import type { NormalizedCompetitionWorkoutResult } from "./normalize"
import { writeWorkoutResultRounds } from "./rounds"

export interface CompetitionWorkoutResultTarget {
  userId: string
  teamId: string
  workoutId: string
  trackWorkoutId: string
  divisionId: string | null
}

export interface ReplaceCompetitionWorkoutResultInput {
  db: Database
  target: CompetitionWorkoutResultTarget
  result: NormalizedCompetitionWorkoutResult
}

// @lat: [[domain#Domain Model#Scoring#Workout-result module]]
export async function replaceCompetitionWorkoutResult({
  db,
  target,
  result,
}: ReplaceCompetitionWorkoutResultInput): Promise<string> {
  return db.transaction(async (tx) => {
    await tx
      .insert(scoresTable)
      .values({
        userId: target.userId,
        teamId: target.teamId,
        workoutId: target.workoutId,
        competitionEventId: target.trackWorkoutId,
        scheme: result.scheme,
        scoreType: result.scoreType,
        scoreValue: result.scoreValue,
        status: result.status,
        statusOrder: result.statusOrder,
        sortKey: result.sortKey,
        tiebreakScheme: result.tiebreakScheme,
        tiebreakValue: result.tiebreakValue,
        timeCapMs: result.timeCapMs,
        secondaryValue: result.secondaryValue,
        scalingLevelId: target.divisionId,
        asRx: true,
        recordedAt: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          scoreValue: result.scoreValue,
          status: result.status,
          statusOrder: result.statusOrder,
          sortKey: result.sortKey,
          tiebreakScheme: result.tiebreakScheme,
          tiebreakValue: result.tiebreakValue,
          timeCapMs: result.timeCapMs,
          secondaryValue: result.secondaryValue,
          scalingLevelId: target.divisionId,
          updatedAt: new Date(),
        },
      })

    const finalScoreConditions = [
      eq(scoresTable.competitionEventId, target.trackWorkoutId),
      eq(scoresTable.userId, target.userId),
      target.divisionId
        ? eq(scoresTable.scalingLevelId, target.divisionId)
        : isNull(scoresTable.scalingLevelId),
    ]
    const [finalScore] = await tx
      .select({ id: scoresTable.id })
      .from(scoresTable)
      .where(and(...finalScoreConditions))
      .limit(1)

    if (!finalScore) {
      throw new Error("Failed to retrieve score after upsert")
    }

    if (result.rounds.length > 0) {
      await writeWorkoutResultRounds(tx, finalScore.id, result.rounds, {
        replaceExisting: true,
      })
    }

    return finalScore.id
  })
}
