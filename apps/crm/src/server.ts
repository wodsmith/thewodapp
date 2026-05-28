import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { CrmMcp } from "@/mcp"
import { SESSION_COOKIE, verifySessionToken } from "@/server-fns/auth"

export { CrmMcp }

// `@lat`: [[auth]]
function getCookieValue(request: Request, name: string) {
  const cookie = request.headers.get("Cookie")
  if (!cookie) return null

  for (const part of cookie.split(";")) {
    const [key, ...valueParts] = part.trim().split("=")
    if (key !== name) continue

    try {
      return decodeURIComponent(valueParts.join("="))
    } catch {
      return null
    }
  }

  return null
}

// `@lat`: [[auth]]
function getBearerToken(request: Request) {
  const authorization = request.headers.get("Authorization")
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

// `@lat`: [[auth]]
async function isMcpAuthenticated(request: Request) {
  const bearerToken = getBearerToken(request)
  if (bearerToken && (await verifySessionToken(bearerToken))) {
    return true
  }

  const cookieToken = getCookieValue(request, SESSION_COOKIE)
  return cookieToken ? verifySessionToken(cookieToken) : false
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
      // `@lat`: [[auth]]
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
