import "server-only"

import { LIMITS } from "@/config/limits"
import { logInfo } from "@/lib/logging/posthog-otel-logger"
import { getTeamLimit } from "@/server/entitlements"

/**
 * Check if a specific team has pending organizer status (limit of 0)
 * A team is pending when they've applied to organize but haven't been approved yet.
 * Pending teams can create draft competitions but cannot publish them.
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
