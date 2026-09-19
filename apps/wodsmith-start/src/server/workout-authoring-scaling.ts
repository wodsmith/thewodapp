import "server-only"
import { workoutScalingDescriptionsTable } from "@/db/schema"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"
import type { WorkoutImportDatabase } from "./workout-import/access"
import { validateWorkoutReferences } from "./workout-import/persistence"

export async function validateEventAuthoring(
  db: WorkoutImportDatabase,
  data: {
    scalingGroupId?: string
    scalingDescriptions?: NormalizedWorkoutSave["scalingDescriptions"]
    movementIds?: string[]
    scheme?: string
    timeCap?: number
  },
  teamId: string,
  expectedGroupId: string | null,
) {
  if (data.scalingGroupId && data.scalingGroupId !== expectedGroupId)
    throw new Error(
      "The destination divisions changed. Describe the workout again.",
    )
  if (
    data.scalingDescriptions !== undefined &&
    data.scheme === "time-with-cap" &&
    !data.timeCap
  )
    throw new Error("A capped workout requires a time cap")
  if (data.timeCap && data.scheme !== "time-with-cap")
    throw new Error("Only capped workouts can have a time cap")
  await validateWorkoutReferences(
    db,
    {
      movementIds: data.movementIds ?? [],
      scalingGroupId: data.scalingGroupId ?? null,
      scalingDescriptions: data.scalingDescriptions,
    },
    teamId,
  )
}

export async function insertAuthoringScaling(
  db: WorkoutImportDatabase,
  workoutId: string,
  descriptions: NormalizedWorkoutSave["scalingDescriptions"],
) {
  if (descriptions?.length)
    await db
      .insert(workoutScalingDescriptionsTable)
      .values(descriptions.map((item) => ({ ...item, workoutId })))
}
