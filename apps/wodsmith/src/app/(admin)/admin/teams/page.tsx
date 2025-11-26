import type { Metadata } from "next"
import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { requireTeamPermission } from "@/utils/team-auth"
import { getAdminTeamContext } from "./_utils/get-team-context"
import { CalendarSkeleton } from "./[teamId]/_components/calendar-skeleton"
import { TeamSchedulingContainer } from "./[teamId]/_components/team-scheduling-container"

export async function generateMetadata(): Promise<Metadata> {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Scheduling`,
		description: `Manage workout scheduling for ${team.name}`,
	}
}

export default async function TeamSchedulingPage() {
	const { teamId, team } = await getAdminTeamContext()

	// Check if user has permission to access team scheduling
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: team.name },
				]}
			/>
			<div className="container mx-auto sm:px-5 pb-12">
				<div className="flex justify-between items-start mb-8">
					<div>
						<h1 className="text-3xl font-bold mb-2">Team Scheduling</h1>
						<p className="text-muted-foreground">
							Manage workout schedules for {team.name}
						</p>
					</div>
				</div>

				<div className="bg-card rounded-lg border sm:p-6">
					<Suspense fallback={<CalendarSkeleton />}>
						<TeamSchedulingContainer teamId={teamId} />
					</Suspense>
				</div>
			</div>
		</>
	)
}
