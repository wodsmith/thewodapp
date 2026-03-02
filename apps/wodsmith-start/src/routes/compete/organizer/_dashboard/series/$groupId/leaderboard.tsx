import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { SeriesLeaderboardPageContent } from "@/components/series-leaderboard-page-content"

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
	return (
		<div className="container mx-auto px-4 py-8">
			<SeriesLeaderboardPageContent groupId={groupId} />
		</div>
	)
}
