import type {
  ScoreStatus,
  ScoreType,
  TiebreakScheme,
} from "@/db/schemas/workouts"
import { encodeScore, sortKeyToString, type WorkoutScheme } from "@/lib/scoring"
import {
  buildWorkoutResultScoring,
  encodeWorkoutResultRounds,
  normalizeWorkoutResultRounds,
  resolveWorkoutResultScoreType,
} from "./kernel"

export interface CompetitionWorkoutResultRoundInput {
  score: string
  parts?: [string, string]
}

export interface CompetitionWorkoutResultWorkout {
  scheme: string
  scoreType: string | null
  repsPerRound: number | null
  roundsToScore: number | null
  timeCap: number | null
  tiebreakScheme?: string | null
}

export interface CompetitionWorkoutResultInput {
  score: string
  scoreStatus: ScoreStatus
  tieBreakScore?: string | null
  secondaryScore?: string | null
  roundScores?: CompetitionWorkoutResultRoundInput[]
  workout?: CompetitionWorkoutResultWorkout
}

interface NormalizeCompetitionWorkoutResultOptions {
  invalidRoundError?: (message: string) => Error
}

type PersistedScoreStatus = "scored" | "cap" | "dq" | "withdrawn"

export interface NormalizedCompetitionWorkoutResult {
  scheme: WorkoutScheme
  scoreType: ScoreType
  scoreValue: number | null
  status: PersistedScoreStatus
  statusOrder: number
  sortKey: string | null
  tiebreakScheme: TiebreakScheme | null
  tiebreakValue: number | null
  timeCapMs: number | null
  secondaryValue: number | null
  rounds: Array<{
    roundNumber: number
    value: number
    status: "scored" | "cap" | null
  }>
}

function mapToPersistedStatus(status: ScoreStatus): PersistedScoreStatus {
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

export function normalizeCompetitionWorkoutResult(
  input: CompetitionWorkoutResultInput,
  options: NormalizeCompetitionWorkoutResultOptions = {},
): NormalizedCompetitionWorkoutResult {
  if (!input.workout) {
    throw new Error("Workout info is required to save competition score")
  }

  const scheme = input.workout.scheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(
    scheme,
    input.workout.scoreType,
  )
  const tiebreakScheme =
    (input.workout.tiebreakScheme as TiebreakScheme) ?? null
  const hasRoundScores = !!(input.roundScores && input.roundScores.length > 0)

  let scoreValue: number | null = null
  let encodedRounds: number[] = []

  if (hasRoundScores && input.roundScores) {
    const result = encodeWorkoutResultRounds(
      input.roundScores,
      scheme,
      scoreType,
      { roundsRepsInput: "parts" },
    )

    if (result.rounds.length !== input.roundScores.length) {
      const message = "Every round in roundScores must be a valid score"
      throw options.invalidRoundError?.(message) ?? new Error(message)
    }

    scoreValue = result.aggregated
    encodedRounds = result.rounds
  } else if (input.score?.trim()) {
    scoreValue = encodeScore(input.score, scheme)
  }

  let status = mapToPersistedStatus(input.scoreStatus)
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
    if (!Number.isNaN(parsed) && parsed >= 0) {
      secondaryValue = parsed
    }
  }

  const timeCapMs = input.workout.timeCap ? input.workout.timeCap * 1000 : null

  let tiebreakValue: number | null = null
  if (input.tieBreakScore && input.workout.tiebreakScheme) {
    try {
      tiebreakValue = encodeScore(
        input.tieBreakScore,
        input.workout.tiebreakScheme as WorkoutScheme,
      )
    } catch (_error) {
      // Preserve legacy behavior: invalid tiebreaks are silently discarded.
    }
  }

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

  const rounds = hasRoundScores
    ? normalizeWorkoutResultRounds(input.roundScores ?? [], scheme, {
        roundsRepsInput: "parts",
        statuses: roundStatuses,
      })
    : []

  return {
    scheme,
    scoreType,
    scoreValue,
    status,
    statusOrder: scoring.statusOrder,
    sortKey: scoring.sortKey ? sortKeyToString(scoring.sortKey) : null,
    tiebreakScheme,
    tiebreakValue,
    timeCapMs,
    secondaryValue,
    rounds,
  }
}
