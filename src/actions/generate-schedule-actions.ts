import { generateSchedule } from "@/server/ai/scheduler"
import { z } from "zod"
// import { authAction } from "@/lib/safe-action"

const generateScheduleSchema = z.object({
	templateId: z.string(),
	weekStartDate: z.date(),
	teamId: z.string(),
})

export const generateScheduleAction = async (
	input: z.infer<typeof generateScheduleSchema>,
) => {
	const result = await generateSchedule(input)
	return result
}
