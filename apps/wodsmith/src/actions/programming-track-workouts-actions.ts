"use server"

import { createServerAction, ZSAError } from "@repo/zsa"
import { z } from "zod"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
	getPaginatedTrackWorkouts,
	type PaginatedTrackWorkoutsResult,
} from "@/server/programming"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"

// Schema for pagination parameters
const getPaginatedTrackWorkoutsSchema = z.object({
	trackId: z.string().min(1, "Track ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(50),
})

export const getPaginatedTrackWorkoutsAction = createServerAction()
	.input(getPaginatedTrackWorkoutsSchema)
	.handler(async ({ input }): Promise<PaginatedTrackWorkoutsResult> => {
		try {
			const session = await getSessionFromCookie()
			if (!session || !session.user) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user has access to the team dashboard
			await requireTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			console.info("INFO: Fetching paginated track workouts via action", {
				trackId: input.trackId,
				teamId: input.teamId,
				page: input.page,
				pageSize: input.pageSize,
			})

			// Validate page number
			if (input.page < 1) {
				throw new ZSAError(
					"INPUT_PARSE_ERROR",
					"Page number must be at least 1",
				)
			}

			// Validate page size
			if (input.pageSize < 1 || input.pageSize > 100) {
				throw new ZSAError(
					"INPUT_PARSE_ERROR",
					"Page size must be between 1 and 100",
				)
			}

			const result = await getPaginatedTrackWorkouts(
				input.trackId,
				input.teamId,
				input.page,
				input.pageSize,
			)

			return result
		} catch (error) {
			console.error("Failed to fetch paginated track workouts:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to fetch track workouts",
			)
		}
	})
