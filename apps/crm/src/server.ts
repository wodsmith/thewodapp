import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { CrmMcp } from "@/mcp"
import { SESSION_COOKIE, verifySessionToken } from "@/server-fns/auth"

export { CrmMcp }

function getCookieValue(request: Request, name: string) {
  const cookie = request.headers.get("Cookie")
  if (!cookie) return null

  for (const part of cookie.split(";")) {
    const [key, ...valueParts] = part.trim().split("=")
    if (key === name) return decodeURIComponent(valueParts.join("="))
  }

  return null
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("Authorization")
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

async function isMcpAuthenticated(request: Request) {
  const token =
    getBearerToken(request) ?? getCookieValue(request, SESSION_COOKIE)
  return token ? verifySessionToken(token) : false
}

const startEntry = createServerEntry({
  fetch(request) {
    return handler.fetch(request)
  },
})

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const url = new URL(request.url)
    if (url.pathname === "/mcp") {
      if (!(await isMcpAuthenticated(request))) {
        return new Response("Unauthorized", { status: 401 })
      }

      return CrmMcp.serve("/mcp", { binding: "CRM_MCP" }).fetch(
        request,
        env,
        ctx,
      )
    }

    return startEntry.fetch(request)
  },
}
