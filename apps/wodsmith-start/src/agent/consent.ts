import { agentScopeSchema, agentScopes, scopeLabels } from "@repo/agent-auth"
import {
  type AgentOAuthConfig,
  AuthorizationError,
  oauthApi,
  oauthProvider,
  parseAgentAuthorizationRequest,
} from "@repo/agent-auth/provider"
import { userTable } from "@repo/wodsmith-db"
import {
  agentOAuthGrantsTable,
  agentOAuthRequestsTable,
} from "@repo/wodsmith-db/schemas/agent-oauth"
import { and, eq } from "drizzle-orm"
import { getDb } from "../db"
import { getSessionFromRequestCookie } from "../utils/auth"
import { consumeConsentRequest, digest, eligibleAgentTeams } from "./grants"

const consentPath = "/agent/authorize"
const connectionsPath = "/agent/connections"
export async function handleAgentOAuth(
  request: Request,
  env: AgentOAuthConfig,
  ctx: ExecutionContext,
): Promise<Response | null> {
  const url = new URL(request.url)
  const protocol = [
    "/.well-known/oauth-authorization-server",
    "/agent/token",
    "/agent/register",
  ]
  if (![consentPath, connectionsPath, ...protocol].includes(url.pathname))
    return null
  if (!env.AGENT_RESOURCE || !env.AGENT_AUTH_ORIGIN) {
    return url.pathname === connectionsPath
      ? page(
          "Connected applications",
          "<p>Agent connections are not enabled on this WodSmith environment.</p>",
        )
      : null
  }
  try {
    const resource = new URL(env.AGENT_RESOURCE)
    if (
      new URL(env.AGENT_AUTH_ORIGIN).protocol === "https:" &&
      resource.protocol !== "https:"
    )
      return null
  } catch {
    return null
  }
  if (url.origin !== env.AGENT_AUTH_ORIGIN)
    return new Response("Not found", { status: 404 })
  if (protocol.includes(url.pathname))
    return oauthProvider(env).fetch(request, env, ctx)
  if (!["GET", "POST"].includes(request.method))
    return new Response("Method not allowed", { status: 405 })
  // Same-origin POST is required even when the browser carries an existing login cookie.
  if (
    request.method === "POST" &&
    request.headers.get("Origin") !== env.AGENT_AUTH_ORIGIN
  )
    return new Response("Forbidden", { status: 403 })
  const session = await getSessionFromRequestCookie(request)
  if (!session?.userId)
    return Response.redirect(
      `${env.AGENT_AUTH_ORIGIN}/sign-in?redirect=${encodeURIComponent(url.pathname + url.search)}`,
      302,
    )
  const userId = session.userId
  try {
    if (url.pathname === connectionsPath)
      return await connections(request, userId)
    const oauth = oauthApi(env)
    if (request.method === "GET") {
      const parsed = await parseAgentAuthorizationRequest(oauth, request)
      if (parsed.codeChallengeMethod !== "S256" || !parsed.codeChallenge)
        return page(
          "Cannot connect",
          "<p>This connection requires S256 PKCE.</p>",
          400,
        )
      if (
        parsed.scope.some(
          (scope) =>
            !agentScopes.includes(scope as (typeof agentScopes)[number]),
        )
      )
        return page(
          "Cannot connect",
          "<p>The application requested unsupported permissions.</p>",
          400,
        )
      const client = await oauth.lookupClient(parsed.clientId)
      const teams = await eligibleAgentTeams(userId)
      const [user] = await getDb()
        .select()
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1)
      if (!user) return new Response("Unauthorized", { status: 401 })
      const id = crypto.randomUUID()
      await getDb()
        .insert(agentOAuthRequestsTable)
        .values({
          id,
          userId,
          sessionDigest: await digest(request.headers.get("Cookie") ?? ""),
          authorizationUrl: request.url,
          authGeneration: user.authGeneration,
          credentialDigest: await digest(user.passwordHash ?? ""),
          expiresAt: new Date(Date.now() + 10 * 60_000),
        })
      return page(
        "Connect to WodSmith",
        `<p><strong>${escapeHtml(client?.clientName ?? parsed.clientId)}</strong> wants access to your WodSmith account.</p><p>Client: ${escapeHtml(parsed.clientId)}<br>Return address: ${escapeHtml(parsed.redirectUri)}</p><form method="post"><input type="hidden" name="ticket" value="${id}"><fieldset><legend>Choose permissions</legend>${parsed.scope.map((scope) => `<label><input type="checkbox" name="scope" value="${scope}" ${scope === "training:read" ? "checked" : ""}>${escapeHtml(scopeLabels[agentScopeSchema.parse(scope)])}</label>`).join("")}</fieldset><fieldset><legend>Allow access to these workspaces and sources</legend>${teams.map((team) => `<label><input type="checkbox" name="teamId" value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</label>`).join("")}</fieldset><p>Deletion and publication are separate permissions. Access expires in 90 days. You can disconnect at any time.</p><button name="decision" value="approve">Connect</button> <button name="decision" value="deny">Cancel</button></form>`,
      )
    }
    const form = await request.formData()
    const ticket = await consumeConsentRequest(
      String(form.get("ticket") ?? ""),
      userId,
      await digest(request.headers.get("Cookie") ?? ""),
    )
    if (!ticket)
      return page(
        "Connection expired",
        "<p>Start the connection again.</p>",
        400,
      )
    const parsed = await parseAgentAuthorizationRequest(
      oauth,
      new Request(ticket.authorizationUrl),
    )
    if (form.get("decision") !== "approve") {
      const redirect = new URL(parsed.redirectUri)
      redirect.searchParams.set("error", "access_denied")
      redirect.searchParams.set("state", parsed.state)
      redirect.searchParams.set("iss", env.AGENT_AUTH_ORIGIN)
      return Response.redirect(redirect.href, 302)
    }
    const scopes = [
      ...new Set(
        form.getAll("scope").map((scope) => agentScopeSchema.parse(scope)),
      ),
    ]
    if (!scopes.length || scopes.some((scope) => !parsed.scope.includes(scope)))
      return page(
        "Invalid permissions",
        "<p>Start the connection again.</p>",
        400,
      )
    const teams = await eligibleAgentTeams(userId)
    const allowedTeamIds = [...new Set(form.getAll("teamId").map(String))]
    if (allowedTeamIds.some((id) => !teams.some((team) => team.id === id)))
      return page(
        "Invalid workspace",
        "<p>Start the connection again.</p>",
        403,
      )
    const [user] = await getDb()
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)
    if (
      !user ||
      user.authGeneration !== ticket.authGeneration ||
      (await digest(user.passwordHash ?? "")) !== ticket.credentialDigest
    )
      return new Response("Unauthorized", { status: 401 })
    const client = await oauth.lookupClient(parsed.clientId)
    const grantId = crypto.randomUUID()
    await getDb()
      .insert(agentOAuthGrantsTable)
      .values({
        id: grantId,
        userId,
        clientId: parsed.clientId,
        clientName: (client?.clientName ?? parsed.clientId).slice(0, 255),
        resource: env.AGENT_RESOURCE,
        scopes,
        allowedTeamIds,
        authGeneration: ticket.authGeneration,
        credentialDigest: ticket.credentialDigest,
        expiresAt: new Date(Date.now() + 90 * 86400_000),
      })
    try {
      const { redirectTo } = await oauth.completeAuthorization({
        request: parsed,
        userId,
        scope: scopes,
        metadata: { label: client?.clientName ?? parsed.clientId },
        props: { grantId, userId, clientId: parsed.clientId },
      })
      return Response.redirect(redirectTo, 302)
    } catch (error) {
      await getDb()
        .update(agentOAuthGrantsTable)
        .set({ revokedAt: new Date() })
        .where(eq(agentOAuthGrantsTable.id, grantId))
      throw error
    }
  } catch (error) {
    // Invalid client metadata/redirects never become an open redirect or reveal stack traces.
    if (error instanceof AuthorizationError)
      return page("Cannot connect", `<p>${escapeHtml(error.message)}</p>`, 400)
    return page(
      "Cannot connect",
      "<p>The connection could not be completed. Please start again.</p>",
      400,
    )
  }
}
async function connections(request: Request, userId: string) {
  if (request.method === "POST") {
    const form = await request.formData()
    await getDb()
      .update(agentOAuthGrantsTable)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(agentOAuthGrantsTable.id, String(form.get("grantId"))),
          eq(agentOAuthGrantsTable.userId, userId),
        ),
      )
    return Response.redirect(new URL(connectionsPath, request.url).href, 303)
  }
  const grants = await getDb()
    .select()
    .from(agentOAuthGrantsTable)
    .where(eq(agentOAuthGrantsTable.userId, userId))
  return page(
    "Connected applications",
    `<p>Review access to your training. Disconnecting takes effect on the next request.</p>${grants.map((g) => `<article><h2>${escapeHtml(g.clientName)}</h2><p>${g.scopes.map((s) => escapeHtml(scopeLabels[agentScopeSchema.parse(s)])).join(" · ")}</p><p>Workspaces: ${g.allowedTeamIds.map(escapeHtml).join(", ") || "None"}</p><p>Last used: ${g.lastUsedAt?.toISOString() ?? "Never"}</p>${g.revokedAt ? "<p>Disconnected</p>" : `<form method="post"><input type="hidden" name="grantId" value="${g.id}"><button>Disconnect</button></form>`}</article>`).join("") || "<p>No connected applications.</p>"}`,
  )
}
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  )
}
function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · WodSmith</title><style>body{font:16px/1.5 system-ui;background:#f5f4f0;color:#20241f;margin:0}main{max-width:640px;margin:40px auto;padding:24px}fieldset,article{border:1px solid #adb3a8;padding:20px;margin:24px 0}label{display:flex;gap:12px;margin:16px 0}button{font:inherit;padding:12px 20px;cursor:pointer}input{width:20px;height:20px}p{overflow-wrap:anywhere}a{color:#365d23}</style><main><a href="/">WodSmith</a><h1>${title}</h1>${body}<p><a href="${connectionsPath}">Manage connected applications</a></p></main></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
      },
    },
  )
}
