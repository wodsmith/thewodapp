import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { z } from "zod"
import { SeriesLeaderboardPageContent } from "@/components/series-leaderboard-page-content"
import { usePostHog } from "@/lib/posthog"

const searchSchema = z.object({
	division: z.string().optional(),
})

export const Route = createFileRoute("/compete/series/$groupId/leaderboard")({
	validateSearch: searchSchema,
	component: SeriesLeaderboardPage,
})

function SeriesLeaderboardPage() {
	const { groupId } = Route.useParams()
	const { posthog } = usePostHog()
	const navigate = useNavigate()
	const [flagEnabled, setFlagEnabled] = useState(
		() => posthog.isFeatureEnabled("competition-global-leaderboard"),
	)

	useEffect(() => {
		const unsubscribe = posthog.onFeatureFlags(() => {
			setFlagEnabled(posthog.isFeatureEnabled("competition-global-leaderboard"))
		})
		return unsubscribe
	}, [posthog])

	useEffect(() => {
		if (flagEnabled === false) {
			navigate({ to: "/compete/series/$groupId", params: { groupId }, replace: true })
		}
	}, [flagEnabled, groupId, navigate])

	if (flagEnabled === false) return null

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="rounded-2xl border border-black/10 bg-black/5 p-4 sm:p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
				<SeriesLeaderboardPageContent groupId={groupId} />
			</div>
		</div>
	)
}
