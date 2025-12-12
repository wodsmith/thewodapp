import { createFileRoute } from "@tanstack/react-router"
import { getSessionFromCookie } from "~/utils/auth.server"

export const Route = createFileRoute("/_compete/compete/organizer/series/new")({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async () => {
		// TODO: Implement loader with:
		// - getUserOrganizingTeamsFn()
		// - getActiveTeamFromCookie() for team selection

		return {
			organizingTeams: [],
			activeTeamId: null,
		}
	},
	component: NewSeriesComponent,
})

function NewSeriesComponent() {
	const _data = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				<h1 className="text-3xl font-bold">Create Series</h1>
				<p className="text-muted-foreground mt-1">
					Organize related competitions into a series
				</p>

				{/* TODO: Render OrganizerSeriesForm component */}
			</div>
		</div>
	)
}
