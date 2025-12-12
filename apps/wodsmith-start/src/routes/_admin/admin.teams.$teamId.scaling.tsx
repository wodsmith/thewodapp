import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable, TEAM_PERMISSIONS } from "~/db/schema.server"
import { requireTeamPermission } from "~/utils/team-auth.server"
import { getScalingGroupsAction } from "~/actions/scaling-actions.server"
import { PageHeader } from "~/components/page-header"
import { ScalingGroupsList } from "./_components/scaling-groups-list"

const getScalingPageData = createServerFn(
	{ method: "GET" },
	async (teamId: string) => {
		const db = getDb()

		// Get team by ID
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (!team) {
			throw new Error("Team not found")
		}

		// Check if user has permission to manage scaling groups
		await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

		// Check specific permissions
		const canCreate = await requireTeamPermission(
			team.id,
			TEAM_PERMISSIONS.CREATE_COMPONENTS
		).then(
			() => true,
			() => false
		)
		const canEdit = await requireTeamPermission(
			team.id,
			TEAM_PERMISSIONS.EDIT_COMPONENTS
		).then(
			() => true,
			() => false
		)
		const canDelete = await requireTeamPermission(
			team.id,
			TEAM_PERMISSIONS.DELETE_COMPONENTS
		).then(
			() => true,
			() => false
		)
		const canEditTeamSettings = await requireTeamPermission(
			team.id,
			TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS
		).then(
			() => true,
			() => false
		)

		// Get the scaling groups
		const [result] = await getScalingGroupsAction({
			teamId: team.id,
			includeSystem: true,
		})

		const scalingGroups = result?.data || []

		return {
			team,
			scalingGroups,
			canCreate,
			canEdit,
			canDelete,
			canEditTeamSettings,
		}
	}
)

export const Route = createFileRoute("/_admin/admin/teams/$teamId/scaling")({
	loader: async ({ params }) => {
		return getScalingPageData(params.teamId)
	},
	component: ScalingPage,
})

function ScalingPage() {
	const {
		team,
		scalingGroups,
		canCreate,
		canEdit,
		canDelete,
		canEditTeamSettings,
	} = Route.useLoaderData()

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${team.id}`, label: team.name },
					{
						href: `/admin/teams/${team.id}/scaling`,
						label: "Scaling",
					},
				]}
			/>
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
		</>
	)
}
