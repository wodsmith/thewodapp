import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { z } from "zod"
import { requireAuth } from "@/server-fns/auth"
import { documentUploadSchema } from "@/server-fns/crm"

function getSchemaFieldType(schema: z.ZodTypeAny) {
  const inner =
    "unwrap" in schema && typeof schema.unwrap === "function"
      ? schema.unwrap()
      : schema

  if (inner instanceof z.ZodString) return "string"
  if (inner instanceof z.ZodNumber) return "number"
  if (inner instanceof z.ZodBoolean) return "boolean"
  if (inner instanceof z.ZodArray) return "array"
  if (inner instanceof z.ZodObject) return "object"
  return "unknown"
}

function getSchemaFields(schema: typeof documentUploadSchema) {
  return Object.fromEntries(
    Object.entries(schema.shape).map(([name, fieldSchema]) => [
      name,
      {
        type: getSchemaFieldType(fieldSchema),
        required: !fieldSchema.safeParse(undefined).success,
      },
    ]),
  )
}

export const Route = createFileRoute("/api/crm/agent-capabilities")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await requireAuth()

          return json({
            capabilities: [
              {
                name: "uploadCrmDocument",
                method: "POST",
                path: "/api/crm/documents",
                auth: "crm_session_cookie",
                contentType: "application/json",
                description:
                  "Attach a base64-encoded file to a CRM entry, such as an interaction transcript.",
                inputSchema: "documentUploadSchema",
                body: getSchemaFields(documentUploadSchema),
              },
            ],
          })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to load agent capabilities"
          return json(
            {
              error:
                message === "Unauthorized"
                  ? "Unauthorized"
                  : "Unable to load agent capabilities",
            },
            { status: message === "Unauthorized" ? 401 : 500 },
          )
        }
      },
    },
  },
})
