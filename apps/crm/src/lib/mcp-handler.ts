import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { createCrmMcpServer } from "@/mcp"
import { isAuthenticatedRequest } from "@/server-fns/auth"

export async function handleMcpRequest(request: Request) {
  // `@lat`: [[auth]]
  if (!(await isAuthenticatedRequest(request))) {
    return new Response("Unauthorized", { status: 401 })
  }

  const server = createCrmMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  await server.connect(transport)
  return transport.handleRequest(request)
}
