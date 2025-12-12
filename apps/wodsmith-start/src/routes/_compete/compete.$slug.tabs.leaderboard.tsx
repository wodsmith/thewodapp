import { createFileRoute } from "@tanstack/react-router"
import { notFound } from "@tanstack/react-router"
import { LeaderboardPageContent } from "~/components/compete/leaderboard/leaderboard-page-content"
import { getCompetitionFn } from "~/server-functions/competitions"
import { getCompetitionDivisionsFn } from "~/server-functions/divisions"

export const Route = createFileRoute(
	"/_compete/compete/$slug/tabs/leaderboard",
)({
	loader: async ({ params }) => {
		const compResult = await getCompetitionFn({
			data: { idOrSlug: params.slug },
		})

		if (!compResult.success || !compResult.data) {
			throw notFound()
		}

		const competition = compResult.data
		const divResult = await getCompetitionDivisionsFn({
			data: { competitionId: competition.id },
		})

		return {
			competition,
			divisions: divResult.success ? divResult.data : [],
		}
	},
	component: LeaderboardPageComponent,
})

function LeaderboardPageComponent() {
	const { competition, divisions } = Route.useLoaderData()

	return (
		<LeaderboardPageContent
			competitionId={competition.id}
			divisions={divisions}
		/>
	)
}
