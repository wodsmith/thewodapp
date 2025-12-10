import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getDb } from "@/db"
import { scalingGroupsTable, teamTable } from "@/db/schema"
import { getCompetition } from "@/server/competitions"
import { getCompetitionDivisionFees } from "@/actions/commerce.action"
import { parseCompetitionSettings } from "@/types/competitions"
import { PricingSettingsForm } from "./_components/pricing-settings-form"
import { StripeConnectionRequired } from "./_components/stripe-connection-required"

interface PricingPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: PricingPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `Pricing - ${competition.name}`,
		description: `Configure registration fees for ${competition.name}`,
	}
}

export default async function PricingPage({ params }: PricingPageProps) {
	const { competitionId } = await params
	const db = getDb()

	// Get competition (layout already validated access)
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Get organizing team's Stripe connection status
	const organizingTeam = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, competition.organizingTeamId),
		columns: {
			slug: true,
			stripeAccountStatus: true,
		},
	})

	if (!organizingTeam) {
		notFound()
	}

	const isStripeConnected = organizingTeam.stripeAccountStatus === "VERIFIED"

	// If Stripe not connected, show the connection prompt
	if (!isStripeConnected) {
		return (
			<StripeConnectionRequired
				teamSlug={organizingTeam.slug}
				competitionName={competition.name}
			/>
		)
	}

	// Get competition's divisions from scaling group
	const settings = parseCompetitionSettings(competition.settings)
	let divisions: Array<{ id: string; label: string; teamSize: number }> = []

	if (settings?.divisions?.scalingGroupId) {
		const scalingGroup = await db.query.scalingGroupsTable.findFirst({
			where: eq(scalingGroupsTable.id, settings.divisions.scalingGroupId),
			with: {
				scalingLevels: true,
			},
		})

		if (scalingGroup) {
			divisions = scalingGroup.scalingLevels.map((level) => ({
				id: level.id,
				label: level.label,
				teamSize: level.teamSize ?? 1,
			}))
		}
	}

	// Get current fee configuration
	const feeConfig = await getCompetitionDivisionFees(competition.id)

	return (
		<PricingSettingsForm
			competition={{
				id: competition.id,
				name: competition.name,
				defaultRegistrationFeeCents:
					competition.defaultRegistrationFeeCents ?? 0,
				platformFeePercentage: competition.platformFeePercentage ?? null,
				platformFeeFixed: competition.platformFeeFixed ?? null,
				passStripeFeesToCustomer: competition.passStripeFeesToCustomer ?? false,
				passPlatformFeesToCustomer:
					competition.passPlatformFeesToCustomer ?? true,
			}}
			divisions={divisions}
			currentFees={feeConfig}
		/>
	)
}
