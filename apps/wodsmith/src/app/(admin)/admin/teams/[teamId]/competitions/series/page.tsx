import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getCompetitionGroups } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { CompetitionGroupsList } from "./_components/competition-groups-list"

interface CompetitionSeriesPageProps {
	params: Promise<{
		teamId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionSeriesPageProps): Promise<Metadata> {
	const { teamId } = await params
	const db = getDb()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		return {
			title: "Team Not Found",
		}
	}

	return {
		title: `${team.name} - Competition Series`,
		description: `Manage competition series for ${team.name}`,
	}
}

export default async function CompetitionSeriesPage({
	params,
}: CompetitionSeriesPageProps) {
	const { teamId } = await params
	const db = getDb()

	// Get team by ID
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		notFound()
	}

	// Check if user has permission to manage competitions
	try {
		await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
	} catch (error) {
		console.error(
			`ERROR: Unauthorized access attempt for competition management on teamId '${team.id}'`,
			error,
		)
		throw error
	}

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
				<Link href={`/admin/teams/${team.id}/competitions/series/new`}>
					<Button>Create Series</Button>
				</Link>
			</div>

			<CompetitionGroupsList groups={groups} teamId={team.id} />
		</div>
	)
}
