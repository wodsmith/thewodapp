import "server-only"

import { LIMITS } from "@/config/limits"
import { logInfo } from "@/lib/logging/posthog-otel-logger"
import { getTeamLimit } from "@/server/entitlements"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"

/**
 * Check if any of the user's organizing teams has pending status (limit of 0)
 * Used for showing the pending banner on organizer dashboard/list pages
 */
export async function getHasPendingOrganizingTeam(): Promise<boolean> {
	const organizingTeams = await getUserOrganizingTeams()

	if (organizingTeams.length === 0) return false

	const teamLimits = await Promise.all(
		organizingTeams.map(async (team) => ({
			teamId: team.id,
			limit: await getTeamLimit(team.id, LIMITS.MAX_PUBLISHED_COMPETITIONS),
		})),
	)

	const hasPendingTeam = teamLimits.some((t) => t.limit === 0)

	logInfo({
		message: "[organizer-pending] computed pending organizer state",
		attributes: {
			organizingTeamCount: organizingTeams.length,
			hasPendingTeam,
		},
	})

	return hasPendingTeam
}

/**
 * Check if a specific team has pending organizer status (limit of 0)
 * Used for showing the pending banner on competition-specific pages
 * where we know the organizing team from the competition data
 */
export async function isTeamPendingOrganizer(teamId: string): Promise<boolean> {
	const limit = await getTeamLimit(teamId, LIMITS.MAX_PUBLISHED_COMPETITIONS)

	logInfo({
		message: "[organizer-pending] checked team pending status",
		attributes: {
			teamId,
			limit,
			isPending: limit === 0,
		},
	})

	return limit === 0
}
