import { and, eq, isNull } from "drizzle-orm"
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
  encodeWorkoutResultRounds,
  normalizeWorkoutResultRounds,
  resolveWorkoutResultScoreType,
} from "./kernel"
import type { NormalizedCompetitionWorkoutResult } from "./normalize"
import { writeWorkoutResultRounds } from "./rounds"

export interface SubmittedVideoWorkoutResultInput {
  score?: string
  /** Retained for input compatibility; video submissions derive CAP server-side. */
  scoreStatus?: "scored" | "cap"
  secondaryScore?: string
  tiebreakScore?: string
  roundScores?: Array<{ score: string }>
  workout: {
    scheme: string
    scoreType: string | null
    timeCap: number | null
    tiebreakScheme: string | null
  }
}

export interface SubmittedVideoWorkoutResultTarget {
  userId: string
  teamId: string
  workoutId: string
  trackWorkoutId: string
  divisionId: string | null
}

export function normalizeSubmittedVideoWorkoutResult(
  input: SubmittedVideoWorkoutResultInput,
): NormalizedCompetitionWorkoutResult {
  const scheme = input.workout.scheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(
    scheme,
    input.workout.scoreType,
  )
  const hasRoundScores = !!input.roundScores?.length

  let scoreValue: number | null = null
  let encodedRounds: number[] = []

  if (hasRoundScores && input.roundScores) {
    for (const round of input.roundScores) {
      const parsed = parseScore(round.score, scheme)
      if (!parsed.isValid) {
        throw new Error(
          `Invalid round score: ${parsed.error || "Please check your entry"}`,
        )
      }
    }

    const result = encodeWorkoutResultRounds(
      input.roundScores,
      scheme,
      scoreType,
    )
    scoreValue = result.aggregated
    encodedRounds = result.rounds
  } else if (input.score) {
    const parsed = parseScore(input.score, scheme)
    if (!parsed.isValid) {
      throw new Error(
        `Invalid score format: ${parsed.error || "Please check your entry"}`,
      )
    }
    scoreValue = encodeScore(input.score, scheme)
  }

  let status: "scored" | "cap" = "scored"
  let secondaryValue: number | null = null
  const roundStatuses: Array<"scored" | "cap"> = []
  let cappedRoundCount = 0
  const timeCapMs = input.workout.timeCap ? input.workout.timeCap * 1000 : null

  if (scheme === "time-with-cap" && timeCapMs && scoreValue !== null) {
    if (hasRoundScores && encodedRounds.length > 0) {
      for (const roundValue of encodedRounds) {
        const isCapped = roundValue >= timeCapMs
        roundStatuses.push(isCapped ? "cap" : "scored")
        if (isCapped) cappedRoundCount++
      }
      if (cappedRoundCount > 0) status = "cap"
    } else if (scoreValue >= timeCapMs) {
      status = "cap"
      scoreValue = timeCapMs

      if (input.secondaryScore?.trim()) {
        const parsed = Number.parseInt(input.secondaryScore.trim(), 10)
        if (!Number.isNaN(parsed) && parsed >= 0) secondaryValue = parsed
      }
    }
  }

  let tiebreakValue: number | null = null
  if (input.tiebreakScore && input.workout.tiebreakScheme) {
    tiebreakValue = encodeScore(
      input.tiebreakScore,
      input.workout.tiebreakScheme as WorkoutScheme,
    )
    if (tiebreakValue === null) {
      throw new Error(
        `Invalid tiebreak score format: "${input.tiebreakScore}". Please check your entry.`,
      )
    }
  }

  const scoring = buildWorkoutResultScoring({
    value: scoreValue,
    status,
    scheme,
    scoreType,
    cappedRoundCount,
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
    rounds: hasRoundScores
      ? normalizeWorkoutResultRounds(input.roundScores ?? [], scheme, {
          roundsRepsInput: "score",
          statuses: roundStatuses,
        })
      : [],
  }
}

/**
 * Preserve the video adapter's legacy non-transactional score/round order.
 */
export async function persistSubmittedVideoWorkoutResult(input: {
  db: Database
  target: SubmittedVideoWorkoutResultTarget
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

  if (result.rounds.length === 0) return

  const [upsertedScore] = await db
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

  if (upsertedScore) {
    await writeWorkoutResultRounds(db, upsertedScore.id, result.rounds, {
      replaceExisting: true,
    })
  }
}
