import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCompetitionGroups, getCompetitions } from "@/server/competitions"
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

	// Use selected team or first team as default
	const activeTeamId = selectedTeamId || organizingTeams[0]?.id

	if (!activeTeamId) {
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
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold">My Competitions</h1>
						<p className="text-muted-foreground mt-1">
							Create and manage your competitions
						</p>
					</div>
					<div className="flex gap-2">
						<Link href="/compete/organizer/series">
							<Button variant="outline">Manage Series</Button>
						</Link>
						<Link href="/compete/organizer/new">
							<Button>
								<Plus className="h-4 w-4 mr-2" />
								Create Competition
							</Button>
						</Link>
					</div>
				</div>

				{/* Team Filter (only show if multiple teams) */}
				{organizingTeams.length > 1 && (
					<TeamFilter
						teams={organizingTeams}
						selectedTeamId={activeTeamId}
					/>
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
