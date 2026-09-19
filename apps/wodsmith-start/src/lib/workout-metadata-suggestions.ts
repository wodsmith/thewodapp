import { DEFAULT_SCORE_TYPES } from "@/lib/scoring/constants"
import type { ScoreType, WorkoutScheme } from "@/lib/scoring/types"

export const WORKOUT_METADATA_MODEL = "jev-latest"
export const WORKOUT_METADATA_MIN_DESCRIPTION_LENGTH = 12
export const WORKOUT_METADATA_WRITE_PERMISSIONS = [
  "create_components",
  "edit_components",
  "manage_competitions",
  "manage_programming",
] as const

export type WorkoutMetadataWritePermission =
  (typeof WORKOUT_METADATA_WRITE_PERMISSIONS)[number]

export type MovementCandidate = {
  id: string
  name: string
  type: string
}

export type WorkoutMetadataJudgments = {
  scheme: { choice: WorkoutScheme; confidence: number }
  scoreType: { choice: ScoreType; confidence: number }
  movementProbabilities: Record<string, number>
}

export type WorkoutMetadataSuggestion = {
  scheme?: WorkoutScheme
  schemeConfidence?: number
  scoreType?: ScoreType
  scoreTypeConfidence?: number
  movements: Array<MovementCandidate & { probability: number }>
}

const MIN_CHOICE_CONFIDENCE = 0.35
const MIN_MOVEMENT_PROBABILITY = 0.7

/** Convert model judgments into the harmless proposal shown by workout forms. */
// @lat: [[domain#Domain Model#Workouts#AI Metadata Suggestions]]
export function selectWorkoutMetadataSuggestion(
  judgments: WorkoutMetadataJudgments,
  movements: MovementCandidate[],
): WorkoutMetadataSuggestion {
  const suggestion: WorkoutMetadataSuggestion = {
    movements: movements
      .map((movement) => ({
        ...movement,
        probability: judgments.movementProbabilities[movement.id] ?? 0,
      }))
      .filter((movement) => movement.probability >= MIN_MOVEMENT_PROBABILITY)
      .sort((a, b) => b.probability - a.probability),
  }

  if (judgments.scheme.confidence >= MIN_CHOICE_CONFIDENCE) {
    suggestion.scheme = judgments.scheme.choice
    suggestion.schemeConfidence = judgments.scheme.confidence
  }
  if (judgments.scoreType.confidence >= MIN_CHOICE_CONFIDENCE) {
    suggestion.scoreType = judgments.scoreType.choice
    suggestion.scoreTypeConfidence = judgments.scoreType.confidence
  }
  return suggestion
}

export function hasWorkoutMetadataSuggestion(
  suggestion: WorkoutMetadataSuggestion,
): boolean {
  return Boolean(
    suggestion.scheme ||
      suggestion.scoreType ||
      suggestion.movements.length > 0,
  )
}

/** Describe the state resets required when an accepted suggestion changes scheme. */
export function resolveWorkoutMetadataTransition(
  scheme: WorkoutScheme | undefined,
  scoreType: ScoreType | undefined,
): {
  scheme?: WorkoutScheme
  scoreType?: ScoreType
  clearTimeCap: boolean
  clearTiebreak: boolean
} {
  if (!scheme) {
    return {
      ...(scoreType ? { scoreType } : {}),
      clearTimeCap: false,
      clearTiebreak: false,
    }
  }

  return {
    scheme,
    scoreType: scoreType ?? DEFAULT_SCORE_TYPES[scheme],
    clearTimeCap: scheme !== "time-with-cap",
    clearTiebreak: scheme === "pass-fail",
  }
}
