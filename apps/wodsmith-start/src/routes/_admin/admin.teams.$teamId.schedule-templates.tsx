import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import { PageHeader } from "~/components/page-header"
import ScheduleTemplates from "./-components/ScheduleTemplates"

// TODO: Implement full data fetching - currently using placeholder data
// Need to create: schedule-template-actions.server, gym-setup-actions.server, team-actions.server

const getScheduleTemplatesPageData = createServerFn({ method: "GET" }).handler(
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
			templates: [],
			classCatalog: [],
			locations: [],
			availableSkills: [],
			teamSlug: team.slug ?? "",
		}
	}
)

export const Route = createFileRoute(
	"/_admin/admin/teams/$teamId/schedule-templates"
)({
	loader: async ({ params }) => {
		return getScheduleTemplatesPageData({ data: params.teamId })
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
