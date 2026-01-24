import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"
import { CompetitionTabs } from "@/components/competition-tabs"
import { LeaderboardPageContent } from "@/components/leaderboard-page-content"

const parentRoute = getRouteApi("/compete/$slug")

// Search params schema for division and event selection
const leaderboardSearchSchema = z.object({
	division: z.string().optional(),
	event: z.string().optional(),
})

export const Route = createFileRoute("/compete/$slug/leaderboard")({
	validateSearch: leaderboardSearchSchema,
	component: CompetitionLeaderboardPage,
})

function CompetitionLeaderboardPage() {
	const { competition } = parentRoute.useLoaderData()

	return (
		<div className="space-y-4">
			<div className="sticky top-4 z-10">
				<CompetitionTabs slug={competition.slug} />
			</div>
			<div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
				<LeaderboardPageContent competitionId={competition.id} />
			</div>
		</div>
	)
}
