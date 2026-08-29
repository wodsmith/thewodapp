import {
  computeSortKey,
  encodeRounds,
  encodeScore,
  getDefaultScoreType,
  type ScoreStatus,
  type ScoreType,
  STATUS_ORDER,
  type TiebreakScheme,
  type WorkoutScheme,
} from "@/lib/scoring"

export interface WorkoutResultRoundInput {
  score: string
  parts?: [string, string]
}

export interface NormalizedWorkoutResultRound {
  roundNumber: number
  value: number
  status: "scored" | "cap" | null
}

interface BuildWorkoutResultScoringInput {
  value: number | null
  status: ScoreStatus
  scheme: WorkoutScheme
  scoreType: ScoreType
  cappedRoundCount?: number
  timeCap?: {
    ms: number
    secondaryValue: number
  }
  tiebreak?: {
    scheme: TiebreakScheme
    value: number
  }
}

export function resolveWorkoutResultScoreType(
  scheme: WorkoutScheme,
  scoreType?: string | null,
): ScoreType {
  return (scoreType as ScoreType) || getDefaultScoreType(scheme)
}

export function encodeWorkoutResultRounds(
  rounds: WorkoutResultRoundInput[],
  scheme: WorkoutScheme,
  scoreType: ScoreType,
) {
  return encodeRounds(
    rounds.map((round) => ({ raw: round.score })),
    scheme,
    scoreType,
  )
}

export function buildWorkoutResultScoring({
  value,
  status,
  scheme,
  scoreType,
  cappedRoundCount,
  timeCap,
  tiebreak,
}: BuildWorkoutResultScoringInput): {
  statusOrder: number
  sortKey: bigint | null
} {
  return {
    statusOrder: STATUS_ORDER[status],
    sortKey:
      value === null
        ? null
        : computeSortKey({
            value,
            status,
            scheme,
            scoreType,
            cappedRoundCount,
            timeCap,
            tiebreak,
          }),
  }
}

export function normalizeWorkoutResultRounds(
  rounds: WorkoutResultRoundInput[],
  scheme: WorkoutScheme,
  options: {
    roundsRepsInput: "parts" | "score"
    statuses?: Array<"scored" | "cap">
  },
): NormalizedWorkoutResultRound[] {
  return rounds.map((round, index) => {
    let value: number

    if (scheme === "rounds-reps") {
      const parts =
        options.roundsRepsInput === "score"
          ? round.score.match(/^(\d+)[+.](\d+)$/)?.slice(1)
          : round.parts
      const roundsNumber = Number.parseInt(parts?.[0] ?? round.score, 10) || 0
      const reps = Number.parseInt(parts?.[1] ?? "0", 10) || 0
      value = roundsNumber * 100000 + reps
    } else {
      value = encodeScore(round.score, scheme) ?? 0
    }

    return {
      roundNumber: index + 1,
      value,
      status: options.statuses?.[index] ?? null,
    }
  })
}
