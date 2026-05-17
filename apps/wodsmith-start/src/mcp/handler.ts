/**
 * Streamable HTTP entrypoint for the WODsmith MCP server.
 *
 * This is the `apiHandler` passed to the OAuth provider. The provider verifies
 * the access token before invoking this handler, and the granted props live at
 * `ctx.props`. Requests without a valid token never reach this code — they fall
 * through to the default TanStack Start handler, where unauthenticated /mcp
 * requests are served as anonymous (public-only) MCP sessions.
 */

import "server-only"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import type { McpGrantProps } from "./scopes"
import { createMcpServer } from "./server"

/**
 * Handle an `/mcp` request with optional auth context.
 *
 * Each request creates a fresh stateless transport — Cloudflare Workers don't
 * keep transports alive between requests, so we run in stateless mode and let
 * the MCP client send `initialize` each time if needed.
 */
async function handleMcpRequest(
  request: Request,
  props: McpGrantProps | undefined,
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  const server = createMcpServer(props)
  await server.connect(transport)
  try {
    return await transport.handleRequest(request)
  } finally {
    // Release the transport so the server doesn't hold onto a closed stream.
    await server.close().catch(() => {})
  }
}

/**
 * API handler invoked by the OAuth provider for authenticated `/mcp` requests.
 * `ctx.props` carries the grant props set by completeAuthorization().
 *
 * Typed loosely because `@cloudflare/workers-oauth-provider` extends
 * `ExecutionContext` with `props` at runtime — Cloudflare's stock types don't
 * know about that field.
 */
export const mcpApiHandler = {
  async fetch(
    request: Request,
    _env: unknown,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const props = (ctx as ExecutionContext & { props?: McpGrantProps }).props
    return handleMcpRequest(request, props)
  },
}

/**
 * Anonymous handler for `/mcp` invoked by the default handler when no bearer
 * token is present (or the token is invalid). The MCP server still works — but
 * only the public resources/tools return data; organizer paths gate on scope.
 */
export async function handleAnonymousMcpRequest(
  request: Request,
): Promise<Response> {
  return handleMcpRequest(request, undefined)
}
