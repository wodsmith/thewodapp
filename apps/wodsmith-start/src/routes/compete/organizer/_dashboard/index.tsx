import { createFileRoute, Link } from "@tanstack/react-router"
import { CreditCard, Plus } from "lucide-react"
import { OrganizerCompetitionsList } from "@/components/organizer-competitions-list"
import { TeamFilter } from "@/components/team-filter"
import { Button } from "@/components/ui/button"
import {
	getCompetitionGroupsFn,
	getOrganizerCompetitionsFn,
} from "@/server-fns/competition-fns"
import { getActiveTeamIdFn, getOrganizerTeamsFn } from "@/server-fns/team-fns"
import { setActiveTeamFn } from "@/server-fns/team-settings-fns"

export const Route = createFileRoute("/compete/organizer/_dashboard/")({
	component: OrganizerDashboard,
	loader: async () => {
		// Get teams that can organize competitions (non-personal, with HOST_COMPETITIONS)
		// This also deduplicates teams to prevent display issues
		const { teams: organizingTeams } = await getOrganizerTeamsFn()

		// Get active team from cookie (falls back to first team if no cookie)
		let activeTeamId = await getActiveTeamIdFn()

		// If no organizing teams, show empty state
		if (organizingTeams.length === 0) {
			return {
				competitions: [],
				groups: [],
				organizingTeams: [],
				activeTeamId: null,
			}
		}

		// Auto-switch: If active team is NOT in the organizing teams list,
		// switch to the first organizing team. This handles the case where
		// user's personal team is active but they're viewing the organizer dashboard.
		const isActiveTeamAnOrganizer = organizingTeams.some(
			(team) => team.id === activeTeamId,
		)

		if (!isActiveTeamAnOrganizer) {
			// Switch to the first organizing team
			const firstOrganizerTeam = organizingTeams[0]
			await setActiveTeamFn({ data: { teamId: firstOrganizerTeam.id } })
			activeTeamId = firstOrganizerTeam.id
		}

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
			organizingTeams,
			activeTeamId,
		}
	},
})

function OrganizerDashboard() {
	const { competitions, groups, organizingTeams, activeTeamId } =
		Route.useLoaderData()

	// Get the active team's slug for the payout settings link
	const activeTeam = organizingTeams.find((t) => t.id === activeTeamId)
	const activeTeamSlug = activeTeam?.slug

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
						{activeTeamSlug && (
							<Button variant="outline" className="w-full sm:w-auto" asChild>
								<Link to={`/compete/organizer/settings/payouts/${activeTeamSlug}`}>
									<CreditCard className="h-4 w-4 mr-2" />
									Payout Settings
								</Link>
							</Button>
						)}
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

				{/* Team Filter - always show so users know which team context they're in */}
				{organizingTeams.length > 0 && (
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
