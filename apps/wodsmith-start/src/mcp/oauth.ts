import { env } from "cloudflare:workers"
import {
  createSession,
  generateSessionToken,
  getSessionFromRequestCookie,
} from "@/utils/auth"
import { encodeBearerToken } from "@/utils/bearer-auth"

const OAUTH_CODE_PREFIX = "mcp_oauth_code:"
const CODE_TTL_SECONDS = 300
const ACCESS_TOKEN_TYPE = "Bearer"

type OAuthCodeRecord = {
  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: "S256"
  userId: string
  createdAt: number
}

function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers)
  headers.set("Content-Type", "application/json")
  headers.set("Cache-Control", "no-store")
  return new Response(JSON.stringify(data), { ...init, headers })
}

function baseUrl(request: Request): string {
  const configured = (env as unknown as { APP_URL?: string }).APP_URL
  return configured?.replace(/\/$/, "") ?? new URL(request.url).origin
}

function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

async function sha256Base64Url(value: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  )
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function redirectWithParams(
  redirectUri: string,
  params: Record<string, string>,
): Response {
  const url = new URL(redirectUri)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return Response.redirect(url.toString(), 302)
}

function authorizationServerMetadata(request: Request): Response {
  const issuer = baseUrl(request)
  return json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  })
}

function protectedResourceMetadata(request: Request): Response {
  const issuer = baseUrl(request)
  return json({
    resource: issuer,
    authorization_servers: [issuer],
  })
}

async function registerClient(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    // Dynamic client registration permits sparse clients; invalid JSON still
    // gets a useful default client for MCP clients that probe registration.
  }

  return json(
    {
      client_id: `mcp_${randomToken(18)}`,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: Array.isArray(body.redirect_uris)
        ? body.redirect_uris
        : undefined,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201 },
  )
}

async function authorize(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const redirectUri = url.searchParams.get("redirect_uri")
  const clientId = url.searchParams.get("client_id")
  const responseType = url.searchParams.get("response_type")
  const codeChallenge = url.searchParams.get("code_challenge")
  const codeChallengeMethod = url.searchParams.get("code_challenge_method")
  const state = url.searchParams.get("state")

  if (
    !redirectUri ||
    !clientId ||
    responseType !== "code" ||
    !codeChallenge ||
    codeChallengeMethod !== "S256"
  ) {
    return new Response("Invalid OAuth authorization request", { status: 400 })
  }

  const session = await getSessionFromRequestCookie(request)
  if (!session?.userId) {
    const signInUrl = new URL("/_auth/sign-in", baseUrl(request))
    signInUrl.searchParams.set("redirect", `${url.pathname}${url.search}`)
    return Response.redirect(signInUrl.toString(), 302)
  }

  const code = randomToken()
  const record: OAuthCodeRecord = {
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    userId: session.userId,
    createdAt: Date.now(),
  }
  await env.KV_SESSION.put(
    `${OAUTH_CODE_PREFIX}${code}`,
    JSON.stringify(record),
    {
      expirationTtl: CODE_TTL_SECONDS,
    },
  )

  return redirectWithParams(redirectUri, {
    code,
    ...(state ? { state } : {}),
  })
}

async function token(request: Request): Promise<Response> {
  const body = await request.formData().catch(() => null)
  if (!body) {
    return json({ error: "invalid_request" }, { status: 400 })
  }

  const grantType = String(body.get("grant_type") ?? "")
  const code = String(body.get("code") ?? "")
  const redirectUri = String(body.get("redirect_uri") ?? "")
  const clientId = String(body.get("client_id") ?? "")
  const codeVerifier = String(body.get("code_verifier") ?? "")

  if (grantType !== "authorization_code" || !code || !codeVerifier) {
    return json({ error: "unsupported_grant_type" }, { status: 400 })
  }

  const key = `${OAUTH_CODE_PREFIX}${code}`
  const raw = await env.KV_SESSION.get(key)
  if (!raw) {
    return json({ error: "invalid_grant" }, { status: 400 })
  }
  await env.KV_SESSION.delete(key)

  const record = JSON.parse(raw) as OAuthCodeRecord
  const challenge = await sha256Base64Url(codeVerifier)
  if (
    record.clientId !== clientId ||
    record.redirectUri !== redirectUri ||
    record.codeChallenge !== challenge
  ) {
    return json({ error: "invalid_grant" }, { status: 400 })
  }

  const sessionToken = generateSessionToken()
  const session = await createSession({
    token: sessionToken,
    userId: record.userId,
  })
  const accessToken = encodeBearerToken(record.userId, sessionToken).slice(
    "Bearer ".length,
  )

  return json({
    access_token: accessToken,
    token_type: ACCESS_TOKEN_TYPE,
    expires_in: Math.max(
      0,
      Math.floor((session.expiresAt - Date.now()) / 1000),
    ),
    scope: "mcp",
  })
}

export function handleMcpOAuthRequest(
  request: Request,
): Promise<Response> | Response | null {
  const url = new URL(request.url)

  if (
    request.method === "GET" &&
    url.pathname === "/.well-known/oauth-authorization-server"
  ) {
    return authorizationServerMetadata(request)
  }
  if (
    request.method === "GET" &&
    url.pathname === "/.well-known/oauth-protected-resource"
  ) {
    return protectedResourceMetadata(request)
  }
  if (request.method === "POST" && url.pathname === "/oauth/register") {
    return registerClient(request)
  }
  if (request.method === "GET" && url.pathname === "/oauth/authorize") {
    return authorize(request)
  }
  if (request.method === "POST" && url.pathname === "/oauth/token") {
    return token(request)
  }

  return null
}
