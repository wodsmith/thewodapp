// @lat: [[crew#Role And Shift Templates]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type {
  ApplyCrewTemplateResult,
  CrewTemplatePageData,
  SaveCrewTemplatePresetResult,
} from "../server/crew-template.server"

const eventIdSchema = z.string().min(1, "Event ID is required")

const templateRefSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("built_in"),
    templateId: z.string().min(1, "Template ID is required"),
  }),
  z.object({
    source: z.literal("team_preset"),
    presetId: z.string().startsWith("ctpres_", "Invalid preset ID"),
  }),
])

const getCrewTemplatePageInputSchema = z.object({
  eventId: eventIdSchema,
})

const applyCrewTemplateInputSchema = z.object({
  eventId: eventIdSchema,
  templateRef: templateRefSchema,
  mode: z.literal("append_missing"),
  fillEmptyAssumptions: z.boolean().default(true),
})

const saveCrewTemplatePresetInputSchema = z.object({
  eventId: eventIdSchema,
  templateRef: templateRefSchema,
  name: z.string().trim().min(1, "Preset name is required").max(255),
  description: z.string().trim().max(2000).nullable().optional(),
})

export const getCrewTemplatePageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getCrewTemplatePageInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewTemplatePage } = await import(
      "../server/crew-template.server"
    )
    return getCrewTemplatePage(data)
  })

export const applyCrewTemplateFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applyCrewTemplateInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { applyCrewTemplate } = await import("../server/crew-template.server")
    return applyCrewTemplate(data)
  })

export const saveCrewTemplatePresetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    saveCrewTemplatePresetInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { saveCrewTemplatePreset } = await import(
      "../server/crew-template.server"
    )
    return saveCrewTemplatePreset(data)
  })
