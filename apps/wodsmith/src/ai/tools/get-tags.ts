import { tool } from "ai"
import { z } from "zod"
import { getAvailableWorkoutTags } from "@/server/workouts"
import description from "./get-tags.md"

export const getTags = (teamId: string) =>
	tool({
		name: "getTags",
		description,
		inputSchema: z.object({}),
		execute: async () => {
			console.log("🤖 getTags called for teamId:", teamId)

			try {
				const tags = await getAvailableWorkoutTags(teamId)

				console.log("🤖 getTags returned:", {
					count: tags.length,
					tags: tags.slice(0, 10),
				})

				return tags
			} catch (error) {
				console.error("🤖 getTags error:", error)
				throw error
			}
		},
	})
