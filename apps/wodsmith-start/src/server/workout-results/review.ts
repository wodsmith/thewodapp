import { and, eq, isNull } from "drizzle-orm"
import type { Database } from "@/db"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import type { TiebreakScheme } from "@/db/schemas/workouts"
import {
  computeSortKeyWithDirection,
  type ScoreType,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"
import {
  type CompetitionResultRevision,
  decideCompetitionResult,
} from "../competition-results/decision"
import { CompetitionResultError } from "../competition-results/domain"
import { resolveWorkoutResultScoreType } from "./kernel"

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
  status?: "scored" | "cap"
  secondaryScore?: string | null
}

interface ReviewWorkoutResultDefinition {
  scheme: string
  scoreType: string | null
  timeCapMs: number | null
  tiebreakScheme: string | null
  roundsToScore?: number | null
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
    status: "scored" | "cap"
    secondaryValue: number | null
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

  if (roundScores.some((round, index) => round.roundNumber !== index + 1)) {
    throw new Error(
      "adjustedRoundScores must contain contiguous roundNumber values starting at 1",
    )
  }

  if (
    roundScores.length > 0 &&
    input.existingRoundStatuses.length > 0 &&
    roundScores.length !== input.existingRoundStatuses.length
  ) {
    throw new Error(
      `Expected exactly ${input.existingRoundStatuses.length} adjusted round scores`,
    )
  }

  const revision = decideCompetitionResult(
    {
      score: input.score,
      status: input.status,
      secondaryScore: input.secondaryScore,
      tiebreakScore: input.tiebreakScore,
      roundScores: roundScores.map((round, index) => ({
        score: round.score,
        status:
          round.status ??
          (input.existingRoundStatuses[index] === "cap" ? "cap" : "scored"),
        secondaryScore: round.secondaryScore,
      })),
    },
    {
      workoutId: "reviewed-score",
      scheme,
      scoreType,
      roundsToScore:
        input.workout.roundsToScore ??
        (input.existingRoundStatuses.length || null),
      timeCap: input.workout.timeCapMs ? input.workout.timeCapMs / 1000 : null,
      tiebreakScheme: input.workout.tiebreakScheme,
    },
  )
  const cappedRoundCount = revision.rounds.filter(
    (round) => round.status === "cap",
  ).length
  const isMultiRound = revision.rounds.length > 1

  return {
    scoreValue: revision.scoreValue,
    status: revision.status as "scored" | "cap",
    statusOrder: revision.statusOrder,
    sortKey: revision.sortKey,
    secondaryValue: revision.secondaryValue,
    tiebreakValue: revision.tiebreakValue,
    rounds: revision.rounds,
    replaceRounds: true,
    isMultiRound,
    cappedRoundCount,
  }
}

export function normalizeInvalidatedSubmissionWorkoutResult(): NormalizedReviewedSubmissionWorkoutResult {
  const worstPlaceSortKey = computeSortKeyWithDirection(null, "scored", "asc")

  return {
    scoreValue: 0,
    status: "scored",
    statusOrder: 0,
    sortKey: sortKeyToString(worstPlaceSortKey),
    secondaryValue: null,
    tiebreakValue: null,
    rounds: [],
    replaceRounds: true,
    isMultiRound: false,
    cappedRoundCount: 0,
  }
}

// @lat: [[domain#Domain Model#Scoring#Competition-result commands]]
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
    await db
      .delete(scoreRoundsTable)
      .where(eq(scoreRoundsTable.scoreId, scoreId))
    if (result.rounds.length > 0) {
      await db.insert(scoreRoundsTable).values(
        result.rounds.map((round) => ({
          scoreId,
          roundNumber: round.roundNumber,
          value: round.value,
          status: round.status,
          secondaryValue: round.secondaryValue,
        })),
      )
    }
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

  let revision: CompetitionResultRevision
  try {
    revision = decideCompetitionResult(
      {
        score: input.score,
        status: input.status ?? "scored",
        secondaryScore: input.secondaryScore,
        tiebreakScore: input.tiebreakScore,
        roundScores: roundScores.map((round) => ({
          score: round.score,
          status: round.status,
          secondaryScore: round.secondaryScore,
        })),
      },
      {
        workoutId: "manual-review",
        scheme,
        scoreType,
        roundsToScore: input.workout.roundsToScore,
        timeCap: input.workout.timeCapMs
          ? input.workout.timeCapMs / 1000
          : null,
        tiebreakScheme: input.workout.tiebreakScheme,
      },
    )
  } catch (error) {
    if (
      error instanceof CompetitionResultError &&
      error.code === "invalid_score"
    ) {
      throw new Error("score must be a valid score")
    }
    throw error
  }
  const cappedRoundCount = revision.rounds.filter(
    (round) => round.status === "cap",
  ).length
  const isMultiRound = revision.rounds.length > 1

  return {
    scheme,
    scoreType,
    scoreValue: revision.scoreValue,
    status: revision.status as "scored" | "cap",
    statusOrder: revision.statusOrder,
    sortKey: revision.sortKey,
    tiebreakScheme: revision.tiebreakScheme,
    tiebreakValue: revision.tiebreakValue,
    timeCapMs: revision.timeCapMs,
    secondaryValue: revision.secondaryValue,
    rounds: revision.rounds,
    replaceRounds: true,
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
    await db.insert(scoreRoundsTable).values(
      result.rounds.map((round) => ({
        scoreId: inserted.id,
        roundNumber: round.roundNumber,
        value: round.value,
        status: round.status,
        secondaryValue: round.secondaryValue,
      })),
    )
  }

  return inserted.id
}
