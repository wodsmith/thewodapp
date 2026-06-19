// @lat: [[crew#Import CSV Preview#Preview Records]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
  applyCrewImportRecord,
  loadCrewImportsPageData,
} from "../server/crew-imports"

export type {
  CrewImportApplyResult,
  CrewImportHistoryItem,
  CrewImportReferenceData,
  CrewImportsPageData,
  PersistedCrewImportPreview,
} from "../server/crew-imports"

const getCrewImportsPageInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

const applyCrewImportInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  importId: z.string().min(1, "Import ID is required"),
  confirmed: z.literal(true),
})

export const getCrewImportsPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getCrewImportsPageInputSchema.parse(data))
  .handler(async ({ data }) => await loadCrewImportsPageData(data.eventId))

export const applyCrewImportFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applyCrewImportInputSchema.parse(data))
  .handler(async ({ data }) => await applyCrewImportRecord(data))
