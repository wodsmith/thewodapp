import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getCompetitionGroup } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { CompetitionGroupEditForm } from "./_components/competition-group-edit-form"

interface EditSeriesPageProps {
	params: Promise<{
		teamId: string
		groupId: string
	}>
}

export async function generateMetadata({
	params,
}: EditSeriesPageProps): Promise<Metadata> {
	const { teamId, groupId } = await params
	const db = getDb()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	const group = await getCompetitionGroup(groupId)

	if (!team || !group) {
		return {
			title: "Not Found",
		}
	}

	return {
		title: `${team.name} - Edit ${group.name}`,
		description: `Edit ${group.name} competition series`,
	}
}

export default async function EditSeriesPage({ params }: EditSeriesPageProps) {
	const { teamId, groupId } = await params
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

	// Get competition group
	const group = await getCompetitionGroup(groupId)

	if (!group) {
		notFound()
	}

	// Verify the group belongs to this team
	if (group.organizingTeamId !== team.id) {
		notFound()
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
					<Link
						href={`/admin/teams/${team.id}/competitions/series`}
						className="hover:text-foreground"
					>
						Competition Series
					</Link>
					<span>/</span>
					<Link
						href={`/admin/teams/${team.id}/competitions/series/${group.id}`}
						className="hover:text-foreground"
					>
						{group.name}
					</Link>
					<span>/</span>
					<span>Edit</span>
				</div>
				<h1 className="text-3xl font-bold">Edit Competition Series</h1>
				<p className="text-muted-foreground mt-1">
					Update the details of this competition series
				</p>
			</div>

			<div className="max-w-2xl">
				<CompetitionGroupEditForm teamId={team.id} group={group} />
			</div>
		</div>
	)
}
