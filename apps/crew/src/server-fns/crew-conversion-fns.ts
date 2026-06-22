// @lat: [[crew#Full WODsmith Conversion Assistant]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type { CrewConversionAssistantPageData } from "../server/crew-conversion.server"

const getCrewConversionAssistantPageInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

export const getCrewConversionAssistantPageFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getCrewConversionAssistantPageInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewConversionAssistantPage } = await import(
      "../server/crew-conversion.server"
    )
    return getCrewConversionAssistantPage(data)
  })
