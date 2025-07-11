"use server"

import { z } from "zod"
import { createServerAction } from "zsa"
import { getTeamScheduledWorkouts } from "@/server/team-programming-tracks"
import { requireTeamMembership } from "@/utils/team-auth"

// Schema for getting scheduled workouts for a specific team
const getTeamScheduledWorkoutsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

export const getTeamScheduledWorkoutsAction = createServerAction()
	.input(getTeamScheduledWorkoutsSchema)
	.handler(async ({ input }) => {
		const { teamId } = input

		if (process.env.LOG_LEVEL === "info") {
			console.log(
				`INFO: [getTeamScheduledWorkoutsAction] Action started for team: ${teamId}`,
			)
		}

		// Verify user has access to this team
		await requireTeamMembership(teamId)

		try {
			// Fetch scheduled workouts for the specific team
			const scheduledWorkouts = await getTeamScheduledWorkouts(teamId)

			if (process.env.LOG_LEVEL === "info") {
				console.log(
					`INFO: [getTeamScheduledWorkoutsAction] Action executed successfully for team: ${teamId}, returned ${scheduledWorkouts.length} scheduled workouts`,
				)
			}

			return {
				scheduledWorkouts,
				success: true,
			}
		} catch (error) {
			if (process.env.LOG_LEVEL === "info") {
				console.log(
					`INFO: [getTeamScheduledWorkoutsAction] Error occurred for team: ${teamId}`,
					error,
				)
			}
			throw error
		}
	})
