// @lat: [[crew#Pilot Exports]]
// @lat: [[crew#Event Day Export Packet]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type { CrewPilotExportsPageData } from "../server/crew-pilot-exports.server"

const getCrewPilotExportsPageInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

export const getCrewPilotExportsPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCrewPilotExportsPageInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewPilotExportsPage } = await import(
      "../server/crew-pilot-exports.server"
    )
    return getCrewPilotExportsPage(data)
  })
