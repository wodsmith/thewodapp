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

function describeValue(value: unknown): Record<string, unknown> {
  if (value === null) return { type: "null" }
  if (value === undefined) return { type: "undefined" }
  if (Array.isArray(value)) return { type: "array", length: value.length }
  if (typeof value === "object") {
    return { type: "object", keys: Object.keys(value).slice(0, 20) }
  }
  return { type: typeof value }
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
  console.info("[MCP service] Forwarding operation to WODSMITH_APP", {
    operation,
    input: describeValue(input),
    credentialKind: credential.kind,
  })
  const result = await getWodsmithApp(env).callCompetitionOperation({
    credential,
    operation,
    input,
  })
  console.info("[MCP service] WODSMITH_APP operation returned", {
    operation,
    result: describeValue(result),
  })
  return result
}
