import "server-only"

import { WorkerEntrypoint } from "cloudflare:workers"
import type { SessionValidationResult } from "@/types"
import { getSessionFromBearer } from "@/utils/bearer-auth"
import { getSessionFromRequestCookie, withSessionOverride } from "@/utils/auth"
import {
  callCompetitionOperation,
  listCompetitionOperationSpecs,
} from "./competition-operations"

type AuthenticatedSession = NonNullable<SessionValidationResult>

type SessionCredential =
  | {
      kind: "bearer"
      authorization: string
    }
  | {
      kind: "cookie"
      cookie: string
    }

export interface McpOperationCall {
  credential: SessionCredential
  operation: string
  input?: unknown
}

export interface WodsmithMcpOperationsRpc extends Rpc.WorkerEntrypointBranded {
  listCompetitionOperationSpecs(): Promise<
    ReturnType<typeof listCompetitionOperationSpecs>
  >
  callCompetitionOperation(request: McpOperationCall): Promise<unknown>
}

function requestFromCredential(credential: SessionCredential): Request {
  const headers = new Headers()

  if (credential.kind === "bearer") {
    headers.set("Authorization", credential.authorization)
  } else {
    headers.set("Cookie", credential.cookie)
  }

  return new Request("https://wodsmith-mcp.internal/rpc", { headers })
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

async function getAuthenticatedSession(
  request: Request,
): Promise<AuthenticatedSession | null> {
  const bearerSession = await getSessionFromBearer(request)
  if (bearerSession?.userId) return bearerSession

  const cookieSession = await getSessionFromRequestCookie(request)
  if (cookieSession?.userId) return cookieSession

  return null
}

export class WodsmithMcpOperations extends WorkerEntrypoint<Env> {
  async listCompetitionOperationSpecs() {
    return listCompetitionOperationSpecs()
  }

  async callCompetitionOperation(request: McpOperationCall) {
    const credentialRequest = requestFromCredential(request.credential)
    console.info("[MCP RPC] Authenticating operation call", {
      operation: request.operation,
      input: describeValue(request.input ?? {}),
      credentialKind: request.credential.kind,
    })
    const session = await getAuthenticatedSession(credentialRequest)
    if (!session) {
      console.warn("[MCP RPC] Operation call rejected as unauthorized", {
        operation: request.operation,
      })
      throw new Error("Unauthorized")
    }

    console.info("[MCP RPC] Operation call authenticated", {
      operation: request.operation,
      userId: session.userId,
    })

    return withSessionOverride(session, async () => {
      const result = await callCompetitionOperation(
        request.operation,
        request.input ?? {},
        credentialRequest,
      )
      console.info("[MCP RPC] Operation call completed", {
        operation: request.operation,
        result: describeValue(result),
      })
      return result
    })
  }
}
