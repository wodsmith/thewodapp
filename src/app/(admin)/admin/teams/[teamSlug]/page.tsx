import { PageHeader } from "@/components/page-header"
import { getDB } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { requireTeamPermission } from "@/utils/team-auth"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { TeamSchedulingContainer } from "./_components/team-scheduling-container"

interface TeamSchedulingPageProps {
	params: Promise<{
		teamSlug: string
	}>
}

export async function generateMetadata({
	params,
}: TeamSchedulingPageProps): Promise<Metadata> {
	const { teamSlug } = await params
	const db = getDB()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.slug, teamSlug),
	})

	if (!team) {
		return {
			title: "Team Not Found",
		}
	}

	return {
		title: `${team.name} - Scheduling`,
		description: `Manage workout scheduling for ${team.name}`,
	}
}

export default async function TeamSchedulingPage({
	params,
}: TeamSchedulingPageProps) {
	const { teamSlug } = await params
	const db = getDB()

	// Get team by slug
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.slug, teamSlug),
	})

	if (!team) {
		notFound()
	}

	// Check if user has permission to access team scheduling
	try {
		await requireTeamPermission(team.id, TEAM_PERMISSIONS.ACCESS_DASHBOARD)
		console.log(
			`INFO: [TeamAuth] User authorized for team scheduling on teamId '${team.id}'`,
		)
	} catch (error) {
		console.error(
			`ERROR: [TeamAuth] Unauthorized access attempt for team scheduling on teamId '${team.id}'`,
		)
		notFound()
	}

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${teamSlug}`, label: team.name },
				]}
			/>
			<div className="container mx-auto px-5 pb-12">
				<div className="flex justify-between items-start mb-8">
					<div>
						<h1 className="text-3xl font-bold mb-2">Team Scheduling</h1>
						<p className="text-muted-foreground">
							Manage workout schedules for {team.name}
						</p>
					</div>
				</div>

				<div className="bg-card rounded-lg border p-6">
					<TeamSchedulingContainer teamId={team.id} />
				</div>
			</div>
		</>
	)
}
