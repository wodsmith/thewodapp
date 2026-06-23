// @lat: [[auth#Sessions]]
// @lat: [[crew#Server Function Runtime Boundary]]

import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { z } from "zod"
import { createAndStoreSession } from "@/utils/auth"

const e2eSessionSchema = z.object({
  userId: z.string().min(1),
})

const SESSION_BOOTSTRAP_LIMIT = 20
const SESSION_BOOTSTRAP_WINDOW_MS = 60_000

const sessionBootstrapAttempts = new Map<
  string,
  { count: number; resetAt: number }
>()

export const Route = createFileRoute("/api/e2e/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isE2EEnabled()) {
          return json({ error: "Not found" }, { status: 404 })
        }

        if (!allowSessionBootstrap(request)) {
          return json({ error: "Too many requests" }, { status: 429 })
        }

        const rawBody = await request.json().catch(() => null)
        const result = e2eSessionSchema.safeParse(rawBody)
        if (!result.success) {
          return json({ error: "Invalid E2E session payload" }, { status: 400 })
        }

        await createAndStoreSession(result.data.userId, "password")

        return json({ ok: true })
      },
    },
  },
})

function isE2EEnabled() {
  return (
    import.meta.env.VITE_E2E === "true" || getEnvValue("VITE_E2E") === "true"
  )
}

function getEnvValue(key: string) {
	return (env as unknown as Record<string, string | undefined>)[key]
}

function allowSessionBootstrap(request: Request) {
  const now = Date.now()
  const key = getRateLimitKey(request)
  const current = sessionBootstrapAttempts.get(key)

  if (!current || current.resetAt <= now) {
    sessionBootstrapAttempts.set(key, {
      count: 1,
      resetAt: now + SESSION_BOOTSTRAP_WINDOW_MS,
    })
    return true
  }

  if (current.count >= SESSION_BOOTSTRAP_LIMIT) {
    return false
  }

  current.count += 1
  return true
}

function getRateLimitKey(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  )
}
