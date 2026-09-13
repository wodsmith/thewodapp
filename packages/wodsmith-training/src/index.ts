/** Trusted identity derived by a server authentication adapter, never tool input. */
export interface TrainingActor {
  userId: string
  activeTeamId?: string | null
  grantId?: string
  clientId?: string
  scopes?: readonly string[]
  allowedTeamIds?: readonly string[]
}

export type TrainingScope =
  | "training:read"
  | "training:write"
  | "workouts:write"
  | "workouts:delete"
  | "results:write"
  | "results:delete"
  | "programming:read"
  | "programming:write"
  | "programming:publish"

export function assertTrainingActor(actor: TrainingActor): void {
  if (!actor.userId?.trim()) throw new Error("NOT_AUTHORIZED: Sign in to train")
  const hasGrant =
    actor.grantId !== undefined || actor.clientId !== undefined ||
    actor.scopes !== undefined || actor.allowedTeamIds !== undefined
  if (
    hasGrant &&
    (!actor.grantId?.trim() || !actor.clientId?.trim() ||
      !Array.isArray(actor.scopes) || !Array.isArray(actor.allowedTeamIds))
  )
    throw new Error("FORBIDDEN: Incomplete training grant")
}

export function assertTrainingScope(actor: TrainingActor, scope: TrainingScope): void {
  assertTrainingActor(actor)
  if (actor.scopes && !actor.scopes.includes(scope))
    throw new Error(`FORBIDDEN: ${scope} permission is required`)
}

export function assertTrainingTeam(actor: TrainingActor, teamId: string): void {
  assertTrainingActor(actor)
  if (actor.allowedTeamIds && !actor.allowedTeamIds.includes(teamId))
    throw new Error("FORBIDDEN: This workspace is outside the training grant")
}
