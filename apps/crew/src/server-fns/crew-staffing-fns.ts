// @lat: [[crew#Staffing Page Gap Report]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type {
  CrewStaffingReportEvent,
  CrewStaffingReportPageData,
} from "./crew-staffing-fns.server"

const eventIdSchema = z.string().min(1, "Event ID is required")

export const getCrewStaffingReportPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ eventId: eventIdSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewStaffingReportPage } = await import(
      "./crew-staffing-fns.server"
    )
    return getCrewStaffingReportPage(data.eventId)
  })
