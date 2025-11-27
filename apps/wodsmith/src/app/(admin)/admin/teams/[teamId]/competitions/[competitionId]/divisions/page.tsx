import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import { getCompetition } from "@/server/competitions"
import { listScalingGroups } from "@/server/scaling-groups"
import { requireTeamPermission } from "@/utils/team-auth"
import { DivisionManager } from "./_components/division-manager"

interface CompetitionDivisionsPageProps {
	params: Promise<{
		teamId: string
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionDivisionsPageProps): Promise<Metadata> {
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
		title: `${team.name} - ${competition.name} Divisions`,
		description: `Manage divisions for ${competition.name}`,
	}
}

export default async function CompetitionDivisionsPage({
	params,
}: CompetitionDivisionsPageProps) {
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
	if (competition.competitionTeamId !== team.id) {
		notFound()
	}

	// Get divisions with registration counts
	const { scalingGroupId, divisions } = await getCompetitionDivisionsWithCounts({
		competitionId,
	})

	// Get available scaling groups for templates
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
					<span>Divisions</span>
				</div>
				<h1 className="text-3xl font-bold">Competition Divisions</h1>
				<p className="text-muted-foreground mt-1">
					Manage the divisions for this competition
				</p>
			</div>

			{/* Navigation Tabs */}
			<div className="border-b">
				<nav className="flex gap-4">
					<Link
						href={`/admin/teams/${team.id}/competitions/${competition.id}`}
						className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
					>
						Overview
					</Link>
					<span className="px-4 py-2 border-b-2 border-primary font-medium">
						Divisions
					</span>
					<span className="px-4 py-2 border-b-2 border-transparent text-muted-foreground opacity-50 cursor-not-allowed">
						Athletes (Coming Soon)
					</span>
				</nav>
			</div>

			<DivisionManager
				key={scalingGroupId ?? "no-divisions"}
				teamId={team.id}
				competitionId={competition.id}
				divisions={divisions}
				scalingGroupId={scalingGroupId}
				scalingGroups={scalingGroups}
			/>
		</div>
	)
}
