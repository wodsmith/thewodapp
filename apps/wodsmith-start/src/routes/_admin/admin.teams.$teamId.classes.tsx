import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import { getClassCatalogByTeam, getSkillsByTeam } from "~/actions/gym-setup-actions.server"
import { getTeamAction } from "~/actions/team-actions.server"
import { PageHeader } from "~/components/page-header"
import Classes from "./_components/Classes"

const getClassesPageData = createServerFn(
	{ method: "GET" },
	async (teamId: string) => {
		const db = getDb()

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (!team) {
			throw new Error("Team not found")
		}

		const [[classesResult], [skillsResult], [teamResult]] = await Promise.all([
			getClassCatalogByTeam({ teamId }),
			getSkillsByTeam({ teamId }),
			getTeamAction({ teamId }),
		])

		if (
			!classesResult?.success ||
			!skillsResult?.success ||
			!teamResult?.success
		) {
			throw new Error("Failed to load classes data")
		}

		return {
			team,
			classes: classesResult.data ?? [],
			availableSkills: skillsResult.data ?? [],
			teamData: teamResult.data,
		}
	}
)

export const Route = createFileRoute("/_admin/admin/teams/$teamId/classes")({
	loader: async ({ params }) => {
		return getClassesPageData(params.teamId)
	},
	component: ClassesPage,
})

function ClassesPage() {
	const { team, classes, availableSkills, teamData } = Route.useLoaderData()

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${team.id}`, label: team.name },
					{
						href: `/admin/teams/${team.id}/classes`,
						label: "Classes",
					},
				]}
			/>
			<div className="container mx-auto px-5 pb-12">
				<Classes
					classes={classes}
					availableSkills={availableSkills}
					teamId={team.id}
					teamSlug={teamData?.slug ?? ""}
				/>
			</div>
		</>
	)
}
