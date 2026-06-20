// @lat: [[crew#Pilot Readiness Checklist]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type { CrewReadinessPageData } from "../server/crew-readiness.server"

const getCrewReadinessPageInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

export const getCrewReadinessPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCrewReadinessPageInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewReadinessPage } = await import(
      "../server/crew-readiness.server"
    )
    return getCrewReadinessPage(data)
  })
