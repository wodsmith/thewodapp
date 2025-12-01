import { tool } from "ai"
import { z } from "zod/v4"
import { getUserWorkouts } from "@/server/workouts"
import description from "./get-workouts.md"

export const getWorkouts = (teamId: string | string[]) =>
	tool({
		name: "getWorkouts",
		description,
		inputSchema: z.object({
			trackId: z.string().optional().describe("Filter by programming track ID"),
			search: z
				.string()
				.optional()
				.describe("Search term to filter by workout name or description"),
			tag: z.string().optional().describe("Filter by tag name"),
			movement: z.string().optional().describe("Filter by movement name"),
			type: z
				.enum(["all", "original", "remix"])
				.optional()
				.describe(
					"Filter by workout type: 'all' (default), 'original' (not remixed), or 'remix' (remixed from another workout)",
				),
			limit: z
				.number()
				.int()
				.positive()
				.optional()
				.default(50)
				.describe("Maximum number of workouts to return (default: 50)"),
			offset: z
				.number()
				.int()
				.nonnegative()
				.optional()
				.default(0)
				.describe("Number of workouts to skip for pagination (default: 0)"),
		}),
		execute: async ({
			trackId,
			search,
			tag,
			movement,
			type,
			limit,
			offset,
		}) => {
			console.log("🤖 getWorkouts called with:", {
				teamId,
				trackId,
				search,
				tag,
				movement,
				type,
				limit,
				offset,
			})

			try {
				const workouts = await getUserWorkouts({
					teamId,
					trackId,
					search,
					tag,
					movement,
					type,
					limit,
					offset,
				})

				console.log("🤖 getWorkouts returned:", {
					count: workouts.length,
					workoutNames: workouts.map((w) => w.name).slice(0, 5),
				})

				return workouts
			} catch (error) {
				console.error("🤖 getWorkouts error:", error)
				throw error // Re-throw the original error with its message
			}
		},
	})
