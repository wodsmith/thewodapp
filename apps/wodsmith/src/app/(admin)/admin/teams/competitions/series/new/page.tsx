import "server-only"
import type { Metadata } from "next"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { requireTeamPermission } from "@/utils/team-auth"
import { getAdminTeamContext } from "../../../_utils/get-team-context"
import { CompetitionGroupForm } from "../../../[teamId]/competitions/series/new/_components/competition-group-form"

export async function generateMetadata(): Promise<Metadata> {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Create Competition Series`,
		description: `Create a new competition series for ${team.name}`,
	}
}

export default async function NewSeriesPage() {
	const { team } = await getAdminTeamContext()

	// Check if user has permission to manage competitions
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-3xl font-bold">Create Competition Series</h1>
				<p className="text-muted-foreground mt-1">
					Organize multiple competitions into a series
				</p>
			</div>

			<div className="max-w-2xl">
				<CompetitionGroupForm teamId={team.id} />
			</div>
		</div>
	)
}
