// @lat: [[crew#Import CSV Preview#Private Upload Route]]
import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import {
  createCrewImportPreviewRecord,
  MAX_CREW_IMPORT_BYTES,
} from "../../../server/crew-imports"
import type {
  ColumnMapping,
  CrewImportKind,
} from "../../../lib/crew/imports/types"

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
              { status: 400 },
            )
          }

          const importPreview = await createCrewImportPreviewRecord({
            eventId,
            kind,
            csvText: await file.text(),
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
          const message =
            error instanceof Error
              ? error.message
              : "Failed to preview Crew import."
          const status = message.includes("local-operator only") ? 403 : 400

          return json({ error: message }, { status })
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

  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined
  }

  const mapping: ColumnMapping = {}
  for (const [field, header] of Object.entries(parsed)) {
    if (typeof header === "string") mapping[field] = header
  }

  return mapping
}
