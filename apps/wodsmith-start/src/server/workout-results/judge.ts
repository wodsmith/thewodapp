import { and, eq, isNull } from "drizzle-orm"
import type { Database } from "@/db"
import { scoresTable } from "@/db/schemas/scores"
import type { ScoreStatus } from "@/db/schemas/workouts"
import type { WorkoutResultRoundInput } from "./kernel"
import {
  type NormalizedCompetitionWorkoutResult,
  normalizeCompetitionWorkoutResult,
} from "./normalize"
import { writeWorkoutResultRounds } from "./rounds"

export interface JudgeWorkoutResultInput {
  score: string
  scoreStatus: ScoreStatus
  tieBreakScore?: string | null
  secondaryScore?: string | null
  roundScores?: WorkoutResultRoundInput[]
  workout: {
    scheme: string
    scoreType: string | null
    repsPerRound: number | null
    roundsToScore: number | null
    timeCap: number | null
    tiebreakScheme?: string | null
  }
}

export interface JudgeWorkoutResultTarget {
  userId: string
  teamId: string
  workoutId: string
  trackWorkoutId: string
  divisionId: string | null
}

export class InvalidJudgeRoundScoreError extends Error {}

export function normalizeJudgeWorkoutResult(
  input: JudgeWorkoutResultInput,
): NormalizedCompetitionWorkoutResult {
  return normalizeCompetitionWorkoutResult(input, {
    invalidRoundError: () =>
      new InvalidJudgeRoundScoreError("Every round must be a valid score"),
  })
}

export async function persistJudgeWorkoutResult(input: {
  db: Database
  target: JudgeWorkoutResultTarget
  result: NormalizedCompetitionWorkoutResult
}): Promise<string> {
  const { db, target, result } = input

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

    const [finalScore] = await tx
      .select({ id: scoresTable.id })
      .from(scoresTable)
      .where(
        and(
          eq(scoresTable.competitionEventId, target.trackWorkoutId),
          eq(scoresTable.userId, target.userId),
          target.divisionId
            ? eq(scoresTable.scalingLevelId, target.divisionId)
            : isNull(scoresTable.scalingLevelId),
        ),
      )
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
