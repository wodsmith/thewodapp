// @lat: [[crew#Crew Admin Shell]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type {
  CrewAdminBillingData,
  CrewAdminConversionData,
  CrewAdminEventDetailView,
  CrewAdminEventListItem,
  CrewAdminReadinessData,
} from "../server/crew-admin-event.server"

const adminEventInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

export const getCrewAdminEventListFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const { getCrewAdminEventList } = await import(
    "../server/crew-admin-event.server"
  )
  return getCrewAdminEventList()
})

export const getCrewAdminEventDetailFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => adminEventInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewAdminEventDetail } = await import(
      "../server/crew-admin-event.server"
    )
    return getCrewAdminEventDetail(data)
  })

export const getCrewAdminReadinessFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => adminEventInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewAdminReadiness } = await import(
      "../server/crew-admin-event.server"
    )
    return getCrewAdminReadiness(data)
  })

export const getCrewAdminBillingFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => adminEventInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewAdminBilling } = await import(
      "../server/crew-admin-event.server"
    )
    return getCrewAdminBilling(data)
  })

export const getCrewAdminConversionFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => adminEventInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewAdminConversion } = await import(
      "../server/crew-admin-event.server"
    )
    return getCrewAdminConversion(data)
  })
