import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getCompetitionGroups } from "@/server/competitions"
import { listScalingGroups } from "@/server/scaling-groups"
import { requireTeamPermission } from "@/utils/team-auth"
import { CompetitionForm } from "../_components/competition-form"

interface NewCompetitionPageProps {
	params: Promise<{
		teamId: string
	}>
	searchParams: Promise<{
		groupId?: string
	}>
}

export async function generateMetadata({
	params,
}: NewCompetitionPageProps): Promise<Metadata> {
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
		title: `${team.name} - Create Competition`,
		description: `Create a new competition for ${team.name}`,
	}
}

export default async function NewCompetitionPage({
	params,
	searchParams,
}: NewCompetitionPageProps) {
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
				<h1 className="text-3xl font-bold">Create Competition</h1>
				<p className="text-muted-foreground mt-1">
					Set up a new competition event
				</p>
			</div>

			<div className="max-w-2xl">
				<CompetitionForm
					teamId={team.id}
					groups={groups}
					scalingGroups={scalingGroups}
					defaultGroupId={groupId}
				/>
			</div>
		</div>
	)
}
