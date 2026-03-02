import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { z } from "zod"
import { SeriesLeaderboardPageContent } from "@/components/series-leaderboard-page-content"
import { usePostHog } from "@/lib/posthog"

const searchSchema = z.object({
	division: z.string().optional(),
})

export const Route = createFileRoute(
	"/compete/organizer/_dashboard/series/$groupId/leaderboard",
)({
	validateSearch: searchSchema,
	component: OrganizerSeriesLeaderboardPage,
})

function OrganizerSeriesLeaderboardPage() {
	const { groupId } = Route.useParams()
	const { posthog } = usePostHog()
	const navigate = useNavigate()
	const flagEnabled = posthog.isFeatureEnabled("competition-global-leaderboard")

	useEffect(() => {
		if (flagEnabled === false) {
			navigate({
				to: "/compete/organizer/_dashboard/series/$groupId/",
				params: { groupId },
			})
		}
	}, [flagEnabled, groupId, navigate])

	if (flagEnabled === false) return null

	return (
		<div className="container mx-auto px-4 py-8">
			<SeriesLeaderboardPageContent groupId={groupId} />
		</div>
	)
}
