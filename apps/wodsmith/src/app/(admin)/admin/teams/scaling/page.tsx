import { getScalingGroupsAction } from "@/actions/scaling-actions"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { hasTeamPermission } from "@/utils/team-auth"
import { getAdminTeamContext } from "../_utils/get-team-context"
import { ScalingGroupsList } from "../[teamId]/scaling/_components/scaling-groups-list"

export async function generateMetadata() {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Scaling Groups`,
		description: `Manage scaling groups for ${team.name}`,
	}
}

export default async function ScalingPage() {
	const { team } = await getAdminTeamContext()

	// Check permissions
	const canEdit = await hasTeamPermission(
		team.id,
		TEAM_PERMISSIONS.EDIT_COMPONENTS,
	)
	const canCreate = await hasTeamPermission(
		team.id,
		TEAM_PERMISSIONS.CREATE_COMPONENTS,
	)
	const canDelete = await hasTeamPermission(
		team.id,
		TEAM_PERMISSIONS.DELETE_COMPONENTS,
	)
	const canEditTeamSettings = await hasTeamPermission(
		team.id,
		TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
	)

	// Get the scaling groups
	const [result] = await getScalingGroupsAction({
		teamId: team.id,
		includeSystem: true,
	})

	const scalingGroups = result?.data || []

	return (
		<div className="container mx-auto px-5 pb-12">
			<div className="mb-8">
				<h1 className="text-4xl font-bold mt-4">Scaling Groups</h1>
				<p className="text-muted-foreground mt-2">
					Manage custom scaling levels for your workouts. Create groups with
					different difficulty levels that can be applied to workouts and
					programming tracks. e.g. "Compete", "Rx", "Scaled"
				</p>
			</div>

			<ScalingGroupsList
				teamId={team.id}
				teamSlug={team.slug}
				scalingGroups={scalingGroups}
				defaultScalingGroupId={team.defaultScalingGroupId}
				canCreate={canCreate}
				canEdit={canEdit}
				canDelete={canDelete}
				canEditTeamSettings={canEditTeamSettings}
			/>
		</div>
	)
}
