import { createFileRoute, Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { OrganizerCompetitionsList } from "@/components/organizer-competitions-list"
import { TeamFilter } from "@/components/team-filter"
import { Button } from "@/components/ui/button"
import {
	getCompetitionGroupsFn,
	getOrganizerCompetitionsFn,
} from "@/server-fns/competition-fns"
import { getActiveTeamIdFn } from "@/server-fns/team-fns"

export const Route = createFileRoute("/compete/organizer/")({
	component: OrganizerDashboard,
	loader: async ({ context }) => {
		const session = context.session

		// Get all user teams
		const userTeams = session?.teams || []

		// Get active team from cookie (falls back to first team if no cookie)
		const activeTeamId = await getActiveTeamIdFn()

		if (!activeTeamId) {
			return {
				competitions: [],
				groups: [],
				organizingTeams: [],
				activeTeamId: null,
			}
		}

		// Fetch competitions and groups for the active team
		const [competitionsResult, groupsResult] = await Promise.all([
			getOrganizerCompetitionsFn({ data: { teamId: activeTeamId } }),
			getCompetitionGroupsFn({ data: { teamId: activeTeamId } }),
		])

		// Sort by createdAt DESC (newest first)
		const sortedCompetitions = [...competitionsResult.competitions].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)

		return {
			competitions: sortedCompetitions,
			groups: groupsResult.groups,
			organizingTeams: userTeams,
			activeTeamId,
		}
	},
})

function OrganizerDashboard() {
	const { competitions, groups, organizingTeams, activeTeamId } =
		Route.useLoaderData()

	if (!activeTeamId) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<h1 className="text-2xl font-bold mb-4">No Team Found</h1>
					<p className="text-muted-foreground mb-6">
						You need to be part of a team to organize competitions.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div>
						<h1 className="text-3xl font-bold">My Competitions</h1>
						<p className="text-muted-foreground mt-1">
							Create and manage your competitions
						</p>
					</div>
					<div className="flex flex-col sm:flex-row gap-2">
						<Button variant="outline" className="w-full sm:w-auto" asChild>
							<Link to="/compete/organizer/series">Manage Series</Link>
						</Button>
						<Button className="w-full sm:w-auto" asChild>
							<Link to="/compete/organizer/new">
								<Plus className="h-4 w-4 mr-2" />
								Create Competition
							</Link>
						</Button>
					</div>
				</div>

				{/* Team Filter (only show if multiple teams) */}
				{organizingTeams.length > 1 && (
					<TeamFilter teams={organizingTeams} selectedTeamId={activeTeamId} />
				)}

				{/* Competitions List */}
				<OrganizerCompetitionsList
					competitions={competitions}
					groups={groups}
					teamId={activeTeamId}
					currentGroupId={undefined}
				/>
			</div>
		</div>
	)
}
