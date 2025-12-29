import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { LeaderboardPageContent } from "@/components/leaderboard-page-content"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/leaderboard")({
	component: CompetitionLeaderboardPage,
})

function CompetitionLeaderboardPage() {
	const { competition } = parentRoute.useLoaderData()

	return <LeaderboardPageContent competitionId={competition.id} />
}
