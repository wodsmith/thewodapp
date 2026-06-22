// @lat: [[crew#Series Crew Pools]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type { CrewSeriesCrewPoolPageData } from "../server/crew-series.server"

const groupIdSchema = z.string().startsWith("cgrp_", "Invalid group ID")

const selectedCompetitionIdsSchema = z
  .array(z.string().startsWith("comp_", "Invalid competition ID"))
  .max(50)
  .optional()

const crewSeriesCrewPoolInputSchema = z.object({
  groupId: groupIdSchema,
  selectedCompetitionIds: selectedCompetitionIdsSchema,
})

export const getCrewSeriesCrewPoolPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => crewSeriesCrewPoolInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewSeriesCrewPoolPage } = await import(
      "../server/crew-series.server"
    )
    return getCrewSeriesCrewPoolPage(data)
  })
