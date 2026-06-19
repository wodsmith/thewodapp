import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type {
  CrewImportHistoryItem,
  CrewImportReferenceData,
  CrewImportsPageData,
  PersistedCrewImportPreview,
} from "../server/crew-imports"

const getCrewImportsPageInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

export const getCrewImportsPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getCrewImportsPageInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { loadCrewImportsPageData } = await import("../server/crew-imports")
    return await loadCrewImportsPageData(data.eventId)
  })
