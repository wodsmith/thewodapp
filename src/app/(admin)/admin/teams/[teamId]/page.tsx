import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { getDd } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { requireTeamPermission } from "@/utils/team-auth"
import { CalendarSkeleton } from "./_components/calendar-skeleton"
import { TeamSchedulingContainer } from "./_components/team-scheduling-container"

interface TeamSchedulingPageProps {
	params: Promise<{
		teamId: string
	}>
}

export async function generateMetadata({
	params,
}: TeamSchedulingPageProps): Promise<Metadata> {
	const { teamId } = await params
	const db = getDd()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
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
	const { teamId } = await params
	const db = getDd()

	// Get team by ID
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
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
	} catch (_error) {
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
					{ href: `/admin/teams/${teamId}`, label: team.name },
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
					<Suspense fallback={<CalendarSkeleton />}>
						<TeamSchedulingContainer teamId={team.id} />
					</Suspense>
				</div>
			</div>
		</>
	)
}
