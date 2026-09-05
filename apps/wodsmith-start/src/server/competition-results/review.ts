import type { TiebreakScheme } from "@/db/schemas/workouts"
import {
  computeSortKey,
  computeSortKeyWithDirection,
  encodeScore,
  type ScoreType,
  STATUS_ORDER,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"
import { resolveWorkoutResultScoreType } from "@/lib/scoring/result"
import {
  type CompetitionResultRevision,
  decideCompetitionResult,
  parseSecondaryScore,
} from "./decision"
import { CompetitionResultError } from "./domain"

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
  existingRounds: Array<{
    roundNumber: number
    status: string | null
    secondaryValue: number | null
  }>
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
    input.existingRounds.length > 0 &&
    roundScores.length !== input.existingRounds.length
  ) {
    throw new Error(
      `Expected exactly ${input.existingRounds.length} adjusted round scores`,
    )
  }

  // An adjudicated total is an override of an existing performance, not a
  // newly recorded single round. Preserve its facts and cap-count ordering.
  if (roundScores.length === 0 && input.existingRounds.length > 1) {
    const scoreValue = encodeScore(input.score ?? "", scheme)
    if (scoreValue === null)
      throw new CompetitionResultError(
        "invalid_score",
        "A valid adjusted total is required",
      )
    const single = decideCompetitionResult(
      {
        score: input.score,
        status: "scored",
        tiebreakScore: input.tiebreakScore,
      },
      {
        workoutId: "reviewed-score",
        scheme,
        scoreType,
        roundsToScore: null,
        timeCap: null,
        tiebreakScheme: input.workout.tiebreakScheme,
      },
    )
    const cappedRoundCount = input.existingRounds.filter(
      (round) => round.status === "cap",
    ).length
    const previousSecondaryValues = input.existingRounds.filter(
      (round) => round.status === "cap" && round.secondaryValue !== null,
    )
    const secondaryValue =
      input.secondaryScore !== undefined
        ? parseSecondaryScore(input.secondaryScore, "Secondary score")
        : previousSecondaryValues.length
          ? previousSecondaryValues.reduce(
              (sum, round) => sum + (round.secondaryValue ?? 0),
              0,
            )
          : null

    return {
      scoreValue,
      status: input.status,
      statusOrder: STATUS_ORDER[input.status],
      sortKey: sortKeyToString(
        computeSortKey({
          value: scoreValue,
          status: input.status,
          scheme,
          scoreType,
          cappedRoundCount,
          timeCap:
            secondaryValue !== null
              ? { ms: input.workout.timeCapMs ?? 0, secondaryValue }
              : undefined,
          tiebreak:
            single.tiebreakValue !== null && single.tiebreakScheme
              ? { scheme: single.tiebreakScheme, value: single.tiebreakValue }
              : undefined,
        }),
      ),
      secondaryValue,
      tiebreakValue: single.tiebreakValue,
      rounds: [],
      replaceRounds: false,
      isMultiRound: true,
      cappedRoundCount,
    }
  }

  const revision = decideCompetitionResult(
    {
      score: input.score,
      status: input.status,
      secondaryScore: input.secondaryScore,
      tiebreakScore: input.tiebreakScore,
      roundScores: roundScores.map((round) => ({
        score: round.score,
        status:
          round.status ??
          (input.existingRounds.find(
            (existing) => existing.roundNumber === round.roundNumber,
          )?.status === "cap"
            ? "cap"
            : "scored"),
        secondaryScore:
          round.secondaryScore !== undefined
            ? round.secondaryScore
            : round.status === "scored"
              ? null
              : input.existingRounds
                  .find(
                    (existing) => existing.roundNumber === round.roundNumber,
                  )
                  ?.secondaryValue?.toString(),
      })),
    },
    {
      workoutId: "reviewed-score",
      scheme,
      scoreType,
      roundsToScore:
        input.workout.roundsToScore ?? (input.existingRounds.length || null),
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
