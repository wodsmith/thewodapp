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

function getWorkoutResultRoundScore(
  round: WorkoutResultRoundInput,
  scheme: WorkoutScheme,
  roundsRepsInput: "parts" | "score",
): string {
  if (scheme === "rounds-reps" && roundsRepsInput === "parts" && round.parts) {
    return `${round.parts[0]}+${round.parts[1]}`
  }

  return round.score
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
  options: {
    roundsRepsInput?: "parts" | "score"
  } = {},
) {
  return encodeRounds(
    rounds.map((round) => ({
      raw: getWorkoutResultRoundScore(
        round,
        scheme,
        options.roundsRepsInput ?? "score",
      ),
    })),
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
    const value =
      encodeScore(
        getWorkoutResultRoundScore(round, scheme, options.roundsRepsInput),
        scheme,
      ) ?? 0

    return {
      roundNumber: index + 1,
      value,
      status: options.statuses?.[index] ?? null,
    }
  })
}
