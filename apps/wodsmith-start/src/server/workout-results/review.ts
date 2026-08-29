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
  encodeWorkoutResultRounds,
  resolveWorkoutResultScoreType,
} from "./kernel"
import { writeWorkoutResultRounds } from "./rounds"

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

type ReviewedScoreContext = Partial<
  Pick<
    typeof scoresTable.$inferInsert,
    | "verificationStatus"
    | "verifiedAt"
    | "verifiedByUserId"
    | "penaltyType"
    | "penaltyPercentage"
    | "noRepCount"
    | "updatedAt"
  >
>

interface NumberedRoundInput {
  roundNumber: number
  score: string
}

interface ReviewWorkoutResultDefinition {
  scheme: string
  scoreType: string | null
  timeCapMs: number | null
  tiebreakScheme: string | null
}

export interface NormalizedReviewedSubmissionWorkoutResult {
  scoreValue: number | null
  status: "scored" | "cap"
  statusOrder: number
  sortKey: string | null
  secondaryValue: number | null
  tiebreakValue: number | null
  rounds: Array<{
    roundNumber: number
    value: number
    status: "scored" | "cap" | null
  }>
  replaceRounds: boolean
  isMultiRound: boolean
  cappedRoundCount: number
}

export interface SubmissionScoreAdjustmentInput {
  score?: string
  status: "scored" | "cap"
  secondaryScore?: string
  tiebreakScore?: string
  roundScores?: NumberedRoundInput[]
  workout: ReviewWorkoutResultDefinition
  existingRoundStatuses: Array<string | null>
}

export function normalizeSubmissionScoreAdjustment(
  input: SubmissionScoreAdjustmentInput,
): NormalizedReviewedSubmissionWorkoutResult {
  const scheme = input.workout.scheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(
    scheme,
    input.workout.scoreType,
  )
  const roundScores = input.roundScores?.length
    ? [...input.roundScores].sort((a, b) => a.roundNumber - b.roundNumber)
    : []
  const seen = new Set<number>()
  for (const round of roundScores) {
    if (seen.has(round.roundNumber)) {
      throw new Error(
        "adjustedRoundScores must contain unique roundNumber values",
      )
    }
    seen.add(round.roundNumber)
  }

  const hasRoundScores = roundScores.length > 0
  const isMultiRound = hasRoundScores || input.existingRoundStatuses.length > 1
  let status = input.status
  let scoreValue: number | null = null
  let encodedRounds: number[] = []
  const roundStatuses: Array<"scored" | "cap"> = []
  let cappedRoundCount = 0

  if (hasRoundScores) {
    const encoded = encodeWorkoutResultRounds(roundScores, scheme, scoreType)
    if (encoded.rounds.length !== roundScores.length) {
      throw new Error(
        "Every round in adjustedRoundScores must be a valid score",
      )
    }
    scoreValue = encoded.aggregated
    encodedRounds = encoded.rounds

    if (scheme === "time-with-cap" && input.workout.timeCapMs) {
      for (const roundValue of encodedRounds) {
        const isCapped = roundValue >= input.workout.timeCapMs
        roundStatuses.push(isCapped ? "cap" : "scored")
        if (isCapped) cappedRoundCount++
      }
      status = cappedRoundCount > 0 ? "cap" : "scored"
    }
  } else if (input.score) {
    // A direct override of a multi-round score intentionally leaves its old
    // round rows in place and does not clamp an explicit CAP to timeCapMs.
    scoreValue =
      !isMultiRound && status === "cap" && input.workout.timeCapMs
        ? input.workout.timeCapMs
        : encodeScore(input.score, scheme)
    cappedRoundCount = input.existingRoundStatuses.filter(
      (roundStatus) => roundStatus === "cap",
    ).length
  }

  let secondaryValue: number | null = null
  if (!hasRoundScores && input.secondaryScore && status === "cap") {
    const parsed = Number.parseInt(input.secondaryScore.trim(), 10)
    if (!Number.isNaN(parsed) && parsed >= 0) secondaryValue = parsed
  }

  let tiebreakValue: number | null = null
  if (input.tiebreakScore && input.workout.tiebreakScheme) {
    try {
      tiebreakValue = encodeScore(
        input.tiebreakScore,
        input.workout.tiebreakScheme as WorkoutScheme,
      )
    } catch {
      // Verification historically ignores tiebreak encoding errors.
    }
  }

  const scoring = buildWorkoutResultScoring({
    value: scoreValue,
    status,
    scheme,
    scoreType,
    cappedRoundCount: isMultiRound ? cappedRoundCount : undefined,
    timeCap:
      status === "cap" && input.workout.timeCapMs && secondaryValue !== null
        ? { ms: input.workout.timeCapMs, secondaryValue }
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
    scoreValue,
    status,
    statusOrder: scoring.statusOrder,
    sortKey: scoring.sortKey ? sortKeyToString(scoring.sortKey) : null,
    secondaryValue,
    tiebreakValue,
    rounds: roundScores.map((round, index) => ({
      roundNumber: round.roundNumber,
      value: encodedRounds[index] ?? 0,
      status: roundStatuses[index] ?? null,
    })),
    replaceRounds: hasRoundScores,
    isMultiRound,
    cappedRoundCount,
  }
}

export function normalizeInvalidatedSubmissionWorkoutResult(): NormalizedReviewedSubmissionWorkoutResult {
  return {
    scoreValue: 0,
    status: "scored",
    statusOrder: 0,
    sortKey: null,
    secondaryValue: null,
    tiebreakValue: null,
    rounds: [],
    replaceRounds: false,
    isMultiRound: false,
    cappedRoundCount: 0,
  }
}

// @lat: [[domain#Domain Model#Scoring#Workout-result module]]
export async function updateReviewedSubmissionWorkoutResult(input: {
  db: DatabaseTransaction
  scoreId: string
  result: NormalizedReviewedSubmissionWorkoutResult
  context: ReviewedScoreContext
}): Promise<void> {
  const { db, scoreId, result, context } = input

  await db
    .update(scoresTable)
    .set({
      scoreValue: result.scoreValue,
      status: result.status,
      statusOrder: result.statusOrder,
      sortKey: result.sortKey,
      secondaryValue: result.secondaryValue,
      tiebreakValue: result.tiebreakValue,
      ...context,
    })
    .where(eq(scoresTable.id, scoreId))

  if (result.replaceRounds) {
    await writeWorkoutResultRounds(db, scoreId, result.rounds, {
      replaceExisting: true,
    })
  }
}

export interface ManualSubmissionWorkoutResultInput {
  score?: string
  status?: "scored" | "cap"
  secondaryScore?: string
  tiebreakScore?: string
  roundScores?: NumberedRoundInput[]
  workout: ReviewWorkoutResultDefinition & { roundsToScore: number | null }
}

export function normalizeManualSubmissionWorkoutResult(
  input: ManualSubmissionWorkoutResultInput,
): NormalizedReviewedSubmissionWorkoutResult & {
  scheme: WorkoutScheme
  scoreType: ScoreType
  tiebreakScheme: TiebreakScheme | null
  timeCapMs: number | null
} {
  const scheme = input.workout.scheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(
    scheme,
    input.workout.scoreType,
  )
  const roundScores = input.roundScores?.length
    ? [...input.roundScores].sort((a, b) => a.roundNumber - b.roundNumber)
    : []
  const hasRoundScores = roundScores.length > 0

  if (hasRoundScores) {
    const expectedRoundCount = input.workout.roundsToScore ?? 1
    if (expectedRoundCount <= 1) {
      throw new Error("roundScores is only valid for multi-round workouts")
    }
    const seen = new Set<number>()
    for (const round of roundScores) {
      if (seen.has(round.roundNumber)) {
        throw new Error("roundScores must contain unique roundNumber values")
      }
      seen.add(round.roundNumber)
    }
    if (
      roundScores.length !== expectedRoundCount ||
      roundScores.some((round, index) => round.roundNumber !== index + 1)
    ) {
      throw new Error(
        `Expected exactly ${expectedRoundCount} contiguous round scores (1..${expectedRoundCount})`,
      )
    }
  }

  const timeCapMs = input.workout.timeCapMs
  let status: "scored" | "cap" = input.status ?? "scored"
  let scoreValue: number | null = null
  let encodedRounds: number[] = []
  const roundStatuses: Array<"scored" | "cap"> = []
  let cappedRoundCount = 0
  let secondaryValue: number | null = null

  if (hasRoundScores) {
    const encoded = encodeWorkoutResultRounds(roundScores, scheme, scoreType)
    if (encoded.rounds.length !== roundScores.length) {
      throw new Error("Every round in roundScores must be a valid score")
    }
    scoreValue = encoded.aggregated
    encodedRounds = encoded.rounds

    if (scheme === "time-with-cap" && timeCapMs) {
      for (const roundValue of encodedRounds) {
        const isCapped = roundValue >= timeCapMs
        roundStatuses.push(isCapped ? "cap" : "scored")
        if (isCapped) cappedRoundCount++
      }
      status = cappedRoundCount > 0 ? "cap" : "scored"
    }
  } else if (input.score) {
    if (scheme === "time-with-cap" && status === "cap" && timeCapMs) {
      scoreValue = timeCapMs
      if (input.secondaryScore) {
        const parsed = Number.parseInt(input.secondaryScore.trim(), 10)
        if (!Number.isNaN(parsed) && parsed >= 0) secondaryValue = parsed
      }
    } else {
      scoreValue = encodeScore(input.score, scheme)
      if (
        scheme === "time-with-cap" &&
        timeCapMs &&
        scoreValue !== null &&
        scoreValue >= timeCapMs
      ) {
        status = "cap"
        scoreValue = timeCapMs
        if (input.secondaryScore) {
          const parsed = Number.parseInt(input.secondaryScore.trim(), 10)
          if (!Number.isNaN(parsed) && parsed >= 0) secondaryValue = parsed
        }
      }
    }
  }

  let tiebreakValue: number | null = null
  if (input.tiebreakScore && input.workout.tiebreakScheme) {
    try {
      tiebreakValue = encodeScore(
        input.tiebreakScore,
        input.workout.tiebreakScheme as WorkoutScheme,
      )
    } catch {
      // Manual entry historically ignores tiebreak encoding errors.
    }
  }

  const isMultiRound = encodedRounds.length > 1
  const scoring = buildWorkoutResultScoring({
    value: scoreValue,
    status,
    scheme,
    scoreType,
    cappedRoundCount: isMultiRound ? cappedRoundCount : undefined,
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
    rounds: roundScores.map((round, index) => ({
      roundNumber: round.roundNumber,
      value: encodedRounds[index] ?? 0,
      status: roundStatuses[index] ?? null,
    })),
    replaceRounds: false,
    isMultiRound,
    cappedRoundCount,
  }
}

export interface ManualSubmissionWorkoutResultTarget {
  userId: string
  teamId: string
  workoutId: string
  trackWorkoutId: string
  divisionId: string | null
}

export async function insertManualSubmissionWorkoutResult(input: {
  db: DatabaseTransaction
  target: ManualSubmissionWorkoutResultTarget
  result: ReturnType<typeof normalizeManualSubmissionWorkoutResult>
  recordedAt: Date
  context: ReviewedScoreContext
}): Promise<string> {
  const { db, target, result, recordedAt, context } = input

  await db.insert(scoresTable).values({
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
    ...context,
  })

  const conditions = [
    eq(scoresTable.competitionEventId, target.trackWorkoutId),
    eq(scoresTable.userId, target.userId),
    target.divisionId
      ? eq(scoresTable.scalingLevelId, target.divisionId)
      : isNull(scoresTable.scalingLevelId),
  ]
  const [inserted] = await db
    .select({ id: scoresTable.id })
    .from(scoresTable)
    .where(and(...conditions))
    .limit(1)

  if (!inserted) throw new Error("Failed to fetch inserted score")

  if (result.rounds.length > 0) {
    await writeWorkoutResultRounds(db, inserted.id, result.rounds, {
      replaceExisting: false,
    })
  }

  return inserted.id
}
