import "server-only"
import type { Metadata } from "next"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionGroups } from "@/server/competitions"
import { listScalingGroups } from "@/server/scaling-groups"
import { requireTeamPermission } from "@/utils/team-auth"
import { getAdminTeamContext } from "../../_utils/get-team-context"
import { CompetitionForm } from "../../[teamId]/competitions/_components/competition-form"

interface NewCompetitionPageProps {
	searchParams: Promise<{
		groupId?: string
	}>
}

export async function generateMetadata(): Promise<Metadata> {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Create Competition`,
		description: `Create a new competition for ${team.name}`,
	}
}

export default async function NewCompetitionPage({
	searchParams,
}: NewCompetitionPageProps) {
	const { team } = await getAdminTeamContext()
	const { groupId } = await searchParams

	// Check if user has permission to manage competitions
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	// Get competition groups for series selection
	const groups = await getCompetitionGroups(team.id)

	// Get scaling groups for division selection
	const scalingGroups = await listScalingGroups({
		teamId: team.id,
		includeSystem: true,
	})

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-3xl font-bold">Create Competition</h1>
				<p className="text-muted-foreground mt-1">
					Set up a new competition event
				</p>
			</div>

			<div className="max-w-2xl">
				<CompetitionForm
					teamId={team.id}
					groups={groups}
					scalingGroups={scalingGroups}
					defaultGroupId={groupId}
				/>
			</div>
		</div>
	)
}
