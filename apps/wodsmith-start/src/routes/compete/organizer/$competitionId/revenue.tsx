import { createFileRoute } from "@tanstack/react-router"
import {
	getCompetitionRevenueStatsFn,
	getOrganizerStripeStatusFn,
} from "@/server-fns/commerce-fns"
import { RevenueStatsDisplay } from "./-components/revenue-stats-display"

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/revenue",
)({
	staleTime: 10_000,
	loader: async ({ parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const { competition } = parentMatch.loaderData!

		// Parallel fetch: revenue stats and stripe status
		const [revenueResult, stripeResult] = await Promise.all([
			getCompetitionRevenueStatsFn({ data: { competitionId: competition.id } }),
			getOrganizerStripeStatusFn({
				data: { organizingTeamId: competition.organizingTeamId },
			}),
		])

		return {
			competition,
			stats: revenueResult.stats,
			stripeStatus: stripeResult.stripeStatus,
		}
	},
	component: RevenuePage,
	head: ({ loaderData }) => {
		const competition = loaderData?.competition
		if (!competition) {
			return {
				meta: [{ title: "Competition Not Found" }],
			}
		}
		return {
			meta: [
				{ title: `Revenue - ${competition.name}` },
				{
					name: "description",
					content: `Revenue statistics for ${competition.name}`,
				},
			],
		}
	},
})

function RevenuePage() {
	const { stats, stripeStatus } = Route.useLoaderData()

	return (
		<RevenueStatsDisplay
			stats={stats}
			stripeStatus={stripeStatus ?? undefined}
		/>
	)
}
