import type { WodsmithDb } from "@repo/wodsmith-db/mysql"

import type { TrainingActor } from "@repo/wodsmith-training"

export {
  assertTrainingActor,
  assertTrainingScope,
  assertTrainingTeam,
  type TrainingActor,
} from "@repo/wodsmith-training"

export type TrainingDatabase = WodsmithDb
export type TrainingTransaction = Parameters<
  Parameters<WodsmithDb["transaction"]>[0]
>[0]

export interface TrainingServiceDependencies {
  actor: TrainingActor
  db: TrainingDatabase
  /** The server adapter supplies the canonical entitlement policy. */
  hasFeature: (teamId: string, featureId: string) => Promise<boolean>
}
