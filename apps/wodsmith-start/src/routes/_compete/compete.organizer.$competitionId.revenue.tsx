import { createFileRoute, notFound } from "@tanstack/react-router"
import { getCompetitionFn } from "~/server-functions/competitions"
import { getSessionFromCookie } from "~/utils/auth.server"

export const Route = createFileRoute(
	"/_compete/compete/organizer/$competitionId/revenue",
)({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async ({ params }) => {
		const competitionResult = await getCompetitionFn({
			data: { idOrSlug: params.competitionId },
		})

		if (!competitionResult.success || !competitionResult.data) {
			throw notFound()
		}

		const competition = competitionResult.data

		// TODO: Get organizing team's Stripe connection status
		// TODO: Fetch revenue stats from getCompetitionRevenueStatsFn

		return {
			competition,
			stats: null,
			stripeStatus: undefined,
		}
	},
	component: RevenueComponent,
})

function RevenueComponent() {
	const { competition } = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-4">Revenue Dashboard</h1>
			<p className="text-muted-foreground mb-6">
				Revenue statistics for {competition.name}
			</p>

			{/* TODO: Render RevenueStatsDisplay component */}
		</div>
	)
}
