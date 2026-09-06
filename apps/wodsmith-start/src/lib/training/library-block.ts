import type { TrainingBlock } from "./types"

export interface LibraryBlockSource {
  name: string
  description: string
  scheme: string
  scoreType: string | null
  roundsToScore: number | null
  timeCap: number | null
  repsPerRound: number | null
  tiebreakScheme: string | null
}

// @lat: [[training#Workout Library]]
export function libraryWorkoutToBlock(
  workout: LibraryBlockSource,
  id: string,
): TrainingBlock {
  if (workout.name.length > 160) {
    throw new Error(
      "This workout name exceeds the session limit of 160 characters. Shorten its name in the library before adding it.",
    )
  }
  if (workout.description.length > 6000) {
    throw new Error(
      "This workout prescription exceeds the session limit of 6,000 characters. Shorten it in the library before adding it.",
    )
  }
  if (
    !["time", "load", "reps"].includes(workout.scheme) ||
    (workout.roundsToScore ?? 1) !== 1 ||
    workout.timeCap != null ||
    workout.repsPerRound != null ||
    workout.tiebreakScheme != null ||
    (workout.scoreType != null &&
      workout.scoreType !== (workout.scheme === "time" ? "min" : "max"))
  ) {
    throw new Error(
      "This workout uses scoring the session composer cannot preserve yet. Choose a single time, load, or reps workout without rounds, caps, or tiebreaks.",
    )
  }
  return {
    id,
    kind: workout.scheme as "time" | "load" | "reps",
    title: workout.name,
    prescription: workout.description,
    scalingGuidance: "",
    coachGuidance: "",
  }
}
