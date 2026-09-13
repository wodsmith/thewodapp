import { getDb } from "@/db"
import { hasFeature } from "@/server/entitlements"
import { getSessionFromCookie } from "@/utils/auth"
import { getActiveTeamId } from "@/utils/team-auth"
import type { TrainingServiceDependencies } from "./training-service-contract"

export async function getTrainingWebDependencies(): Promise<TrainingServiceDependencies> {
  const session = await getSessionFromCookie()
  if (!session?.userId) throw new Error("NOT_AUTHORIZED: Sign in to train")
  return {
    actor: { userId: session.userId, activeTeamId: await getActiveTeamId() },
    db: getDb(),
    hasFeature,
  }
}
