"use server"

import { z } from "zod"
import { createServerAction } from "zsa"
import { getGeneratedSchedulesForTeam } from "@/server/ai/scheduler"

const getScheduledClassesForDisplaySchema = z.object({
	teamId: z.string(),
})

export const getScheduledClassesForDisplay = createServerAction()
	.input(getScheduledClassesForDisplaySchema)
	.handler(async ({ input }) => {
		const { teamId } = input

		console.log(
			"INFO: [getScheduledClassesForDisplay] Fetching schedules for team:",
			teamId,
		)

		const schedules = await getGeneratedSchedulesForTeam(teamId)

		console.log(
			"INFO: [getScheduledClassesForDisplay] Found schedules:",
			schedules.length,
		)

		return {
			schedules,
		}
	})
