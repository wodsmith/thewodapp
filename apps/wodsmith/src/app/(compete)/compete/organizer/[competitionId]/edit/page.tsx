import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ZSAError } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetition, getCompetitionGroups } from "@/server/competitions"
import { listScalingGroups } from "@/server/scaling-groups"
import { requireTeamPermission } from "@/utils/team-auth"
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

	// Get competition
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Check if user has permission on the organizing team
	try {
		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
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

	// Fetch groups and scaling groups for the organizing team
	const [groups, scalingGroups] = await Promise.all([
		getCompetitionGroups(competition.organizingTeamId),
		listScalingGroups({ teamId: competition.organizingTeamId }),
	])

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<OrganizerBreadcrumb
						segments={[
							{ label: competition.name, href: `/compete/organizer/${competition.id}` },
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
				/>
			</div>
		</div>
	)
}
