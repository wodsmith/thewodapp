import { WorkerEntrypoint } from "cloudflare:workers"
import { handleMcpRequest } from "./mcp/handler"
import { handleMcpOperationOutbound } from "./mcp/outbound"
import type { SessionCredential } from "./types"

function isMcpPath(pathname: string): boolean {
  return pathname === "/mcp" || pathname === "/api/mcp"
}

export class WodsmithCodeModeOutbound extends WorkerEntrypoint<
  Env,
  { credential: SessionCredential }
> {
  async fetch(request: Request): Promise<Response> {
    return handleMcpOperationOutbound(
      request,
      this.env,
      this.ctx.props.credential,
    )
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url)
    if (isMcpPath(url.pathname)) {
      return handleMcpRequest(request, env, ctx)
    }

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("WODsmith Code Mode MCP", {
        headers: { "Content-Type": "text/plain" },
      })
    }

    return new Response("Not Found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
