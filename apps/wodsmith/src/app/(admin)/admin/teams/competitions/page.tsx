import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionGroups, getCompetitions } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { getAdminTeamContext } from "../_utils/get-team-context"
import { CompetitionsList } from "../[teamId]/competitions/_components/competitions-list"

interface CompetitionsPageProps {
	searchParams: Promise<{
		groupId?: string
	}>
}

export async function generateMetadata(): Promise<Metadata> {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Competitions`,
		description: `Manage competitions for ${team.name}`,
	}
}

export default async function CompetitionsPage({
	searchParams,
}: CompetitionsPageProps) {
	const { team } = await getAdminTeamContext()
	const { groupId } = await searchParams

	// Check if user has permission to manage competitions
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	// Get all competitions for this team
	const allCompetitions = await getCompetitions(team.id)

	// Filter by group if groupId is provided
	const competitions = groupId
		? allCompetitions.filter((comp) => comp.groupId === groupId)
		: allCompetitions

	// Get all competition groups for filtering
	const groups = await getCompetitionGroups(team.id)

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Competitions</h1>
					<p className="text-muted-foreground mt-1">
						Create and manage your competitions
					</p>
				</div>
				<div className="flex gap-2">
					<Link href="/admin/teams/competitions/series">
						<Button variant="outline">Manage Series</Button>
					</Link>
					<Link href="/admin/teams/competitions/new">
						<Button>Create Competition</Button>
					</Link>
				</div>
			</div>

			<CompetitionsList
				competitions={competitions}
				groups={groups}
				teamId={team.id}
				currentGroupId={groupId}
			/>
		</div>
	)
}
