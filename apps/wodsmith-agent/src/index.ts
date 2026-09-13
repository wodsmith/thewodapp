import { Server } from "@modelcontextprotocol/server"
import { createMcpHandler } from "agents/mcp/server"
import type { AgentService } from "@repo/agent-auth"
import {
  resourceMetadata,
  type AgentOAuthConfig,
} from "@repo/agent-auth/provider"

export type GatewayEnv = AgentOAuthConfig & { TRAINING: AgentService }
export async function handleGateway(
  request: Request,
  env: GatewayEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url)
  const canonical = new URL(env.AGENT_RESOURCE)
  if (url.origin !== canonical.origin)
    return new Response("Not found", { status: 404 })
  const metadataPath = `/.well-known/oauth-protected-resource${canonical.pathname}`
  if (url.pathname === metadataPath && request.method === "GET")
    return Response.json(resourceMetadata(env), {
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  if (url.href !== canonical.href)
    return new Response("Not found", { status: 404 })
  if (request.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Mcp-Method, Mcp-Name, Mcp-Resource-Uri",
        "Access-Control-Max-Age": "86400",
      },
    })
  const match = /^Bearer ([^\s]+)$/i.exec(
    request.headers.get("Authorization") ?? "",
  )
  try {
    if (!match || !(await env.TRAINING.authorize(match[1])))
      return unauthorized(env)
    const token = match[1]
    // A new SDK server per HTTP request also supports stateless 2025-era clients.
    const handler = createMcpHandler(
      () => {
        const server = new Server(
          { name: "wodsmith-training", version: "0.1.0" },
          { capabilities: { tools: {} } },
        )
        server.setRequestHandler("tools/list", async () => ({
          tools: await env.TRAINING.listOperations(token),
        }))
        server.setRequestHandler("tools/call", async ({ params }) => {
          const outcome = await env.TRAINING.execute(
            token,
            params.name,
            params.arguments ?? {},
          )
          const result = outcome
          return {
            isError: !outcome.ok,
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
            structuredContent: result,
          }
        })
        return server
      },
      {
        legacy: "stateless",
        allowedHostnames: [canonical.hostname],
        allowedOriginHostnames: [
          canonical.hostname,
          new URL(env.AGENT_AUTH_ORIGIN).hostname,
        ],
      },
    )
    return await handler(request, env, ctx)
  } catch {
    return Response.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
function unauthorized(env: AgentOAuthConfig) {
  const url = new URL(env.AGENT_RESOURCE)
  return Response.json(
    { error: "invalid_token" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${url.origin}/.well-known/oauth-protected-resource${url.pathname}"`,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "WWW-Authenticate",
      },
    },
  )
}
export default { fetch: handleGateway }
