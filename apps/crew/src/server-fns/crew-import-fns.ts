// @lat: [[crew#Import CSV Preview#Preview Records]]
// @lat: [[crew#Remember Import Mappings]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type {
  CrewImportApplyResult,
  CrewImportHistoryItem,
  CrewImportMappingPresetSaveResult,
  CrewImportMappingSuggestionResult,
  CrewImportReferenceData,
  CrewImportsPageData,
  PersistedCrewImportPreview,
} from "../server/crew-imports.server"

const getCrewImportsPageInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

const applyCrewImportInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  importId: z.string().min(1, "Import ID is required"),
  confirmed: z.literal(true),
})

const crewImportKindSchema = z.enum(["volunteers", "heat_schedule"])

const getCrewImportMappingSuggestionInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  kind: crewImportKindSchema,
  sourcePlatform: z.string().trim().max(100).nullable().optional(),
  headers: z.array(z.string().trim()).min(1).max(200),
})

const saveCrewImportMappingPresetInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  kind: crewImportKindSchema,
  sourcePlatform: z.string().trim().max(100).nullable().optional(),
  headers: z.array(z.string().trim()).min(1).max(200),
  columnMapping: z.record(z.string(), z.string()),
})

export const getCrewImportsPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getCrewImportsPageInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { loadCrewImportsPageData } = await import(
      "../server/crew-imports.server"
    )
    return loadCrewImportsPageData(data.eventId)
  })

export const applyCrewImportFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applyCrewImportInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { applyCrewImportRecord } = await import(
      "../server/crew-imports.server"
    )
    return applyCrewImportRecord(data)
  })

export const getCrewImportMappingSuggestionFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    getCrewImportMappingSuggestionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewImportMappingSuggestion } = await import(
      "../server/crew-imports.server"
    )
    return getCrewImportMappingSuggestion(data)
  })

export const saveCrewImportMappingPresetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    saveCrewImportMappingPresetInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { saveCrewImportMappingPreset } = await import(
      "../server/crew-imports.server"
    )
    return saveCrewImportMappingPreset(data)
  })
