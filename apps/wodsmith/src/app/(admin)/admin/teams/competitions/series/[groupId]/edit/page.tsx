import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, competitionsTable } from "@/db/schema"
import { getCompetitionGroup } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { getAdminTeamContext } from "../../../../_utils/get-team-context"
import { CompetitionGroupEditForm } from "../../../../[teamId]/competitions/series/[groupId]/edit/_components/competition-group-edit-form"

interface EditSeriesPageProps {
	params: Promise<{
		groupId: string
	}>
}

export async function generateMetadata({
	params,
}: EditSeriesPageProps): Promise<Metadata> {
	const { team } = await getAdminTeamContext()
	const { groupId } = await params

	const group = await getCompetitionGroup(groupId)

	if (!group) {
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
	const { team } = await getAdminTeamContext()
	const { groupId } = await params
	const db = getDb()

	// Check if user has permission to manage competitions
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	// Get competition group
	const group = await getCompetitionGroup(groupId)

	if (!group) {
		notFound()
	}

	// Check if current team has any competition in this group
	const competitions = await db.query.competitionsTable.findMany({
		where: eq(competitionsTable.groupId, groupId),
		columns: { competitionTeamId: true },
	})

	// Verify the group belongs to this team (organizing team or has a competition with this team)
	const hasCompetitionInGroup = competitions.some(
		(c) => c.competitionTeamId === team.id
	)
	if (group.organizingTeamId !== team.id && !hasCompetitionInGroup) {
		notFound()
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
					<Link
						href="/admin/teams/competitions/series"
						className="hover:text-foreground"
					>
						Competition Series
					</Link>
					<span>/</span>
					<Link
						href={`/admin/teams/competitions/series/${group.id}`}
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
