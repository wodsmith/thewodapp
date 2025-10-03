import { getSessionFromCookie } from "@/utils/auth"
import { redirect } from "next/navigation"
import { getScheduledWorkoutsForTeam } from "@/server/scheduling-service"
import { getWorkoutResultsForScheduledInstances } from "@/server/workout-results"
import {
	startOfLocalDay,
	endOfLocalDay,
	startOfLocalWeek,
	endOfLocalWeek,
} from "@/utils/date-utils"
import { TeamPageClient } from "./_components/team-page-client"

export default async function TeamsPage() {
	// Require authentication
	const session = await getSessionFromCookie()
	if (!session) {
		redirect("/sign-in")
	}

	// Get the user's current team (first team for now)
	const teams = session.teams || []
	if (teams.length === 0) {
		return (
			<div className="container mx-auto py-8">
				<h1 className="text-3xl font-bold mb-6">Team</h1>
				<p className="text-muted-foreground">
					You are not a member of any teams.
				</p>
			</div>
		)
	}

	// Prefer non-personal teams as initial team, fall back to first team if all are personal
	const nonPersonalTeams = teams.filter((t) => !t.isPersonalTeam)
	const initialTeam = nonPersonalTeams.length > 0 ? nonPersonalTeams[0] : teams[0]

	return (
		<TeamPageClient
			initialTeam={initialTeam}
			allTeams={teams}
			userId={session.userId}
		/>
	)
}
