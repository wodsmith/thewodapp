import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import { getCoachesByTeam } from "~/actions/coach-actions.server"
import { getSkillsByTeam } from "~/actions/gym-setup-actions.server"
import { getTeamAction } from "~/actions/team-actions.server"
import { getTeamMembersAction } from "~/actions/team-membership-actions.server"
import { PageHeader } from "~/components/page-header"
import Coaches from "./_components/Coaches"

const getCoachesPageData = createServerFn(
	{ method: "GET" },
	async (teamId: string) => {
		const db = getDb()

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (!team) {
			throw new Error("Team not found")
		}

		const [[coachesResult], [teamMembersResult], [teamResult], [skillsResult]] =
			await Promise.all([
				getCoachesByTeam({ teamId }),
				getTeamMembersAction({ teamId }),
				getTeamAction({ teamId }),
				getSkillsByTeam({ teamId }),
			])

		if (
			!coachesResult?.success ||
			!teamMembersResult?.success ||
			!teamResult?.success ||
			!skillsResult?.success
		) {
			throw new Error("Failed to load coaches data")
		}

		return {
			team,
			coaches: coachesResult.data ?? [],
			teamMembers: teamMembersResult.data ?? [],
			teamData: teamResult.data,
			availableSkills: skillsResult.data ?? [],
		}
	}
)

export const Route = createFileRoute("/_admin/admin/teams/$teamId/coaches")({
	loader: async ({ params }) => {
		return getCoachesPageData(params.teamId)
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
