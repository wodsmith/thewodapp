import "server-only"

import { LIMITS } from "@/config/limits"
import { logInfo } from "@/lib/logging/posthog-otel-logger"
import { getTeamLimit } from "@/server/entitlements"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"

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
