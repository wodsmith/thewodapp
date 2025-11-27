import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionGroups } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { getAdminTeamContext } from "../../_utils/get-team-context"
import { CompetitionGroupsList } from "../../[teamId]/competitions/series/_components/competition-groups-list"

export async function generateMetadata(): Promise<Metadata> {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Competition Series`,
		description: `Manage competition series for ${team.name}`,
	}
}

export default async function CompetitionSeriesPage() {
	const { team } = await getAdminTeamContext()

	// Check if user has permission to manage competitions
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	// Get all competition groups for this team
	const groups = await getCompetitionGroups(team.id)

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Competition Series</h1>
					<p className="text-muted-foreground mt-1">
						Organize competitions into series or groups
					</p>
				</div>
				<Link href="/admin/teams/competitions/series/new">
					<Button>Create Series</Button>
				</Link>
			</div>

			<CompetitionGroupsList groups={groups} teamId={team.id} />
		</div>
	)
}
