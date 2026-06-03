import type {
  AuthenticatedMcpSession,
  KVSession,
  SessionCredential,
} from "./types"

const SESSION_COOKIE_NAME = "session"
const SESSION_PREFIX = "session:"

type SessionTokenParts = {
  userId: string
  token: string
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  )
}

async function generateSessionId(token: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  )
  return toHex(new Uint8Array(hashBuffer))
}

function getSessionKey(userId: string, sessionId: string): string {
  return `${SESSION_PREFIX}${userId}:${sessionId}`
}

function decodeSessionToken(value: string): SessionTokenParts | null {
  const colonIdx = value.indexOf(":")
  if (colonIdx < 1) return null

  const userId = value.slice(0, colonIdx)
  const token = value.slice(colonIdx + 1)
  if (!userId || !token) return null

  return { userId, token }
}

function getCookieFromHeader(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null

  const prefix = `${name}=`
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim()
    if (!trimmed.startsWith(prefix)) continue
    const value = trimmed.slice(prefix.length)
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  return null
}

async function validateSessionToken(
  env: Env,
  parts: SessionTokenParts,
): Promise<{ sessionId: string; session: KVSession } | null> {
  const sessionId = await generateSessionId(parts.token)
  const sessionStr = await env.KV_SESSION.get(
    getSessionKey(parts.userId, sessionId),
  )
  if (!sessionStr) return null

  const session = JSON.parse(sessionStr) as KVSession
  if (Date.now() >= session.expiresAt) {
    await env.KV_SESSION.delete(getSessionKey(parts.userId, sessionId))
    return null
  }

  if (session.userId !== parts.userId) return null

  return { sessionId, session }
}

function getBearerCredential(request: Request): {
  credential: SessionCredential
  parts: SessionTokenParts
} | null {
  const authorization = request.headers.get("Authorization")
  if (!authorization?.startsWith("Bearer ")) return null

  const value = authorization.slice("Bearer ".length).trim()
  const parts = decodeSessionToken(value)
  if (!parts) return null

  return {
    credential: { kind: "bearer", authorization: `Bearer ${value}` },
    parts,
  }
}

function getCookieCredential(request: Request): {
  credential: SessionCredential
  parts: SessionTokenParts
} | null {
  const cookie = request.headers.get("Cookie")
  const value = getCookieFromHeader(cookie, SESSION_COOKIE_NAME)
  if (!cookie || !value) return null

  const parts = decodeSessionToken(value)
  if (!parts) return null

  return {
    credential: { kind: "cookie", cookie },
    parts,
  }
}

export async function authenticateMcpRequest(
  request: Request,
  env: Env,
): Promise<AuthenticatedMcpSession | null> {
  const candidate = getBearerCredential(request) ?? getCookieCredential(request)
  if (!candidate) return null

  const validated = await validateSessionToken(env, candidate.parts)
  if (!validated) return null

  return {
    userId: candidate.parts.userId,
    sessionId: validated.sessionId,
    session: validated.session,
    credential: candidate.credential,
  }
}

export function unauthorizedResponse(): Response {
  return Response.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate":
          'Bearer error="invalid_token", error_description="Missing or invalid OAuth access token"',
      },
    },
  )
}
