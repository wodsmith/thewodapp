/**
 * Bearer Token Refresh API
 *
 * POST /api/auth/token/refresh
 * Exchange a valid bearer token for a fresh one with extended expiry.
 *
 * Request: Authorization: Bearer {token}
 * Response: { token: string, expiresAt: number, userId: string }
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import {
  createSession,
  generateSessionToken,
} from "@/utils/auth"
import {
  corsHeaders,
  encodeBearerToken,
  getSessionFromBearer,
} from "@/utils/bearer-auth"

export const Route = createFileRoute("/api/auth/token/refresh")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("Origin")
        return new Response(null, {
          status: 204,
          headers: corsHeaders(origin),
        })
      },

      POST: async ({ request }) => {
        const origin = request.headers.get("Origin")
        const headers = {
          "Content-Type": "application/json",
          ...corsHeaders(origin),
        }

        const session = await getSessionFromBearer(request)
        if (!session?.userId) {
          return json({ error: "Unauthorized" }, { status: 401, headers })
        }

        const token = generateSessionToken()
        const newSession = await createSession({
          token,
          userId: session.userId,
          authenticationType: session.authenticationType,
        })

        return json(
          {
            token: encodeBearerToken(session.userId, token).slice("Bearer ".length),
            expiresAt: newSession.expiresAt,
            userId: session.userId,
          },
          { headers },
        )
      },
    },
  },
})
