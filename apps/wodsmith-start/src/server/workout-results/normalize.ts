import type {
  ScoreStatus,
  ScoreType,
  TiebreakScheme,
} from "@/db/schemas/workouts"
import {
  computeSortKey,
  encodeRounds,
  encodeScore,
  getDefaultScoreType,
  STATUS_ORDER,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"

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
): NormalizedCompetitionWorkoutResult {
  if (!input.workout) {
    throw new Error("Workout info is required to save competition score")
  }

  const scheme = input.workout.scheme as WorkoutScheme
  const scoreType =
    (input.workout.scoreType as ScoreType) || getDefaultScoreType(scheme)
  const tiebreakScheme =
    (input.workout.tiebreakScheme as TiebreakScheme) ?? null
  const hasRoundScores = !!(input.roundScores && input.roundScores.length > 0)

  let scoreValue: number | null = null
  let encodedRounds: number[] = []

  if (hasRoundScores && input.roundScores) {
    const roundInputs = input.roundScores.map((round) => ({ raw: round.score }))
    const result = encodeRounds(roundInputs, scheme, scoreType)

    if (result.rounds.length !== input.roundScores.length) {
      throw new Error("Every round in roundScores must be a valid score")
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

  const sortKey =
    scoreValue !== null
      ? computeSortKey({
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
      : null

  const rounds = hasRoundScores
    ? (input.roundScores ?? []).map((round, index) => {
        let value: number

        if (scheme === "rounds-reps") {
          const roundsNumber =
            Number.parseInt(round.parts?.[0] ?? round.score, 10) || 0
          const reps = Number.parseInt(round.parts?.[1] ?? "0", 10) || 0
          value = roundsNumber * 100000 + reps
        } else {
          value = encodeScore(round.score, scheme) ?? 0
        }

        return {
          roundNumber: index + 1,
          value,
          status: roundStatuses[index] ?? null,
        }
      })
    : []

  return {
    scheme,
    scoreType,
    scoreValue,
    status,
    statusOrder: STATUS_ORDER[status],
    sortKey: sortKey ? sortKeyToString(sortKey) : null,
    tiebreakScheme,
    tiebreakValue,
    timeCapMs,
    secondaryValue,
    rounds,
  }
}
