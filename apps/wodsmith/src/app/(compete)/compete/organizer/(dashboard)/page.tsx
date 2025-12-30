import "server-only"
import { CreditCard, Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { OrganizerCompetitionsList } from "@/app/(compete)/compete/organizer/_components/organizer-competitions-list"
import { TeamFilter } from "@/app/(compete)/compete/organizer/_components/team-filter"
import { Button } from "@/components/ui/button"
import { getCompetitionGroups, getCompetitions } from "@/server/competitions"
import { getActiveTeamFromCookie } from "@/utils/auth"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"

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

	// If no active team selected but there are organizing teams, use the first one
	if (!activeTeamId && organizingTeams.length > 0) {
		activeTeamId = organizingTeams[0]?.id
	}

	if (!activeTeamId) {
		// No organizing teams at all - layout handles no access case
		return null
	}

	// Get the active team's slug for the payout settings link
	const activeTeam = organizingTeams.find((t) => t.id === activeTeamId)
	const activeTeamSlug = activeTeam?.slug

	// Fetch competitions for the active team
	const [allCompetitions, groups] = await Promise.all([
		getCompetitions(activeTeamId),
		getCompetitionGroups(activeTeamId),
	])

	// Sort by createdAt DESC (newest first)
	const sortedCompetitions = [...allCompetitions].sort(
		(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
	)

	// Filter by group if provided
	const competitions = groupId
		? sortedCompetitions.filter((c) => c.groupId === groupId)
		: sortedCompetitions

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
							<Link
								href={`/compete/organizer/settings/payouts/${activeTeamSlug}`}
							>
								<Button variant="outline" className="w-full sm:w-auto">
									<CreditCard className="h-4 w-4 mr-2" />
									Payout Settings
								</Button>
							</Link>
						)}
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
