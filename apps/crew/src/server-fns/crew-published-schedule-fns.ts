// @lat: [[crew#Published Volunteer Schedule]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

export type {
  CrewPublishedSchedule,
  CrewPublishedScheduleAssignment,
} from "../lib/crew/published-schedule"
export type { CrewPublishedScheduleManagerData } from "../server/crew-published-schedule.server"

const eventInput = z.object({ eventId: z.string().min(1).max(255) })
const slugInput = z.object({ slug: z.string().min(1).max(255) })

export const getCrewPublishedScheduleManagerFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) => eventInput.parse(data))
  .handler(async ({ data }) => {
    const { getCrewPublishedScheduleManager } = await import(
      "../server/crew-published-schedule.server"
    )
    return getCrewPublishedScheduleManager(data)
  })

export const publishCrewScheduleFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => eventInput.parse(data))
  .handler(async ({ data }) => {
    const { publishCrewSchedule } = await import(
      "../server/crew-published-schedule.server"
    )
    return publishCrewSchedule(data)
  })

export const unpublishCrewScheduleFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => eventInput.parse(data))
  .handler(async ({ data }) => {
    const { unpublishCrewSchedule } = await import(
      "../server/crew-published-schedule.server"
    )
    return unpublishCrewSchedule(data)
  })

export const getCrewPublicScheduleFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugInput.parse(data))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store")
    setResponseHeader("X-Robots-Tag", "noindex, nofollow")
    const { getCrewPublicSchedule } = await import(
      "../server/crew-published-schedule.server"
    )
    return getCrewPublicSchedule(data)
  })
