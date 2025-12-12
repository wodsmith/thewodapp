import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import { getLocationsByTeam, getSkillsByTeam } from "~/actions/gym-setup-actions.server"
import { getTeamAction } from "~/actions/team-actions.server"
import { PageHeader } from "~/components/page-header"
import GymSetup from "./_components/GymSetup"

const getGymSetupPageData = createServerFn(
	{ method: "GET" },
	async (teamId: string) => {
		const db = getDb()

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (!team) {
			throw new Error("Team not found")
		}

		const [[locationsRes], [skillsRes], [teamRes]] = await Promise.all([
			getLocationsByTeam({ teamId }),
			getSkillsByTeam({ teamId }),
			getTeamAction({ teamId }),
		])

		if (!locationsRes?.success || !skillsRes?.success || !teamRes?.success) {
			throw new Error("Failed to load gym setup data")
		}

		return {
			team,
			locations: locationsRes.data,
			skills: skillsRes.data,
			teamData: teamRes.data,
		}
	}
)

export const Route = createFileRoute("/_admin/admin/teams/$teamId/gym-setup")({
	loader: async ({ params }) => {
		return getGymSetupPageData(params.teamId)
	},
	component: GymSetupPage,
})

function GymSetupPage() {
	const { team, locations, skills, teamData } = Route.useLoaderData()

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${team.id}`, label: team.name },
					{
						href: `/admin/teams/${team.id}/gym-setup`,
						label: "Gym Setup",
					},
				]}
			/>
			<div className="container mx-auto px-5 pb-12">
				<GymSetup
					locations={locations}
					skills={skills}
					team={teamData}
					teamId={team.id}
				/>
			</div>
		</>
	)
}
