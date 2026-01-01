import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"
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

	return <LeaderboardPageContent competitionId={competition.id} />
}
