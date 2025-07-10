"use server"

import { z } from "zod"
import { createServerAction } from "zsa"
import { getTeamsWithScheduledWorkouts } from "@/server/team-programming-tracks"
import { requireVerifiedEmail } from "@/utils/auth"

// Schema for getting teams with scheduled workouts
const getTeamsWithScheduledWorkoutsSchema = z.object({
	// No additional parameters needed - uses session user ID
})

export const getTeamsWithScheduledWorkoutsAction = createServerAction()
	.input(getTeamsWithScheduledWorkoutsSchema)
	.handler(async () => {
		if (process.env.LOG_LEVEL === "info") {
			console.log("INFO: [getTeamsWithScheduledWorkoutsAction] Action started")
		}

		// Get authenticated user session
		const session = await requireVerifiedEmail()

		if (!session?.user?.id) {
			if (process.env.LOG_LEVEL === "info") {
				console.log(
					"INFO: [getTeamsWithScheduledWorkoutsAction] No authenticated user found",
				)
			}
			throw new Error("Authentication required")
		}

		try {
			// Fetch teams with scheduled workouts for the user
			const teams = await getTeamsWithScheduledWorkouts(session.user.id)

			if (process.env.LOG_LEVEL === "info") {
				console.log(
					`INFO: [getTeamsWithScheduledWorkoutsAction] Action executed successfully for user: ${session.user.id}, returned ${teams.length} teams`,
				)
			}

			return {
				teams,
				success: true,
			}
		} catch (error) {
			if (process.env.LOG_LEVEL === "info") {
				console.log(
					`INFO: [getTeamsWithScheduledWorkoutsAction] Error occurred for user: ${session.user.id}`,
					error,
				)
			}
			throw error
		}
	})
