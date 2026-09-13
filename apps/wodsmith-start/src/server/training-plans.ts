import {
  createTrainingPlanSchema,
  getSessionBlueprint,
} from "@repo/wodsmith-training/plans/blueprint"
import {
  createTrainingPlanService,
  planCommitInputSchema,
  planDeleteInputSchema,
  planGetInputSchema,
  planListInputSchema,
} from "@repo/wodsmith-training/plans/service"
import { z } from "zod"
import { createPersonalTrainingService } from "./training-personal-service"
import { personalTrainingItemSchema } from "./training-personal-validation"
import {
  preparePersonalSessions,
  validatePreparedPersonalSessions,
  savePreparedPersonalSessions,
} from "./training-personal-batch"
import { createTrainingService } from "./training-service"
import {
  assertTrainingScope,
  type TrainingActor,
  type TrainingServiceDependencies,
} from "./training-service-contract"

export const trainingPlanDocumentSchema = createTrainingPlanSchema(
  personalTrainingItemSchema,
)
export const trainingPlanOperationSchemas = {
  get_session_blueprint: z.object({ version: z.string().optional() }).strict(),
  create_training_plan: trainingPlanDocumentSchema,
  get_training_plan: planGetInputSchema,
  list_training_plans: planListInputSchema,
  update_training_plan: planDeleteInputSchema
    .extend({ document: trainingPlanDocumentSchema })
    .strict(),
  delete_training_plan: planDeleteInputSchema,
  preview_training_plan: planGetInputSchema,
  commit_training_plan: planCommitInputSchema,
}

export type TrainingPlanningDependencies = TrainingServiceDependencies

// @lat: [[training-plans#Canonical Adapter]]
export function createTrainingPlanningService(
  dependencies: TrainingPlanningDependencies,
) {
  return createTrainingPlanService(dependencies.db, {
    parseDocument: (value) => trainingPlanDocumentSchema.parse(value),
    authorize: async (db, actor: TrainingActor, permission, document) => {
      assertTrainingScope(actor, permission)
      if (actor.grantId && !dependencies.authorizeActor)
        throw new Error(
          "FORBIDDEN: Planning requires current grant authorization",
        )
      await dependencies.authorizeActor?.(db, actor, permission)
      const training = createTrainingService({ ...dependencies, db, actor })
      for (const teamId of [
        ...new Set(document.days.map((day) => day.accessTeamId)),
      ].sort())
        await training.requireTrainingAccess(teamId)
    },
    prepare: async (db, actor, days) => {
      const canonical = { ...dependencies, db, actor }
      const personal = createPersonalTrainingService(canonical)
      const inputs = []
      for (const day of days) {
        const current = await personal.getPersonalTrainingDay({
          teamId: day.accessTeamId,
          trainingDate: day.trainingDate,
        })
        inputs.push({
          teamId: day.accessTeamId,
          trainingDate: day.trainingDate,
          expectedRevision: current.personalSession?.revision ?? 0,
          mode: "replace" as const,
          items: day.items.map(({ item, role, estimatedDurationMinutes }) => ({
            ...item,
            ...(role === undefined ? {} : { role }),
            ...(estimatedDurationMinutes === undefined
              ? {}
              : { estimatedDurationMinutes }),
          })),
        })
      }
      return preparePersonalSessions(canonical, inputs)
    },
    validate: (tx, actor, prepared) =>
      validatePreparedPersonalSessions(
        { ...dependencies, actor },
        tx,
        prepared,
      ),
    save: async (tx, actor, prepared) => {
      const sessions = await savePreparedPersonalSessions(
        { ...dependencies, actor },
        tx,
        prepared,
      )
      return sessions.map(({ id, trainingDate, revision }) => ({
        id,
        trainingDate,
        revision,
      }))
    },
  })
}

export { getSessionBlueprint }
