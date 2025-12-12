import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import { getScheduleTemplatesByTeam } from "~/actions/schedule-template-actions.server"
import { getClassCatalogByTeam, getLocationsByTeam, getSkillsByTeam } from "~/actions/gym-setup-actions.server"
import { getTeamAction } from "~/actions/team-actions.server"
import { PageHeader } from "~/components/page-header"
import ScheduleTemplates from "./_components/ScheduleTemplates"

const getScheduleTemplatesPageData = createServerFn(
	{ method: "GET" },
	async (teamId: string) => {
		const db = getDb()

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (!team) {
			throw new Error("Team not found")
		}

		const [[templatesRes], [classesRes], [locationsRes], [skillsRes], [teamRes]] =
			await Promise.all([
				getScheduleTemplatesByTeam({ teamId }),
				getClassCatalogByTeam({ teamId }),
				getLocationsByTeam({ teamId }),
				getSkillsByTeam({ teamId }),
				getTeamAction({ teamId }),
			])

		if (
			!templatesRes ||
			!classesRes?.success ||
			!locationsRes?.success ||
			!skillsRes?.success ||
			!teamRes?.success
		) {
			throw new Error("Failed to load schedule templates data")
		}

		return {
			team,
			templates: templatesRes ?? [],
			classCatalog: classesRes.data ?? [],
			locations: locationsRes.data ?? [],
			availableSkills: skillsRes.data ?? [],
			teamSlug: teamRes.data?.slug ?? "",
		}
	}
)

export const Route = createFileRoute(
	"/_admin/admin/teams/$teamId/schedule-templates"
)({
	loader: async ({ params }) => {
		return getScheduleTemplatesPageData(params.teamId)
	},
	component: ScheduleTemplatesPage,
})

function ScheduleTemplatesPage() {
	const {
		team,
		templates,
		classCatalog,
		locations,
		availableSkills,
		teamSlug,
	} = Route.useLoaderData()

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${team.id}`, label: team.name },
					{
						href: `/admin/teams/${team.id}/schedule-templates`,
						label: "Schedule Templates",
					},
				]}
			/>
			<div className="container mx-auto px-5 pb-12">
				<ScheduleTemplates
					templates={templates}
					classCatalog={classCatalog}
					locations={locations}
					availableSkills={availableSkills}
					teamId={team.id}
					_teamSlug={teamSlug}
				/>
			</div>
		</>
	)
}
