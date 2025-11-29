import "server-only"
import type { Metadata } from "next"
import { getCompetitionGroups } from "@/server/competitions"
import { listScalingGroups } from "@/server/scaling-groups"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"
import { OrganizerBreadcrumb } from "../_components/organizer-breadcrumb"
import { OrganizerCompetitionForm } from "./_components/organizer-competition-form"

export const metadata: Metadata = {
	title: "Create Competition - Compete",
	description: "Create a new competition",
}

interface NewCompetitionPageProps {
	searchParams: Promise<{
		teamId?: string
		groupId?: string
	}>
}

export default async function NewCompetitionPage({
	searchParams,
}: NewCompetitionPageProps) {
	const { teamId: selectedTeamId, groupId } = await searchParams
	const organizingTeams = await getUserOrganizingTeams()

	// Use selected team or first team as default
	const activeTeamId = selectedTeamId || organizingTeams[0]?.id

	if (!activeTeamId) {
		return null // Layout handles no access case
	}

	// Fetch groups and scaling groups for the active team
	const [groups, scalingGroups] = await Promise.all([
		getCompetitionGroups(activeTeamId),
		listScalingGroups({ teamId: activeTeamId }),
	])

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<OrganizerBreadcrumb segments={[{ label: "New Competition" }]} />
					<h1 className="text-3xl font-bold">Create Competition</h1>
					<p className="text-muted-foreground mt-1">
						Set up a new competition for your athletes
					</p>
				</div>

				{/* Form */}
				<OrganizerCompetitionForm
					teams={organizingTeams}
					selectedTeamId={activeTeamId}
					groups={groups}
					scalingGroups={scalingGroups}
					defaultGroupId={groupId}
				/>
			</div>
		</div>
	)
}
