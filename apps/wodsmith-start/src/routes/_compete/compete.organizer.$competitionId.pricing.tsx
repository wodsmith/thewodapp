import { createFileRoute, notFound } from "@tanstack/react-router"
import { getCompetitionFn } from "~/server-functions/competitions"
import { getCompetitionDivisionFeesFn } from "~/server-functions/commerce"
import { getSessionFromCookie } from "~/utils/auth.server"
import { getTeamFromDatabase } from "~/server/teams.server"
import { PricingSettingsForm } from "~/components/compete/organizer/pricing-settings-form"
import { StripeConnectionRequired } from "~/components/compete/organizer/stripe-connection-required"

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

		// Get organizing team Stripe status
		const organizingTeam = await getTeamFromDatabase(
			competition.organizingTeamId,
		)
		const isStripeConnected =
			organizingTeam?.stripeAccountStatus === "VERIFIED"

		// Get divisions - TODO: fetch from scaling group when available
		const divisions: Array<{
			id: string
			label: string
			teamSize: number
		}> = []

		// Get current fee configuration
		const feeConfigResult = await getCompetitionDivisionFeesFn({
			data: { competitionId: competition.id },
		})

		return {
			competition,
			isStripeConnected,
			teamSlug: organizingTeam?.slug || "",
			divisions,
			feeConfig: feeConfigResult.success ? feeConfigResult.data : null,
		}
	},
	component: PricingComponent,
})

function PricingComponent() {
	const { competition, isStripeConnected, teamSlug, divisions, feeConfig } =
		Route.useLoaderData()

	if (!isStripeConnected) {
		return (
			<div className="container mx-auto px-4 py-8">
				<h1 className="text-3xl font-bold mb-4">Pricing Settings</h1>
				<StripeConnectionRequired
					teamSlug={teamSlug}
					competitionName={competition.name}
				/>
			</div>
		)
	}

	if (!feeConfig) {
		return (
			<div className="container mx-auto px-4 py-8">
				<h1 className="text-3xl font-bold mb-4">Pricing Settings</h1>
				<p className="text-muted-foreground">Failed to load pricing configuration.</p>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-4">Pricing Settings</h1>
			<p className="text-muted-foreground mb-6">
				Configure registration fees for {competition.name}
			</p>

			<PricingSettingsForm
				competition={competition}
				divisions={divisions}
				currentFees={feeConfig}
			/>
		</div>
	)
}
