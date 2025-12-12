import { createFileRoute, notFound } from "@tanstack/react-router"
import { getCompetitionFn } from "~/server-functions/competitions"
import { getCompetitionRevenueStatsFn } from "~/server-functions/commerce"
import { getSessionFromCookie } from "~/utils/auth.server"
import { getTeamById } from "~/server/teams"
import { RevenueStatsDisplay } from "~/components/compete/organizer/revenue-stats-display"

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

		// Get organizing team's Stripe connection status
		const organizingTeam = await getTeamById(
			competition.organizingTeamId,
		)
		const isStripeConnected =
			organizingTeam?.stripeAccountStatus === "VERIFIED"

		// Fetch revenue stats
		const statsResult = await getCompetitionRevenueStatsFn({
			data: { competitionId: competition.id },
		})

		return {
			competition,
			stats: statsResult,
			stripeStatus: {
				isConnected: isStripeConnected,
				teamSlug: organizingTeam?.slug || "",
			},
		}
	},
	component: RevenueComponent,
})

function RevenueComponent() {
	const { competition, stats, stripeStatus } = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-4">Revenue Dashboard</h1>
			<p className="text-muted-foreground mb-6">
				Revenue statistics for {competition.name}
			</p>

			<RevenueStatsDisplay stats={stats} stripeStatus={stripeStatus} />
		</div>
	)
}
