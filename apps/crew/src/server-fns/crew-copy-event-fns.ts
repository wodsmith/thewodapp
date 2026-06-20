// @lat: [[crew#Copy Prior Event Setup]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type {
  ApplyCrewCopyPriorEventResult,
  CrewCopyPriorEventPageData,
} from "../server/crew-copy-event.server"

const eventIdSchema = z.string().min(1, "Event ID is required")

const getCrewCopyPriorEventPageInputSchema = z.object({
  eventId: eventIdSchema,
  sourceEventId: eventIdSchema.nullable().optional(),
})

const applyCrewCopyPriorEventInputSchema = z.object({
  eventId: eventIdSchema,
  sourceEventId: eventIdSchema,
  mode: z.literal("empty_target_only"),
})

export const getCrewCopyPriorEventPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCrewCopyPriorEventPageInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewCopyPriorEventPage } = await import(
      "../server/crew-copy-event.server"
    )
    return getCrewCopyPriorEventPage(data)
  })

export const applyCrewCopyPriorEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    applyCrewCopyPriorEventInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { applyCrewCopyPriorEvent } = await import(
      "../server/crew-copy-event.server"
    )
    return applyCrewCopyPriorEvent(data)
  })
