import "server-only"
import { count, countDistinct, eq, or } from "drizzle-orm"
import { ZSAError } from "zsa"
import { getDB } from "@/db"
import { teamMembershipTable, workouts } from "@/db/schema"
import { requireVerifiedEmail } from "@/utils/auth"

export interface AdminStats {
	totalUsers: number
	activeTeams: number
	totalWorkouts: number
}

/**
 * Get admin dashboard statistics for the current user
 * - Total Users: All users who are members of teams that the current user has access to
 * - Active Teams: All teams that the current user has access to (is a member of)
 * - Total Workouts: All workouts available to the current user (public + their private ones)
 */
export async function getAdminStats(): Promise<AdminStats> {
	const session = await requireVerifiedEmail()
	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDB()
	const userId = session.userId

	// Get all teams that the current user is a member of
	const userTeamMemberships = await db
		.select({
			teamId: teamMembershipTable.teamId,
		})
		.from(teamMembershipTable)
		.where(eq(teamMembershipTable.userId, userId))

	const userTeamIds = userTeamMemberships.map((m) => m.teamId)

	// Count total users across all teams the current user has access to
	let totalUsers = 0
	if (userTeamIds.length > 0) {
		const userCountResult = await db
			.select({
				count: countDistinct(teamMembershipTable.userId),
			})
			.from(teamMembershipTable)
			.where(
				or(
					...userTeamIds.map((teamId) =>
						eq(teamMembershipTable.teamId, teamId),
					),
				),
			)

		totalUsers = userCountResult[0]?.count || 0
	}

	// Count active teams (teams the user is a member of)
	const activeTeams = userTeamIds.length

	// Count total workouts (all workouts regardless of ownership)
	const workoutCountResult = await db
		.select({
			count: count(),
		})
		.from(workouts)

	const totalWorkouts = workoutCountResult[0]?.count || 0

	return {
		totalUsers,
		activeTeams,
		totalWorkouts,
	}
}
