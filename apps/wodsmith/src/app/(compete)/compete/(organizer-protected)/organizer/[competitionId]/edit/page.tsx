import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { LIMITS } from "@/config/limits"
import { getCompetition, getCompetitionGroups } from "@/server/competitions"
import { getTeamLimit } from "@/server/entitlements"
import { listScalingGroups } from "@/server/scaling-groups"
import { OrganizerBreadcrumb } from "../../_components/organizer-breadcrumb"
import { OrganizerCompetitionEditForm } from "./_components/organizer-competition-edit-form"

interface EditCompetitionPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: EditCompetitionPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `Edit ${competition.name} - Organizer`,
		description: `Edit competition details for ${competition.name}`,
	}
}

export default async function EditCompetitionPage({
	params,
}: EditCompetitionPageProps) {
	const { competitionId } = await params

	// Get competition (parent layout already validated access)
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Fetch groups, scaling groups, and check pending status for the organizing team
	const [groups, scalingGroups, publishLimit] = await Promise.all([
		getCompetitionGroups(competition.organizingTeamId),
		listScalingGroups({ teamId: competition.organizingTeamId }),
		getTeamLimit(
			competition.organizingTeamId,
			LIMITS.MAX_PUBLISHED_COMPETITIONS,
		),
	])

	// Team is pending approval if they have the feature but limit is 0
	const isPendingApproval = publishLimit === 0

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<OrganizerBreadcrumb
						segments={[
							{
								label: competition.name,
								href: `/compete/organizer/${competition.id}`,
							},
							{ label: "Edit" },
						]}
					/>
					<h1 className="text-3xl font-bold">Edit Competition</h1>
					<p className="text-muted-foreground mt-1">
						Update competition details
					</p>
				</div>

				{/* Form */}
				<OrganizerCompetitionEditForm
					competition={competition}
					groups={groups}
					scalingGroups={scalingGroups}
					isPendingApproval={isPendingApproval}
				/>
			</div>
		</div>
	)
}
