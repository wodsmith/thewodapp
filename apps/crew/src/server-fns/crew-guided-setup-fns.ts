// @lat: [[crew#Guided Setup State]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { crewGuidedSetupStepKeys } from "../lib/crew/guided-setup"

export type { CrewGuidedSetupPageData } from "../server/crew-guided-setup.server"

const guidedSetupStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "blocked",
  "complete",
])

const getCrewGuidedSetupPageInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

const updateCrewGuidedSetupStepInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  stepKey: z.enum(crewGuidedSetupStepKeys),
  status: guidedSetupStatusSchema.nullable(),
  note: z.string().max(2000).optional(),
})

export const getCrewGuidedSetupPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCrewGuidedSetupPageInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewGuidedSetupPage } = await import(
      "../server/crew-guided-setup.server"
    )
    return getCrewGuidedSetupPage(data)
  })

export const updateCrewGuidedSetupStepFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateCrewGuidedSetupStepInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { updateCrewGuidedSetupStep } = await import(
      "../server/crew-guided-setup.server"
    )
    return updateCrewGuidedSetupStep(data)
  })
