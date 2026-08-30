import { and, eq, isNull } from "drizzle-orm"
import type { Database } from "@/db"
import { scoresTable } from "@/db/schemas/scores"
import type { TiebreakScheme } from "@/db/schemas/workouts"
import {
  encodeScore,
  type ScoreType,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"
import {
  buildWorkoutResultScoring,
  resolveWorkoutResultScoreType,
} from "./kernel"

export interface AthleteSelfEntryWorkoutResultInput {
  score: string
  status: "scored" | "cap"
  secondaryScore?: string
  tiebreakScore?: string
  workout: {
    scheme: string
    scoreType: string | null
    timeCap: number | null
    tiebreakScheme: string | null
  }
}

export interface NormalizedAthleteSelfEntryWorkoutResult {
  scheme: WorkoutScheme
  scoreType: ScoreType
  scoreValue: number | null
  status: "scored" | "cap"
  statusOrder: number
  sortKey: string | null
  tiebreakScheme: TiebreakScheme | null
  tiebreakValue: number | null
  timeCapMs: number | null
  secondaryValue: number | null
}

export interface AthleteSelfEntryWorkoutResultTarget {
  userId: string
  teamId: string
  workoutId: string
  trackWorkoutId: string
  divisionId: string | null
}

export function normalizeAthleteSelfEntryWorkoutResult(
  input: AthleteSelfEntryWorkoutResultInput,
): NormalizedAthleteSelfEntryWorkoutResult {
  const scheme = input.workout.scheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(
    scheme,
    input.workout.scoreType,
  )
  const timeCapMs = input.workout.timeCap ? input.workout.timeCap * 1000 : null
  let scoreValue = encodeScore(input.score, scheme)

  // Self-entry historically trusts the explicit status even below the cap.
  if (input.status === "cap" && scheme === "time-with-cap" && timeCapMs) {
    scoreValue = timeCapMs
  }

  let secondaryValue: number | null = null
  if (input.secondaryScore && input.status === "cap") {
    const parsed = Number.parseInt(input.secondaryScore.trim(), 10)
    if (!Number.isNaN(parsed) && parsed >= 0) secondaryValue = parsed
  }

  // encodeScore returns null for invalid input; self-entry deliberately stores it.
  const tiebreakValue =
    input.tiebreakScore && input.workout.tiebreakScheme
      ? encodeScore(
          input.tiebreakScore,
          input.workout.tiebreakScheme as WorkoutScheme,
        )
      : null
  const scoring = buildWorkoutResultScoring({
    value: scoreValue,
    status: input.status,
    scheme,
    scoreType,
    timeCap:
      input.status === "cap" && timeCapMs !== null && secondaryValue !== null
        ? { ms: timeCapMs, secondaryValue }
        : undefined,
    tiebreak:
      tiebreakValue !== null && input.workout.tiebreakScheme
        ? {
            scheme: input.workout.tiebreakScheme as TiebreakScheme,
            value: tiebreakValue,
          }
        : undefined,
  })

  return {
    scheme,
    scoreType,
    scoreValue,
    status: input.status,
    statusOrder: scoring.statusOrder,
    sortKey: scoring.sortKey ? sortKeyToString(scoring.sortKey) : null,
    tiebreakScheme:
      (input.workout.tiebreakScheme as TiebreakScheme | null) ?? null,
    tiebreakValue,
    timeCapMs,
    secondaryValue,
  }
}

/**
 * Preserve self-entry's score-upsert then exact-division re-read order.
 */
// @lat: [[domain#Domain Model#Scoring#Workout-result module]]
export async function persistAthleteSelfEntryWorkoutResult(input: {
  db: Database
  target: AthleteSelfEntryWorkoutResultTarget
  result: NormalizedAthleteSelfEntryWorkoutResult
}): Promise<string | null> {
  const { db, target, result } = input

  await db
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

  const conditions = [
    eq(scoresTable.competitionEventId, target.trackWorkoutId),
    eq(scoresTable.userId, target.userId),
    target.divisionId
      ? eq(scoresTable.scalingLevelId, target.divisionId)
      : isNull(scoresTable.scalingLevelId),
  ]
  const [score] = await db
    .select({ id: scoresTable.id })
    .from(scoresTable)
    .where(and(...conditions))
    .limit(1)

  return score?.id ?? null
}
