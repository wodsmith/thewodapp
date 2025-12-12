import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import { PageHeader } from "~/components/page-header"
import GymSetup from "./-components/GymSetup"

// TODO: Implement full data fetching - currently using placeholder data
// Need to create: gym-setup-actions.server, team-actions.server

const getGymSetupPageData = createServerFn({ method: "GET" }).handler(
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
			locations: [],
			skills: [],
			teamData: team,
		}
	}
)

export const Route = createFileRoute("/_admin/admin/teams/$teamId/gym-setup")({
	loader: async ({ params }) => {
		return getGymSetupPageData({ data: params.teamId })
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
