// @lat: [[crew#Day Of Operations Board]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type { CrewDayOfOperationsPageData } from "../server/crew-day-of.server"

const getCrewDayOfOperationsPageInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

export const getCrewDayOfOperationsPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCrewDayOfOperationsPageInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewDayOfOperationsPage } = await import(
      "../server/crew-day-of.server"
    )
    return getCrewDayOfOperationsPage(data)
  })
