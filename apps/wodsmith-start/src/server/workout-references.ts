import "server-only"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"
import type { WorkoutImportDatabase } from "./workout-import/access"
import { validateWorkoutReferences } from "./workout-import/persistence"

type WorkoutReferences = Pick<
  NormalizedWorkoutSave,
  "movementIds" | "scalingGroupId" | "scalingDescriptions"
>

// @lat: [[review-backend#Stored references survive catalog changes]]
export function validateChangedWorkoutReferences(
  db: WorkoutImportDatabase,
  current: WorkoutReferences,
  previous: WorkoutReferences | undefined,
  teamId: string,
): Promise<void> {
  return validateWorkoutReferences(
    db,
    {
      movementIds: current.movementIds.filter(
        (id) => !previous?.movementIds.includes(id),
      ),
      scalingGroupId:
        !current.scalingDescriptions?.length &&
        current.scalingGroupId === previous?.scalingGroupId
          ? null
          : current.scalingGroupId,
      scalingDescriptions: current.scalingDescriptions,
    },
    teamId,
  )
}
