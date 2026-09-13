import { createId } from "@paralleldrive/cuid2"
import { teamTable, workoutMovements, workouts } from "@repo/wodsmith-db/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { normalizedWorkoutSaveSchema } from "@/lib/workout-import"
import { createPersonalTrainingService } from "./training-personal-service"
import { trainingLibraryWorkoutSchema } from "./training-personal-validation"
import { createTrainingService } from "./training-service"
import type {
  TrainingServiceDependencies,
  TrainingTransaction,
} from "./training-service-contract"
import {
  expectedVersionSchema,
  mutationFields,
  runTrainingMutation,
  trainingVersion,
} from "./training-mutations"
import { requireWorkoutTeamWrite } from "./workout-import/access"
import {
  insertWorkoutWithMovements,
  validateWorkoutReferences,
} from "./workout-import/persistence"

export const createOwnedWorkoutSchema = z.object({
  ...mutationFields,
  workout: normalizedWorkoutSaveSchema,
})
export const updateOwnedWorkoutSchema = createOwnedWorkoutSchema.extend({
  workoutId: z.string().min(1).max(255),
  expectedVersion: expectedVersionSchema,
})
export const deleteOwnedWorkoutSchema = z.object({
  ...mutationFields,
  workoutId: z.string().min(1).max(255),
  expectedVersion: expectedVersionSchema,
})

type Definition = typeof workouts.$inferSelect & { movementIds: string[] }
export function workoutVersion(workout: Definition): Promise<string> {
  const {
    id,
    name,
    description,
    scheme,
    scope,
    scoreType,
    repsPerRound,
    roundsToScore,
    teamId,
    sugarId,
    tiebreakScheme,
    timeCap,
    sourceTrackId,
    sourceWorkoutId,
    scalingGroupId,
    updateCounter,
    archivedAt,
    movementIds,
  } = workout
  return trainingVersion({
    id,
    name,
    description,
    scheme,
    scope,
    scoreType,
    repsPerRound,
    roundsToScore,
    teamId,
    sugarId,
    tiebreakScheme,
    timeCap,
    sourceTrackId,
    sourceWorkoutId,
    scalingGroupId,
    updateCounter,
    archivedAt,
    movementIds: [...movementIds].sort(),
  })
}
async function readLockedWorkout(
  tx: TrainingTransaction,
  workoutId: string,
  teamId: string,
): Promise<Definition> {
  const [workout] = await tx
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.teamId, teamId)))
    .for("update")
  if (!workout || workout.archivedAt)
    throw new Error("NOT_FOUND: Owned workout not found")
  const links = await tx
    .select()
    .from(workoutMovements)
    .where(eq(workoutMovements.workoutId, workoutId))
    .for("update")
  return {
    ...workout,
    movementIds: links.flatMap((link) =>
      link.movementId ? [link.movementId] : [],
    ),
  }
}
async function authorizeOwnedWorkouts(
  deps: TrainingServiceDependencies,
  tx: TrainingTransaction,
  teamId: string,
  permission: string,
) {
  await createTrainingService({ ...deps, db: tx }).requireTrainingAccess(teamId)
  const [team] = await tx
    .select({ id: teamTable.id })
    .from(teamTable)
    .where(
      and(
        eq(teamTable.id, teamId),
        eq(teamTable.isPersonalTeam, true),
        eq(teamTable.personalTeamOwnerId, deps.actor.userId),
      ),
    )
    .for("share")
  if (!team)
    throw new Error("FORBIDDEN: Only your personal library can be changed")
  try {
    await requireWorkoutTeamWrite(deps.actor.userId, teamId, permission, tx)
  } catch {
    throw new Error("FORBIDDEN: Workout permission is required")
  }
}
async function validateDefinition(
  tx: TrainingTransaction,
  input: z.infer<typeof normalizedWorkoutSaveSchema>,
  teamId: string,
) {
  try {
    await validateWorkoutReferences(tx, input, teamId)
  } catch (error) {
    throw new Error(
      `VALIDATION: ${error instanceof Error ? error.message : "Invalid workout references"}`,
    )
  }
}
export async function createOwnedWorkout(
  deps: TrainingServiceDependencies,
  input: z.infer<typeof createOwnedWorkoutSchema>,
) {
  const data = createOwnedWorkoutSchema.parse(input)
  return runTrainingMutation(
    deps,
    "create_workout",
    "workouts:write",
    data,
    (tx) =>
      authorizeOwnedWorkouts(
        deps,
        tx,
        data.teamId,
        TEAM_PERMISSIONS.CREATE_COMPONENTS,
      ),
    async (tx) => {
      await validateDefinition(tx, data.workout, data.teamId)
      const id = await insertWorkoutWithMovements(tx, data.workout, data.teamId)
      const workout = await readLockedWorkout(tx, id, data.teamId)
      return { workout, version: await workoutVersion(workout) }
    },
  )
}
export async function updateOwnedWorkout(
  deps: TrainingServiceDependencies,
  input: z.infer<typeof updateOwnedWorkoutSchema>,
) {
  const data = updateOwnedWorkoutSchema.parse(input)
  return runTrainingMutation(
    deps,
    "update_workout",
    "workouts:write",
    data,
    (tx) =>
      authorizeOwnedWorkouts(
        deps,
        tx,
        data.teamId,
        TEAM_PERMISSIONS.EDIT_COMPONENTS,
      ),
    async (tx) => {
      const existing = await readLockedWorkout(tx, data.workoutId, data.teamId)
      if ((await workoutVersion(existing)) !== data.expectedVersion)
        throw new Error(
          "CONFLICT: The workout changed; read it again before editing",
        )
      await validateDefinition(tx, data.workout, data.teamId)
      const { movementIds, timeCapSeconds, ...fields } = data.workout
      await tx
        .update(workouts)
        .set({ ...fields, timeCap: timeCapSeconds, updatedAt: new Date() })
        .where(eq(workouts.id, existing.id))
      await tx
        .delete(workoutMovements)
        .where(eq(workoutMovements.workoutId, existing.id))
      if (movementIds.length)
        await tx.insert(workoutMovements).values(
          movementIds.map((movementId) => ({
            id: `wm_${createId()}`,
            workoutId: existing.id,
            movementId,
          })),
        )
      const workout = await readLockedWorkout(tx, existing.id, data.teamId)
      return { workout, version: await workoutVersion(workout) }
    },
  )
}
export async function deleteOwnedWorkout(
  deps: TrainingServiceDependencies,
  input: z.infer<typeof deleteOwnedWorkoutSchema>,
) {
  const data = deleteOwnedWorkoutSchema.parse(input)
  return runTrainingMutation(
    deps,
    "delete_workout",
    "workouts:delete",
    data,
    (tx) =>
      authorizeOwnedWorkouts(
        deps,
        tx,
        data.teamId,
        TEAM_PERMISSIONS.DELETE_COMPONENTS,
      ),
    async (tx) => {
      const existing = await readLockedWorkout(tx, data.workoutId, data.teamId)
      if ((await workoutVersion(existing)) !== data.expectedVersion)
        throw new Error(
          "CONFLICT: The workout changed; read it again before deleting",
        )
      // Retain the physical definition for history and in-flight reference writers.
      await tx
        .update(workouts)
        .set({ archivedAt: new Date() })
        .where(eq(workouts.id, existing.id))
      return { deleted: true, archived: true, workoutId: existing.id }
    },
  )
}

export async function getAgentWorkout(
  deps: TrainingServiceDependencies,
  input: z.infer<typeof trainingLibraryWorkoutSchema>,
) {
  const data = trainingLibraryWorkoutSchema.parse(input)
  return deps.db.transaction(
    async (tx) => {
      const [row] = await tx
        .select()
        .from(workouts)
        .where(eq(workouts.id, data.workoutId))
        .for("share")
      const workout = await createPersonalTrainingService({
        ...deps,
        db: tx,
      }).getTrainingLibraryWorkout(data)
      if (!row) throw new Error("NOT_FOUND: Workout not found")
      return {
        workout,
        version: await workoutVersion({
          ...row,
          movementIds: workout.movementIds,
        }),
        definition: {
          name: row.name,
          description: row.description,
          scope: row.scope,
          scheme: row.scheme,
          scoreType: row.scoreType,
          repsPerRound: row.repsPerRound,
          roundsToScore: row.roundsToScore ?? 1,
          timeCapSeconds: row.timeCap,
          tiebreakScheme: row.tiebreakScheme,
          scalingGroupId: row.scalingGroupId,
          movementIds: workout.movementIds,
        },
      }
    },
    { isolationLevel: "read committed" },
  )
}
