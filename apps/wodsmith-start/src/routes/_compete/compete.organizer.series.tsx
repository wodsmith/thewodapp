import { createFileRoute, Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { Button } from "~/components/ui/button"
import { getSessionFromCookie } from "~/utils/auth.server"

export const Route = createFileRoute("/_compete/compete/organizer/series/")({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async () => {
		// TODO: Implement loader with:
		// - getUserOrganizingTeamsFn()
		// - getCompetitionGroupsFn() for fetching series
		// - getActiveTeamFromCookie() for team selection

		return {
			organizingTeams: [],
			activeTeamId: null,
			groups: [],
		}
	},
	component: SeriesComponent,
})

function SeriesComponent() {
	const _data = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				<div>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<h1 className="text-3xl font-bold">Competition Series</h1>
							<p className="text-muted-foreground mt-1">
								Organize competitions into series for recurring events
							</p>
						</div>
						<Link to="/compete/organizer/series/new">
							<Button className="w-full sm:w-auto">
								<Plus className="h-4 w-4 mr-2" />
								Create Series
							</Button>
						</Link>
					</div>
				</div>

				{/* TODO: Render TeamFilter if multiple teams exist */}
				{/* TODO: Render OrganizerSeriesList with groups data */}
			</div>
		</div>
	)
}
