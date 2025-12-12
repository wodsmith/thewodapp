import { createFileRoute } from "@tanstack/react-router"
import { OrganizerSeriesForm } from "~/components/compete/organizer/organizer-series-form"
import { getUserOrganizingTeamsFn } from "~/server-functions/competitions"
import { getSessionFromCookie } from "~/utils/auth.server"

export const Route = createFileRoute("/_compete/compete/organizer/series/new")({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async () => {
		const teamsResult = await getUserOrganizingTeamsFn()
		const teams = teamsResult.data || []
		const activeTeamId = teams[0]?.id || ""

		return {
			organizingTeams: teams,
			activeTeamId,
		}
	},
	component: NewSeriesComponent,
})

function NewSeriesComponent() {
	const { organizingTeams, activeTeamId } = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				<h1 className="text-3xl font-bold">Create Series</h1>
				<p className="text-muted-foreground mt-1">
					Organize related competitions into a series
				</p>

				<div className="mt-8">
					<OrganizerSeriesForm
						teams={organizingTeams}
						selectedTeamId={activeTeamId}
					/>
				</div>
			</div>
		</div>
	)
}
