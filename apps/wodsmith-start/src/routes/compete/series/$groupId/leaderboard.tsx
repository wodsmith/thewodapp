import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { SeriesLeaderboardPageContent } from "@/components/series-leaderboard-page-content"

const searchSchema = z.object({
	division: z.string().optional(),
})

export const Route = createFileRoute("/compete/series/$groupId/leaderboard")({
	validateSearch: searchSchema,
	component: SeriesLeaderboardPage,
})

function SeriesLeaderboardPage() {
	const { groupId } = Route.useParams()
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="rounded-2xl border border-black/10 bg-black/5 p-4 sm:p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
				<SeriesLeaderboardPageContent groupId={groupId} />
			</div>
		</div>
	)
}
