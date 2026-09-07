import { SCORE_TYPES, WORKOUT_SCHEMES } from "@/constants"
import { decodeScore } from "@/lib/scoring"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"

export function trainingAggregationLabel(
  scoreType: NormalizedWorkoutSave["scoreType"],
) {
  if (scoreType === "first") return "First recorded score"
  if (scoreType === "last") return "Last recorded score"
  return (
    SCORE_TYPES.find((type) => type.value === scoreType)?.label ??
    "Default scoring"
  )
}

export function trainingWorkoutSummary(workout: NormalizedWorkoutSave) {
  return [
    WORKOUT_SCHEMES.find((scheme) => scheme.value === workout.scheme)?.label ??
      workout.scheme,
    workout.roundsToScore > 1
      ? `${workout.roundsToScore} scores · ${trainingAggregationLabel(workout.scoreType)}`
      : null,
    workout.timeCapSeconds
      ? `Time cap: ${decodeScore(workout.timeCapSeconds * 1000, "time")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
}
