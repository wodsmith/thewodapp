// @lat: [[crew#Organizer Home Next Action]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type { CrewOrganizerHomeView } from "../server/crew-organizer-home.server"

const getCrewOrganizerHomeInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

export const getCrewOrganizerHomeFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCrewOrganizerHomeInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewOrganizerHome } = await import(
      "../server/crew-organizer-home.server"
    )
    return getCrewOrganizerHome(data)
  })
