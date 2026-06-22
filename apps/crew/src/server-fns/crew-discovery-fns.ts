// @lat: [[crew#Regional Judge Discovery Pilot]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type {
  CrewRegionalJudgeDiscoveryPageData,
  CrewRegionalJudgeIntroRequestResult,
} from "../server/crew-discovery.server"

const getCrewRegionalJudgeDiscoveryPageInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

const requestCrewRegionalJudgeIntroInputSchema =
  getCrewRegionalJudgeDiscoveryPageInputSchema.extend({
    candidateId: z.string().min(1, "Candidate ID is required"),
    requestedRoleType: z.enum(["judge", "head_judge"]).nullable().optional(),
  })

export const getCrewRegionalJudgeDiscoveryPageFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getCrewRegionalJudgeDiscoveryPageInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewRegionalJudgeDiscoveryPage } = await import(
      "../server/crew-discovery.server"
    )
    return getCrewRegionalJudgeDiscoveryPage(data)
  })

export const requestCrewRegionalJudgeIntroFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    requestCrewRegionalJudgeIntroInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { requestCrewRegionalJudgeIntro } = await import(
      "../server/crew-discovery.server"
    )
    return requestCrewRegionalJudgeIntro(data)
  })
