import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getCompetitionGroups, getCompetitions } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { CompetitionsList } from "./_components/competitions-list"

interface CompetitionsPageProps {
	params: Promise<{
		teamId: string
	}>
	searchParams: Promise<{
		groupId?: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionsPageProps): Promise<Metadata> {
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
		title: `${team.name} - Competitions`,
		description: `Manage competitions for ${team.name}`,
	}
}

export default async function CompetitionsPage({
	params,
	searchParams,
}: CompetitionsPageProps) {
	const { teamId } = await params
	const { groupId } = await searchParams
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
					<Link href={`/admin/teams/${team.id}/competitions/series`}>
						<Button variant="outline">Manage Series</Button>
					</Link>
					<Link href={`/admin/teams/${team.id}/competitions/new`}>
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
