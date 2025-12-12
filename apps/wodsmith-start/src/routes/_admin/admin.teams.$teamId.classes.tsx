import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import { PageHeader } from "~/components/page-header"
import Classes from "./-components/Classes"

// TODO: Implement full data fetching - currently using placeholder data
// Need to create: gym-setup-actions.server, team-actions.server

const getClassesPageData = createServerFn({ method: "GET" }).handler(
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
			classes: [],
			availableSkills: [],
			teamData: { slug: team.slug },
		}
	}
)

export const Route = createFileRoute("/_admin/admin/teams/$teamId/classes")({
	loader: async ({ params }) => {
		return getClassesPageData({ data: params.teamId })
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
