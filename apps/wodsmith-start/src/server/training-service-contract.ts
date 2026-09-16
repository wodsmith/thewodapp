import type { WodsmithDb } from "@repo/wodsmith-db/mysql"

import type { TrainingActor, TrainingScope } from "@repo/wodsmith-training"

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
  /** Grant adapters must revalidate and lock live authority inside mutations. */
  authorizeActor?: (
    db: TrainingDatabase | TrainingTransaction,
    actor: TrainingActor,
    scope: TrainingScope,
  ) => Promise<void>
  actor: TrainingActor
  db: TrainingDatabase | TrainingTransaction
  /** The server adapter supplies the canonical entitlement policy. */
  hasFeature: (
    teamId: string,
    featureId: string,
    db: TrainingDatabase | TrainingTransaction,
  ) => Promise<boolean>
}
