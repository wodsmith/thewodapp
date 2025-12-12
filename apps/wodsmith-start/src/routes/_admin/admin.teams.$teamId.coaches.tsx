import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import { PageHeader } from "~/components/page-header"
import Coaches from "./-components/Coaches"

// TODO: Implement full data fetching - currently using placeholder data
// Need to create: coach-actions.server, gym-setup-actions.server, team-actions.server, team-membership-actions.server

const getCoachesPageData = createServerFn({ method: "GET" }).handler(
	async ({ data: teamId }: { data: string }) => {
		const db = getDb()

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (!team) {
			throw new Error("Team not found")
		}

		// Placeholder data until actions are migrated
		return {
			team,
			coaches: [],
			teamMembers: [],
			teamData: { slug: team.slug },
			availableSkills: [],
		}
	}
)

export const Route = createFileRoute("/_admin/admin/teams/$teamId/coaches")({
	loader: async ({ params }) => {
		return getCoachesPageData({ data: params.teamId })
	},
	component: CoachesPage,
})

function CoachesPage() {
	const { team, coaches, teamMembers, teamData, availableSkills } =
		Route.useLoaderData()

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${team.id}`, label: team.name },
					{
						href: `/admin/teams/${team.id}/coaches`,
						label: "Coaches",
					},
				]}
			/>
			<div className="container mx-auto px-5 pb-12">
				<Coaches
					coaches={coaches}
					teamMembers={teamMembers}
					teamId={team.id}
					teamSlug={teamData?.slug ?? ""}
					availableSkills={availableSkills}
				/>
			</div>
		</>
	)
}
