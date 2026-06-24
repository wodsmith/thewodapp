// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { CrewEventResult } from "../server/crew-event-settings.server"

export type {
  CrewEventDetails,
  CrewEventResult,
} from "../server/crew-event-settings.server"

const lifecycleSchema = z.enum([
  "draft",
  "setup",
  "importing",
  "ready",
  "archived",
])
const conciergeStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "ready",
  "blocked",
])
const crewPlanSchema = z.enum(["self_serve", "concierge", "full_platform"])
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
const nullableTextInput = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional()

const getCrewEventInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

const createCrewEventInputSchema = z.object({
  organizingTeamId: z.string().min(1, "Organizing team ID is required"),
  name: z.string().min(1, "Event name is required"),
  slug: z.string().min(1, "Slug is required"),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  description: nullableTextInput,
  timezone: z.string().min(1).default("America/Denver"),
  sourcePlatform: nullableTextInput,
  sourceEventUrl: nullableTextInput,
  externalRegistrationUrl: nullableTextInput,
  acquisitionSource: nullableTextInput,
  crewPlan: crewPlanSchema.default("self_serve"),
  settings: nullableTextInput,
})

const createCrewSettingsForCompetitionInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  sourcePlatform: nullableTextInput,
  sourceEventUrl: nullableTextInput,
  externalRegistrationUrl: nullableTextInput,
  acquisitionSource: nullableTextInput,
  crewPlan: crewPlanSchema.default("self_serve"),
  settings: nullableTextInput,
})

const updateCrewEventSettingsInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  crewOnly: z.boolean().optional(),
  sourcePlatform: nullableTextInput,
  sourceEventUrl: nullableTextInput,
  externalRegistrationUrl: nullableTextInput,
  lifecycle: lifecycleSchema.optional(),
  conciergeStatus: conciergeStatusSchema.optional(),
  crewPlan: crewPlanSchema.optional(),
  acquisitionSource: nullableTextInput,
  settings: nullableTextInput,
})

export const listCrewEventsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { listCrewEvents } = await import(
      "../server/crew-event-settings.server"
    )
    return listCrewEvents()
  },
)

export const getCrewEventFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getCrewEventInputSchema.parse(data))
  .handler(async ({ data }): Promise<CrewEventResult> => {
    const { getCrewEvent } = await import(
      "../server/crew-event-settings.server"
    )
    return getCrewEvent(data)
  })

export const createCrewSettingsForCompetitionFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    createCrewSettingsForCompetitionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { createCrewSettingsForCompetition } = await import(
      "../server/crew-event-settings.server"
    )
    return createCrewSettingsForCompetition(data)
  })

export const createCrewEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createCrewEventInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { createCrewEvent } = await import(
      "../server/crew-event-settings.server"
    )
    return createCrewEvent(data)
  })

export const updateCrewEventSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateCrewEventSettingsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { updateCrewEventSettings } = await import(
      "../server/crew-event-settings.server"
    )
    return updateCrewEventSettings(data)
  })
