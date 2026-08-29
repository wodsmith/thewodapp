import { and, eq, isNull } from "drizzle-orm"
import type { Database } from "@/db"
import { scoresTable } from "@/db/schemas/scores"
import type { ScoreStatus, TiebreakScheme } from "@/db/schemas/workouts"
import { encodeScore, sortKeyToString, type WorkoutScheme } from "@/lib/scoring"
import {
  buildWorkoutResultScoring,
  encodeWorkoutResultRounds,
  normalizeWorkoutResultRounds,
  resolveWorkoutResultScoreType,
  type WorkoutResultRoundInput,
} from "./kernel"
import type { NormalizedCompetitionWorkoutResult } from "./normalize"
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
  const scheme = input.workout.scheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(
    scheme,
    input.workout.scoreType,
  )
  const hasRoundScores = !!input.roundScores?.length

  let scoreValue: number | null = null
  let encodedRounds: number[] = []

  if (hasRoundScores && input.roundScores) {
    const result = encodeWorkoutResultRounds(
      input.roundScores,
      scheme,
      scoreType,
    )
    if (result.rounds.length !== input.roundScores.length) {
      throw new InvalidJudgeRoundScoreError("Every round must be a valid score")
    }
    scoreValue = result.aggregated
    encodedRounds = result.rounds
  } else if (input.score?.trim()) {
    scoreValue = encodeScore(input.score, scheme)
  }

  let status = mapJudgeStatus(input.scoreStatus)
  const roundStatuses: Array<"scored" | "cap"> = []
  let cappedRoundCount = 0

  if (
    scheme === "time-with-cap" &&
    input.workout.timeCap &&
    hasRoundScores &&
    scoreValue !== null
  ) {
    const capMs = input.workout.timeCap * 1000
    for (const roundValue of encodedRounds) {
      const isRoundCapped = roundValue >= capMs
      roundStatuses.push(isRoundCapped ? "cap" : "scored")
      if (isRoundCapped) cappedRoundCount++
    }
    if (status !== "dq" && status !== "withdrawn") {
      status = cappedRoundCount > 0 ? "cap" : "scored"
    }
  } else if (
    status === "cap" &&
    scheme === "time-with-cap" &&
    input.workout.timeCap
  ) {
    scoreValue = input.workout.timeCap * 1000
  }

  let secondaryValue: number | null = null
  if (input.secondaryScore && status === "cap") {
    const parsed = Number.parseInt(input.secondaryScore.trim(), 10)
    if (!Number.isNaN(parsed) && parsed >= 0) secondaryValue = parsed
  }

  let tiebreakValue: number | null = null
  if (input.tieBreakScore && input.workout.tiebreakScheme) {
    try {
      tiebreakValue = encodeScore(
        input.tieBreakScore,
        input.workout.tiebreakScheme as WorkoutScheme,
      )
    } catch {
      // Preserve the route's silent invalid-tiebreak behavior.
    }
  }

  const timeCapMs = input.workout.timeCap ? input.workout.timeCap * 1000 : null
  const scoring = buildWorkoutResultScoring({
    value: scoreValue,
    status,
    scheme,
    scoreType,
    cappedRoundCount,
    timeCap:
      status === "cap" && timeCapMs && secondaryValue !== null
        ? { ms: timeCapMs, secondaryValue }
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
          roundsRepsInput: "parts",
          statuses: roundStatuses,
        })
      : [],
  }
}

function mapJudgeStatus(
  status: ScoreStatus,
): "scored" | "cap" | "dq" | "withdrawn" {
  switch (status) {
    case "scored":
      return "scored"
    case "cap":
      return "cap"
    case "dq":
      return "dq"
    case "withdrawn":
    case "dns":
    case "dnf":
      return "withdrawn"
    default:
      return "scored"
  }
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
