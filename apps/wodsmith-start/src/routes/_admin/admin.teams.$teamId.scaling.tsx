import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import { PageHeader } from "~/components/page-header"
import { ScalingGroupsList } from "./-components/scaling-groups-list"

// TODO: Implement full data fetching with permissions
// Need to create: scaling-actions.server

const getScalingPageData = createServerFn({ method: "GET" }).handler(
	async ({ data: teamId }: { data: string }) => {
		const db = getDb()

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (!team) {
			throw new Error("Team not found")
		}

		// Placeholder data - permissions and scaling groups
		return {
			team,
			scalingGroups: [],
			canCreate: true,
			canEdit: true,
			canDelete: true,
			canEditTeamSettings: true,
		}
	}
)

export const Route = createFileRoute("/_admin/admin/teams/$teamId/scaling")({
	loader: async ({ params }) => {
		return getScalingPageData({ data: params.teamId })
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
