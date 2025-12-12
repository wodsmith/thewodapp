import { createFileRoute } from "@tanstack/react-router"
import { getSessionFromCookie } from "~/utils/auth.server"

export const Route = createFileRoute("/_compete/compete/organizer/new")({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async () => {
		// TODO: Implement loader with:
		// - getUserOrganizingTeamsFn()
		// - getCompetitionGroupsFn() for series
		// - getScalingGroupsFn() for divisions
		// - Team selection logic

		return {
			organizingTeams: [],
			groups: [],
			scalingGroups: [],
			activeTeamId: null,
		}
	},
	component: NewCompetitionComponent,
})

function NewCompetitionComponent() {
	// TODO: Import and render OrganizerCompetitionForm component
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				<h1 className="text-3xl font-bold">Create Competition</h1>
				<p className="text-muted-foreground mt-1">
					Set up a new competition for your athletes
				</p>
			</div>
		</div>
	)
}
