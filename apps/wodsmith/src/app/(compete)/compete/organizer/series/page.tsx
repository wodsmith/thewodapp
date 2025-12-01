import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCompetitionGroups } from "@/server/competitions"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"
import { OrganizerBreadcrumb } from "../_components/organizer-breadcrumb"
import { OrganizerSeriesList } from "./_components/organizer-series-list"
import { TeamFilter } from "../_components/team-filter"

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

	// Use selected team or first team as default
	const activeTeamId = selectedTeamId || organizingTeams[0]?.id

	if (!activeTeamId) {
		return null // Layout handles no access case
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
