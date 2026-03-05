import { createFileRoute, redirect } from "@tanstack/react-router"
import { TeamPageClient } from "@/components/team-page-client"

export const Route = createFileRoute("/_protected/team/")({
	component: TeamPage,
	beforeLoad: async ({ context }) => {
		if (!context.hasWorkoutTracking) {
			throw redirect({ to: "/compete" })
		}
	},
})

function TeamPage() {
	const { session } = Route.useRouteContext()

	// Get active team from session (first team)
	const activeTeam = session?.teams?.[0]
	const userId = session?.userId

	if (!activeTeam || !userId) {
		return (
			<div className="container mx-auto py-8">
				<h1 className="text-3xl font-bold mb-6">Team</h1>
				<p className="text-muted-foreground">
					Active team not found. Please switch to a valid team.
				</p>
			</div>
		)
	}

	return <TeamPageClient team={activeTeam} userId={userId} />
}
