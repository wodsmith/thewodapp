"use server"

import { createServerAction } from "zsa"
import { getTeamsWithScheduledWorkouts } from "@/server/team-programming-tracks"
import { requireVerifiedEmail } from "@/utils/auth"

export const getAllUserScheduledWorkoutsAction = createServerAction().handler(
	async () => {
		const session = await requireVerifiedEmail()

		if (!session?.user?.id) {
			throw new Error("User not authenticated")
		}

		if (process.env.LOG_LEVEL === "info") {
			console.log(
				`INFO: [getAllUserScheduledWorkoutsAction] Fetching scheduled workouts for user: ${session.user.id}`,
			)
		}

		try {
			// Fetch scheduled workouts for all teams the user belongs to
			const teamsWithWorkouts = await getTeamsWithScheduledWorkouts(
				session.user.id,
			)

			// Flatten all scheduled workouts and add team information
			const allScheduledWorkouts = teamsWithWorkouts.flatMap((team) =>
				team.scheduledWorkouts.map((workout) => ({
					...workout,
					teamId: team.id,
					teamName: team.name,
					teamSlug: team.slug,
				})),
			)

			if (process.env.LOG_LEVEL === "info") {
				console.log(
					`INFO: [getAllUserScheduledWorkoutsAction] Found ${allScheduledWorkouts.length} scheduled workouts across ${teamsWithWorkouts.length} teams`,
				)
			}

			return {
				scheduledWorkouts: allScheduledWorkouts,
				teams: teamsWithWorkouts.map((team) => ({
					id: team.id,
					name: team.name,
					slug: team.slug,
				})),
				success: true,
			}
		} catch (error) {
			if (process.env.LOG_LEVEL === "info") {
				console.log(
					`INFO: [getAllUserScheduledWorkoutsAction] Error occurred:`,
					error,
				)
			}
			throw error
		}
	},
)
