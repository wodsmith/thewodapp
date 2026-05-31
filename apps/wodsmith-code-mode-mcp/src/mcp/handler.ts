import { createMcpHandler } from "agents/mcp"
import { authenticateMcpRequest, unauthorizedResponse } from "../auth"
import type { CompetitionOperationSpec } from "../types"
import { listCompetitionOperationSpecs } from "../wodsmith-service"
import { createWodsmithMcpServer } from "./server"

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function handleMcpRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const session = await authenticateMcpRequest(request, env)
  if (!session) return unauthorizedResponse()

  let operationSpecs: CompetitionOperationSpec[]
  try {
    operationSpecs = await listCompetitionOperationSpecs(env)
  } catch (error) {
    console.error("[MCP] Failed to load WODsmith operation catalog", error)
    return Response.json(
      {
        error: `Failed to load WODsmith operation catalog: ${errorMessage(error)}`,
      },
      { status: 502 },
    )
  }

  const server = createWodsmithMcpServer(env, ctx, session, operationSpecs)
  const route = new URL(request.url).pathname
  const handler = createMcpHandler(server, {
    route,
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    authContext: {
      props: {
        userId: session.userId,
        sessionId: session.sessionId,
      },
    },
  })

  try {
    return await handler(request, env, ctx)
  } finally {
    await server.close().catch(() => {})
  }
}
