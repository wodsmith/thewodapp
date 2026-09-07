import { normalizedWorkoutSaveSchema } from "@/lib/workout-import/schemas"
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
  scalingGroupId?: string | null
  movementIds?: string[]
}

// @lat: [[training#Workout Library]]
export function libraryWorkoutToBlock(
  workout: LibraryBlockSource,
  id: string,
): TrainingBlock {
  const definition = normalizedWorkoutSaveSchema.parse({
    name: workout.name,
    description: workout.description.trim() || "No prescription provided.",
    scheme: workout.scheme,
    scoreType: workout.scoreType,
    roundsToScore: workout.roundsToScore ?? 1,
    timeCapSeconds: workout.timeCap,
    repsPerRound: workout.repsPerRound,
    tiebreakScheme: workout.tiebreakScheme,
    scalingGroupId: workout.scalingGroupId ?? null,
    movementIds: workout.movementIds ?? [],
    scope: "private",
  })
  return {
    id,
    kind: "workout",
    title: definition.name,
    prescription: definition.description,
    scalingGuidance: "",
    coachGuidance: "",
    workout: definition,
  }
}
