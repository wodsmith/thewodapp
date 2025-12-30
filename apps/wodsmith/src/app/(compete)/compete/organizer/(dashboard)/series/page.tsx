import "server-only"
import { Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { OrganizerBreadcrumb } from "@/app/(compete)/compete/organizer/_components/organizer-breadcrumb"
import { TeamFilter } from "@/app/(compete)/compete/organizer/_components/team-filter"
import { Button } from "@/components/ui/button"
import { getCompetitionGroups } from "@/server/competitions"
import { getActiveTeamFromCookie } from "@/utils/auth"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"
import { OrganizerSeriesList } from "./_components/organizer-series-list"

export const metadata: Metadata = {
	title: "Competition Series - Compete",
	description: "Manage your competition series",
}

interface SeriesPageProps {
	searchParams: Promise<{
		teamId?: string
	}>
}

export default async function SeriesPage({ searchParams }: SeriesPageProps) {
	const { teamId: selectedTeamId } = await searchParams
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
		const gymTeams = organizingTeams.filter((team) => team.type === "gym")
		const firstTeam = gymTeams[0]
		if (firstTeam) {
			activeTeamId = firstTeam.id
		} else {
			redirect("/compete/organizer")
		}
	}

	// Fetch series for the active team
	const groups = await getCompetitionGroups(activeTeamId)

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div>
					<OrganizerBreadcrumb segments={[{ label: "Series" }]} />
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<h1 className="text-3xl font-bold">Competition Series</h1>
							<p className="text-muted-foreground mt-1">
								Organize competitions into series for recurring events
							</p>
						</div>
						<Link href="/compete/organizer/series/new">
							<Button className="w-full sm:w-auto">
								<Plus className="h-4 w-4 mr-2" />
								Create Series
							</Button>
						</Link>
					</div>
				</div>

				{/* Team Filter (only show if multiple teams) */}
				{organizingTeams.length > 1 && (
					<TeamFilter teams={organizingTeams} selectedTeamId={activeTeamId} />
				)}

				{/* Series List */}
				<OrganizerSeriesList groups={groups} teamId={activeTeamId} />
			</div>
		</div>
	)
}
