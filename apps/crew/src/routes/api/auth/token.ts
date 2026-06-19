/**
 * Bearer Token Exchange API
 *
 * POST /api/auth/token
 * Exchange email + password for a bearer token for the mobile Gameday API.
 *
 * Request body: { email: string, password: string }
 * Response: { token: string, expiresAt: number, userId: string }
 * The token value is "{userId}:{sessionToken}" — send as "Authorization: Bearer {token}"
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { userTable } from "@/db/schema"
import {
  createSession,
  generateSessionToken,
} from "@/utils/auth"
import { corsHeaders, encodeBearerToken } from "@/utils/bearer-auth"
import { verifyPassword } from "@/utils/password-hasher"

const tokenRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const Route = createFileRoute("/api/auth/token")({
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

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ error: "Invalid JSON body" }, { status: 400, headers })
        }

        const parsed = tokenRequestSchema.safeParse(body)
        if (!parsed.success) {
          return json(
            { error: "Invalid request", details: parsed.error.flatten() },
            { status: 400, headers },
          )
        }

        const { email, password } = parsed.data
        const db = getDb()

        const user = await db.query.userTable.findFirst({
          where: eq(userTable.email, email.toLowerCase()),
        })

        if (!user || !user.passwordHash) {
          return json({ error: "Invalid email or password" }, { status: 401, headers })
        }

        if (!user.emailVerified) {
          return json({ error: "Invalid email or password" }, { status: 401, headers })
        }

        const isValid = await verifyPassword({
          storedHash: user.passwordHash,
          passwordAttempt: password,
        })

        if (!isValid) {
          return json({ error: "Invalid email or password" }, { status: 401, headers })
        }

        const token = generateSessionToken()
        const session = await createSession({
          token,
          userId: user.id,
          authenticationType: "password",
        })

        return json(
          {
            token: encodeBearerToken(user.id, token).slice("Bearer ".length),
            expiresAt: session.expiresAt,
            userId: user.id,
          },
          { headers },
        )
      },
    },
  },
})
