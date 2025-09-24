import { notFound, redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { getDd } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamMembership, hasTeamPermission } from "@/utils/team-auth"
import { getScalingGroupsAction } from "@/actions/scaling-actions"
import { ScalingGroupsList } from "./_components/scaling-groups-list"

interface ScalingPageProps {
	params: Promise<{
		teamId: string
	}>
}

export async function generateMetadata({ params }: ScalingPageProps) {
	const { teamId } = await params
	const db = getDd()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		return {
			title: "Team Not Found",
		}
	}

	return {
		title: `${team.name} - Scaling Groups`,
		description: `Manage scaling groups for ${team.name}`,
	}
}

export default async function ScalingPage({ params }: ScalingPageProps) {
	const { teamId } = await params
	const db = getDd()

	// Find the team by id
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		notFound()
	}

	// Check if user is authenticated
	const session = await getSessionFromCookie()
	if (!session) {
		redirect(
			`/auth/login?returnTo=${encodeURIComponent(
				`/admin/teams/${teamId}/scaling`,
			)}`,
		)
	}

	// Check team membership
	const { hasAccess } = await hasTeamMembership(team.id)

	if (!hasAccess) {
		redirect(`/admin/teams/${teamId}`)
	}

	// Check if user has permission to manage scaling groups
	const canManageScaling = await hasTeamPermission(
		team.id,
		TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
	)

	if (!canManageScaling) {
		redirect(`/admin/teams/${teamId}`)
	}

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
