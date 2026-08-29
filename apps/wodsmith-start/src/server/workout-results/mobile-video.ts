import type { Database } from "@/db"
import { scoresTable } from "@/db/schemas/scores"
import type { TiebreakScheme } from "@/db/schemas/workouts"
import {
  encodeScore,
  parseScore,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"
import {
  buildWorkoutResultScoring,
  resolveWorkoutResultScoreType,
} from "./kernel"
import type { NormalizedCompetitionWorkoutResult } from "./normalize"

export interface MobileVideoWorkoutResultInput {
  score: string
  scoreStatus?: "scored" | "cap"
  secondaryScore?: string
  tiebreakScore?: string
  workout: {
    scheme: string
    scoreType: string | null
    timeCap: number | null
    tiebreakScheme: string | null
  }
}

export interface MobileVideoWorkoutResultTarget {
  userId: string
  teamId: string
  workoutId: string
  trackWorkoutId: string
  divisionId: string | null
}

export class InvalidMobileVideoScoreError extends Error {}

export function normalizeMobileVideoWorkoutResult(
  input: MobileVideoWorkoutResultInput,
): NormalizedCompetitionWorkoutResult {
  const scheme = input.workout.scheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(
    scheme,
    input.workout.scoreType,
  )
  const parseResult = parseScore(input.score, scheme)
  if (!parseResult.isValid) {
    throw new InvalidMobileVideoScoreError(
      `Invalid score format: ${parseResult.error || "Please check your entry"}`,
    )
  }

  let scoreValue = encodeScore(input.score, scheme)
  let status: "scored" | "cap" = input.scoreStatus ?? "scored"
  let secondaryValue: number | null = null
  const timeCapMs = input.workout.timeCap ? input.workout.timeCap * 1000 : null

  if (scheme === "time-with-cap" && timeCapMs && scoreValue !== null) {
    if (scoreValue >= timeCapMs) {
      status = "cap"
      scoreValue = timeCapMs
      secondaryValue = parseSecondaryValue(input.secondaryScore)
    }
  } else if (status === "cap") {
    secondaryValue = parseSecondaryValue(input.secondaryScore)
  }

  let tiebreakValue: number | null = null
  if (input.tiebreakScore && input.workout.tiebreakScheme) {
    tiebreakValue = encodeScore(
      input.tiebreakScore,
      input.workout.tiebreakScheme as WorkoutScheme,
    )
  }

  const scoring = buildWorkoutResultScoring({
    value: scoreValue,
    status,
    scheme,
    scoreType,
    timeCap:
      status === "cap" && secondaryValue !== null
        ? { ms: timeCapMs ?? 0, secondaryValue }
        : undefined,
    tiebreak:
      tiebreakValue !== null && input.workout.tiebreakScheme
        ? {
            scheme: input.workout.tiebreakScheme as "time" | "reps",
            value: tiebreakValue,
          }
        : undefined,
  })

  return {
    scheme,
    scoreType,
    scoreValue,
    status,
    statusOrder: scoring.statusOrder,
    sortKey: scoring.sortKey ? sortKeyToString(scoring.sortKey) : null,
    tiebreakScheme:
      (input.workout.tiebreakScheme as TiebreakScheme | null) ?? null,
    tiebreakValue,
    timeCapMs,
    secondaryValue,
    rounds: [],
  }
}

function parseSecondaryValue(value?: string): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value.trim(), 10)
  return !Number.isNaN(parsed) && parsed >= 0 ? parsed : null
}

/** Preserve the mobile route's video-first, non-transactional write order. */
export async function persistMobileVideoWorkoutResult(input: {
  db: Database
  target: MobileVideoWorkoutResultTarget
  result: NormalizedCompetitionWorkoutResult
  recordedAt: Date
}): Promise<void> {
  const { db, target, result, recordedAt } = input

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
      recordedAt,
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
        updatedAt: recordedAt,
      },
    })
}
