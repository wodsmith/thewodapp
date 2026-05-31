import type {
  CompetitionOperationSpec,
  SessionCredential,
  WodsmithOperationsService,
} from "./types"

function getWodsmithApp(env: Env): WodsmithOperationsService {
  const app = env.WODSMITH_APP
  if (!app) {
    throw new Error("WODSMITH_APP service binding is not configured")
  }
  return app
}

export async function listCompetitionOperationSpecs(
  env: Env,
): Promise<CompetitionOperationSpec[]> {
  return getWodsmithApp(env).listCompetitionOperationSpecs()
}

export async function callCompetitionOperation(
  env: Env,
  credential: SessionCredential,
  operation: string,
  input: unknown,
): Promise<unknown> {
  return getWodsmithApp(env).callCompetitionOperation({
    credential,
    operation,
    input,
  })
}
