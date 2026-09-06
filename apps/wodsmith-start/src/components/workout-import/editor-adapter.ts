import type { WorkoutFormData } from "@/components/workout-form"
import type { WorkoutImportWorkout } from "@/lib/workout-import"

export const emptyImportWorkout: WorkoutImportWorkout = {
  name: null,
  description: null,
  scheme: null,
  scoreType: null,
  timeCapSeconds: null,
  roundsToScore: null,
  repsPerRound: null,
  tiebreakScheme: null,
  scalingGroupId: null,
  movementIds: [],
}

export function importWorkoutToForm(
  workout: WorkoutImportWorkout,
  scope: "private" | "public",
): Partial<WorkoutFormData> {
  return {
    name: workout.name ?? "",
    description: workout.description ?? "",
    scheme: workout.scheme ?? undefined,
    scoreType: workout.scoreType ?? undefined,
    scope,
    timeCap: workout.timeCapSeconds ?? undefined,
    roundsToScore: workout.roundsToScore ?? undefined,
    repsPerRound: workout.repsPerRound ?? undefined,
    tiebreakScheme: workout.tiebreakScheme ?? undefined,
    scalingGroupId: workout.scalingGroupId ?? undefined,
    movementIds: workout.movementIds,
  }
}

export function formToImportWorkout(
  form: Partial<WorkoutFormData>,
): WorkoutImportWorkout {
  return {
    name: form.name || null,
    description: form.description || null,
    scheme: form.scheme ?? null,
    scoreType: form.scoreType ?? null,
    timeCapSeconds: form.timeCap ?? null,
    roundsToScore: form.roundsToScore ?? null,
    repsPerRound: form.repsPerRound ?? null,
    tiebreakScheme: form.tiebreakScheme ?? null,
    scalingGroupId: form.scalingGroupId ?? null,
    movementIds: form.movementIds ?? [],
  }
}

export const importFieldLabels: Record<keyof WorkoutImportWorkout, string> = {
  name: "Workout name",
  description: "Description",
  scheme: "Scoring method",
  scoreType: "Score aggregation",
  timeCapSeconds: "Time cap (seconds)",
  roundsToScore: "Number of separately recorded scores",
  repsPerRound: "Reps per round",
  tiebreakScheme: "Tiebreak",
  scalingGroupId: "Scaling group",
  movementIds: "Movements",
}
