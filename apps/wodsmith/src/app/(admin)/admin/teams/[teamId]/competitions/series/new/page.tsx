import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { requireTeamPermission } from "@/utils/team-auth"
import { CompetitionGroupForm } from "../_components/competition-group-form"

interface NewSeriesPageProps {
	params: Promise<{
		teamId: string
	}>
}

export async function generateMetadata({
	params,
}: NewSeriesPageProps): Promise<Metadata> {
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
		title: `${team.name} - Create Competition Series`,
		description: `Create a new competition series for ${team.name}`,
	}
}

export default async function NewSeriesPage({ params }: NewSeriesPageProps) {
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
