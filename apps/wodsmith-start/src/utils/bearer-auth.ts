/**
 * Bearer token authentication utilities for the mobile Gameday API.
 *
 * Bearer tokens reuse the existing KV session infrastructure.
 * The Authorization header format is: `Bearer {userId}:{sessionToken}`
 * This matches the cookie format so the same KV validation logic applies.
 */

import type { SessionValidationResult } from "@/types"
import { getSessionFromCookie, validateSessionByToken } from "@/utils/auth"

/**
 * Parse and validate a bearer token from an Authorization header value.
 * Expected format: `Bearer {userId}:{sessionToken}`
 */
async function validateBearerAuthHeader(
  authHeader: string,
): Promise<SessionValidationResult | null> {
  if (!authHeader.startsWith("Bearer ")) return null

  const credential = authHeader.slice(7).trim()
  const colonIdx = credential.indexOf(":")
  if (colonIdx < 1) return null

  const userId = credential.slice(0, colonIdx)
  const token = credential.slice(colonIdx + 1)
  if (!userId || !token) return null

  return validateSessionByToken(token, userId)
}

/**
 * Get session from Authorization: Bearer header.
 * Returns null if header is absent, malformed, or token is invalid/expired.
 */
export async function getSessionFromBearer(
  request: Request,
): Promise<SessionValidationResult | null> {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader) return null
  return validateBearerAuthHeader(authHeader)
}

/**
 * Get session from bearer token first, falling back to cookie.
 * Use in API routes that need to support both web (cookie) and mobile (bearer) clients.
 */
export async function getSessionFromBearerOrCookie(
  request: Request,
): Promise<SessionValidationResult | null> {
  const bearerSession = await getSessionFromBearer(request)
  if (bearerSession) return bearerSession
  return getSessionFromCookie()
}

/**
 * Encode a session token into the Authorization header value.
 * Returns the full "Bearer {userId}:{token}" string.
 */
export function encodeBearerToken(userId: string, token: string): string {
  return `Bearer ${userId}:${token}`
}

/**
 * CORS headers for mobile API routes.
 * Allows Capacitor (capacitor://localhost) and local dev (http://localhost).
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = new Set([
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
  ])

  const allowOrigin =
    origin && allowedOrigins.has(origin) ? origin : "capacitor://localhost"

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  }
}
