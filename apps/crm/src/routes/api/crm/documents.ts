import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { z } from "zod"
import { requireAuth } from "@/server-fns/auth"
import { documentUploadSchema, uploadDocumentForEntry } from "@/server-fns/crm"

export const Route = createFileRoute("/api/crm/documents")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAuth()

          let body: unknown
          try {
            body = await request.json()
          } catch {
            return json({ error: "Malformed JSON" }, { status: 400 })
          }

          const data = documentUploadSchema.parse(body)
          const document = await uploadDocumentForEntry(data)

          return json({ document }, { status: 201 })
        } catch (error) {
          if (error instanceof z.ZodError) {
            return json(
              { error: "Invalid request body", issues: error.issues },
              { status: 400 },
            )
          }

          const message =
            error instanceof Error ? error.message : "Document upload failed"
          return json(
            {
              error:
                message === "Unauthorized"
                  ? "Unauthorized"
                  : "Document upload failed",
            },
            { status: message === "Unauthorized" ? 401 : 500 },
          )
        }
      },
    },
  },
})
