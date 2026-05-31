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
    const session = await getAuthenticatedSession(credentialRequest)
    if (!session) {
      throw new Error("Unauthorized")
    }

    return withSessionOverride(session, () =>
      callCompetitionOperation(
        request.operation,
        request.input ?? {},
        credentialRequest,
      ),
    )
  }
}
