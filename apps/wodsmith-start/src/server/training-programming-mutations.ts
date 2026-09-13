import { trainingSessionsTable } from "@repo/wodsmith-db/schema"
import { and, eq } from "drizzle-orm"
import type { z } from "zod"
import { mutationFields, runTrainingMutation } from "./training-mutations"
import {
  preparePersonalSessions,
  savePreparedPersonalSessions,
} from "./training-personal-batch"
import { personalTrainingSaveSchema } from "./training-personal-validation"
import {
  createTrainingService,
  createTrainingServiceInTransaction,
} from "./training-service"
import type {
  TrainingServiceDependencies,
  TrainingTransaction,
} from "./training-service-contract"
import {
  trainingDraftInputSchema,
  trainingPublishInputSchema,
} from "./training-validation"

export const agentTrainingDraftSchema =
  trainingDraftInputSchema.extend(mutationFields)
export const agentTrainingPublishSchema =
  trainingPublishInputSchema.extend(mutationFields)
export const agentPersonalDaySchema = personalTrainingSaveSchema
  .safeExtend(mutationFields)
  .refine(
    (input) => input.mode === "replace",
    "Agent day saves replace the reviewed composition",
  )

export async function saveAgentTrainingDraft(
  deps: TrainingServiceDependencies,
  input: z.infer<typeof agentTrainingDraftSchema>,
) {
  const data = agentTrainingDraftSchema.parse(input)
  return runTrainingMutation(
    deps,
    "save_programming_draft",
    "programming:write",
    data,
    async (tx) => {
      await createTrainingService({ ...deps, db: tx }).requireTrainingAccess(
        data.teamId,
        data.trackId,
        true,
      )
    },
    async (tx) => ({
      session: await createTrainingServiceInTransaction(
        deps,
        tx,
      ).saveTrainingDraft(data),
    }),
  )
}
export async function publishAgentTrainingSession(
  deps: TrainingServiceDependencies,
  input: z.infer<typeof agentTrainingPublishSchema>,
) {
  const data = agentTrainingPublishSchema.parse(input)
  return runTrainingMutation(
    deps,
    "publish_programming",
    "programming:publish",
    data,
    async (tx) => {
      const [session] = await tx
        .select()
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.id, data.sessionId),
            eq(trainingSessionsTable.teamId, data.teamId),
          ),
        )
        .for("update")
      if (!session) throw new Error("NOT_FOUND: Programming session not found")
      await createTrainingService({ ...deps, db: tx }).requireTrainingAccess(
        data.teamId,
        session.trackId,
        true,
      )
    },
    async (tx) => ({
      session: await createTrainingServiceInTransaction(
        deps,
        tx,
      ).publishTrainingSession(data),
    }),
  )
}
export async function saveAgentPersonalDay(
  deps: TrainingServiceDependencies,
  input: z.infer<typeof agentPersonalDaySchema>,
) {
  const data = agentPersonalDaySchema.parse(input)
  return runTrainingMutation(
    deps,
    "save_personal_training_day",
    "training:write",
    data,
    async (tx) => {
      await createTrainingService({ ...deps, db: tx }).requireTrainingAccess(
        data.teamId,
      )
    },
    async (tx: TrainingTransaction) => {
      const { prepared } = await preparePersonalSessions({ ...deps, db: tx }, [
        data,
      ])
      const [session] = await savePreparedPersonalSessions(deps, tx, prepared)
      return { session }
    },
  )
}
