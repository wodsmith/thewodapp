import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCompetitionGroups, getCompetitions } from "@/server/competitions"
import { getActiveTeamFromCookie } from "@/utils/auth"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"
import { OrganizerCompetitionsList } from "./_components/organizer-competitions-list"
import { TeamFilter } from "./_components/team-filter"

export const metadata: Metadata = {
	title: "My Competitions - Compete",
	description: "Manage your competitions",
}

interface OrganizerDashboardProps {
	searchParams: Promise<{
		teamId?: string
		groupId?: string
	}>
}

export default async function OrganizerDashboard({
	searchParams,
}: OrganizerDashboardProps) {
	const { teamId: selectedTeamId, groupId } = await searchParams
	const organizingTeams = await getUserOrganizingTeams()
	const activeTeamFromCookie = await getActiveTeamFromCookie()

	// Priority: URL param > active team cookie (if valid organizing team)
	let activeTeamId: string | undefined = selectedTeamId
	if (!activeTeamId && activeTeamFromCookie) {
		if (organizingTeams.some((t) => t.id === activeTeamFromCookie)) {
			activeTeamId = activeTeamFromCookie
		}
	}

	if (!activeTeamId) {
		// No valid organizing team - show message to switch teams
		const firstTeam = organizingTeams[0]
		if (firstTeam) {
			return (
				<div className="container mx-auto px-4 py-8">
					<div className="flex flex-col gap-6">
						<div>
							<h1 className="text-3xl font-bold">My Competitions</h1>
							<p className="text-muted-foreground mt-1">
								Your current team cannot organize competitions. Please select an
								organizing team:
							</p>
						</div>
						<TeamFilter teams={organizingTeams} selectedTeamId={firstTeam.id} />
					</div>
				</div>
			)
		}
		return null // Layout handles no access case
	}

	// Fetch competitions for the active team
	const [allCompetitions, groups] = await Promise.all([
		getCompetitions(activeTeamId),
		getCompetitionGroups(activeTeamId),
	])

	// Filter by group if provided
	const competitions = groupId
		? allCompetitions.filter((c) => c.groupId === groupId)
		: allCompetitions

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
						<Link href="/compete/organizer/series">
							<Button variant="outline" className="w-full sm:w-auto">
								Manage Series
							</Button>
						</Link>
						<Link href="/compete/organizer/new">
							<Button className="w-full sm:w-auto">
								<Plus className="h-4 w-4 mr-2" />
								Create Competition
							</Button>
						</Link>
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
					currentGroupId={groupId}
				/>
			</div>
		</div>
	)
}
