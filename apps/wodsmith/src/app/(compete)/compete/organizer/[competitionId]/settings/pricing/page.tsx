import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ZSAError } from "@repo/zsa"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDb } from "@/db"
import { competitionGroupsTable, TEAM_PERMISSIONS, scalingGroupsTable } from "@/db/schema"
import { getCompetition } from "@/server/competitions"
import { getCompetitionDivisionFees } from "@/actions/commerce.action"
import { requireTeamPermission } from "@/utils/team-auth"
import { OrganizerBreadcrumb } from "../../../_components/organizer-breadcrumb"
import { PricingSettingsForm } from "./_components/pricing-settings-form"
import { parseCompetitionSettings } from "@/types/competitions"

interface PricingSettingsPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: PricingSettingsPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `Pricing Settings - ${competition.name}`,
		description: `Configure registration fees for ${competition.name}`,
	}
}

export default async function PricingSettingsPage({
	params,
}: PricingSettingsPageProps) {
	const { competitionId } = await params
	const db = getDb()

	// Get competition
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Check if user has permission on the organizing team
	try {
		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)
	} catch (error) {
		if (
			error instanceof ZSAError &&
			(error.code === "NOT_AUTHORIZED" || error.code === "FORBIDDEN")
		) {
			notFound()
		}
		throw error
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

	// Get group for breadcrumb
	const group = competition.groupId
		? await db.query.competitionGroupsTable.findFirst({
				where: eq(competitionGroupsTable.id, competition.groupId),
			})
		: null

	// Build breadcrumb segments
	const breadcrumbSegments = group
		? [
				{ label: "Series", href: "/compete/organizer/series" },
				{ label: group.name, href: `/compete/organizer/series/${group.id}` },
				{
					label: competition.name,
					href: `/compete/organizer/${competition.id}`,
				},
				{ label: "Pricing Settings" },
			]
		: [
				{
					label: competition.name,
					href: `/compete/organizer/${competition.id}`,
				},
				{ label: "Pricing Settings" },
			]

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Breadcrumb and Header */}
				<div>
					<OrganizerBreadcrumb segments={breadcrumbSegments} />
					<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
						<div className="flex-1 min-w-0">
							<Link href={`/compete/organizer/${competition.id}`}>
								<Button variant="ghost" size="sm" className="mb-2 -ml-2">
									<ArrowLeft className="h-4 w-4 mr-2" />
									Back to Competition
								</Button>
							</Link>
							<h1 className="text-2xl font-bold">Pricing Settings</h1>
							<p className="text-muted-foreground mt-1">
								Configure registration fees for {competition.name}
							</p>
						</div>
					</div>
				</div>

				{/* Settings Form */}
				<PricingSettingsForm
					competition={{
						id: competition.id,
						name: competition.name,
						defaultRegistrationFeeCents:
							competition.defaultRegistrationFeeCents ?? 0,
						platformFeePercentage: competition.platformFeePercentage ?? null,
						platformFeeFixed: competition.platformFeeFixed ?? null,
						passStripeFeesToCustomer:
							competition.passStripeFeesToCustomer ?? false,
					}}
					divisions={divisions}
					currentFees={feeConfig}
				/>
			</div>
		</div>
	)
}
