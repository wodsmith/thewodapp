// @lat: [[crew#Import CSV Preview#Private Upload Route]]
import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { ZodError } from "zod"
import type {
  ColumnMapping,
  CrewImportKind,
} from "../../../lib/crew/imports/types"
import {
  CrewImportError,
  createCrewImportPreviewRecord,
  MAX_CREW_IMPORT_BYTES,
} from "../../../server/crew-imports.server"

export const Route = createFileRoute("/api/crew/import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const formData = await request.formData()
          const eventId = getTextFormValue(formData, "eventId")
          const kind = getTextFormValue(formData, "kind") as CrewImportKind
          const sourcePlatform = getTextFormValue(formData, "sourcePlatform")
          const file = formData.get("file")

          if (!eventId) {
            return json({ error: "Event ID is required." }, { status: 400 })
          }

          if (kind !== "volunteers" && kind !== "heat_schedule") {
            return json({ error: "Invalid import kind." }, { status: 400 })
          }

          if (!(file instanceof File)) {
            return json({ error: "CSV file is required." }, { status: 400 })
          }

          if (file.size > MAX_CREW_IMPORT_BYTES) {
            return json(
              { error: "CSV is larger than the Crew preview limit." },
              { status: 413 },
            )
          }

          const csvText = await file.text()
          const importPreview = await createCrewImportPreviewRecord({
            eventId,
            kind,
            csvText,
            originalFilename: file.name,
            mimeType: file.type || null,
            fileSize: file.size,
            sourcePlatform: sourcePlatform || null,
            columnMapping: parseColumnMapping(
              getTextFormValue(formData, "columnMapping"),
            ),
          })

          return json({ importPreview })
        } catch (error) {
          const response = getImportErrorResponse(error)
          return json({ error: response.message }, { status: response.status })
        }
      },
    },
  },
})

function getTextFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function parseColumnMapping(value: string): ColumnMapping | undefined {
  if (!value) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(value) as unknown
  } catch {
    throw new CrewImportError(
      "INVALID_COLUMN_MAPPING",
      "Column mapping must be valid JSON.",
    )
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CrewImportError(
      "INVALID_COLUMN_MAPPING",
      "Column mapping must be a JSON object.",
    )
  }

  const mapping: ColumnMapping = {}
  for (const [field, header] of Object.entries(parsed)) {
    if (typeof header === "string") mapping[field] = header
  }

  return mapping
}

function getImportErrorResponse(error: unknown) {
  if (error instanceof Error) {
    if (error.message.startsWith("NOT_AUTHORIZED:")) {
      return { status: 401, message: error.message }
    }
    if (error.message.startsWith("FORBIDDEN:")) {
      return { status: 403, message: error.message }
    }
  }

  if (error instanceof CrewImportError) {
    return { status: error.status, message: error.publicMessage }
  }

  if (error instanceof ZodError) {
    return { status: 400, message: "Import request is invalid." }
  }

  console.error("Unexpected Crew import preview failure:", error)
  return { status: 500, message: "Failed to preview Crew import." }
}
