import { createFileRoute, notFound } from "@tanstack/react-router"
import { getCompetitionFn } from "~/server-functions/competitions"
import { getCompetitionDivisionFeesFn } from "~/server-functions/commerce"
import { getSessionFromCookie } from "~/utils/auth.server"

export const Route = createFileRoute(
	"/_compete/compete/organizer/$competitionId/pricing",
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

		// TODO: Get organizing team Stripe status from DB
		// TODO: Get divisions from scaling group
		// Get current fee configuration
		const feeConfigResult = await getCompetitionDivisionFeesFn({
			data: { competitionId: competition.id },
		})

		return {
			competition,
			isStripeConnected: false, // TODO: Determine from team data
			divisions: [],
			feeConfig: feeConfigResult.success ? feeConfigResult.data : null,
		}
	},
	component: PricingComponent,
})

function PricingComponent() {
	const { competition, isStripeConnected } = Route.useLoaderData()

	if (!isStripeConnected) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-md mx-auto text-center">
					<h1 className="text-2xl font-bold mb-4">Stripe Connection Required</h1>
					<p className="text-muted-foreground mb-6">
						Connect your Stripe account to set pricing for {competition.name}
					</p>
					{/* TODO: Render connect button */}
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-4">Pricing Settings</h1>
			<p className="text-muted-foreground mb-6">
				Configure registration fees for {competition.name}
			</p>

			{/* TODO: Render PricingSettingsForm component */}
		</div>
	)
}
