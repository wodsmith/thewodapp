"use server"
import { generateSchedule } from "@/server/ai/scheduler"
import { z } from "zod"
import { createServerAction } from "zsa"

const generateScheduleSchema = z.object({
	templateId: z.string(),
	weekStartDate: z.date(),
	teamId: z.string(),
})

export const generateScheduleAction = createServerAction()
	.input(generateScheduleSchema)
	.handler(async ({ input }) => {
		const result = await generateSchedule(input)
		return result
	})
