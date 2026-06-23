import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { z } from "zod"
import { createAndStoreSession } from "@/utils/auth"

const e2eSessionSchema = z.object({
  userId: z.string().min(1).default("e2e_test_user"),
})

export const Route = createFileRoute("/api/e2e/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isE2EEnabled()) {
          return json({ error: "Not found" }, { status: 404 })
        }

        const rawBody = await request.json().catch(() => ({}))
        const { userId } = e2eSessionSchema.parse(rawBody)

        await createAndStoreSession(userId, "password")

        return json({ ok: true })
      },
    },
  },
})

function isE2EEnabled() {
  return import.meta.env.VITE_E2E === "true" || process.env.VITE_E2E === "true"
}
