import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getCompetition, getCompetitionGroups } from "@/server/competitions"
import { listScalingGroups } from "@/server/scaling-groups"
import { requireTeamPermission } from "@/utils/team-auth"
import { CompetitionEditForm } from "./_components/competition-edit-form"

interface EditCompetitionPageProps {
	params: Promise<{
		teamId: string
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: EditCompetitionPageProps): Promise<Metadata> {
	const { teamId, competitionId } = await params
	const db = getDb()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	const competition = await getCompetition(competitionId)

	if (!team || !competition) {
		return {
			title: "Not Found",
		}
	}

	return {
		title: `${team.name} - Edit ${competition.name}`,
		description: `Edit ${competition.name} competition`,
	}
}

export default async function EditCompetitionPage({
	params,
}: EditCompetitionPageProps) {
	const { teamId, competitionId } = await params
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

	// Get competition
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Verify the competition belongs to this team
	if (competition.organizingTeamId !== team.id) {
		notFound()
	}

	// Get competition groups for series selection
	const groups = await getCompetitionGroups(team.id)

	// Get scaling groups for division selection
	const scalingGroups = await listScalingGroups({
		teamId: team.id,
		includeSystem: true,
	})

	return (
		<div className="flex flex-col gap-6">
			<div>
				<div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
					<Link
						href={`/admin/teams/${team.id}/competitions`}
						className="hover:text-foreground"
					>
						Competitions
					</Link>
					<span>/</span>
					<Link
						href={`/admin/teams/${team.id}/competitions/${competition.id}`}
						className="hover:text-foreground"
					>
						{competition.name}
					</Link>
					<span>/</span>
					<span>Edit</span>
				</div>
				<h1 className="text-3xl font-bold">Edit Competition</h1>
				<p className="text-muted-foreground mt-1">
					Update the details of this competition
				</p>
			</div>

			<div className="max-w-2xl">
				<CompetitionEditForm
					teamId={team.id}
					competition={competition}
					groups={groups}
					scalingGroups={scalingGroups}
				/>
			</div>
		</div>
	)
}
