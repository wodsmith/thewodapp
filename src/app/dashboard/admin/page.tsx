import { TEAM_PERMISSIONS } from "@/db/schema"
import { getUserTeams } from "@/utils/team-auth"
import { hasTeamPermission } from "@/utils/team-auth"
import { redirect } from "next/navigation"

export default async function AdminDashboardRedirectPage() {
	if (process.env.NODE_ENV === "development") {
		console.log("[AdminDashboard] Redirecting to team-specific admin dashboard")
	}

	// Get user's teams
	const teams = await getUserTeams()

	if (!teams || teams.length === 0) {
		// No teams available, redirect to main dashboard
		redirect("/dashboard")
	}

	// Find first team where user has admin permissions
	for (const team of teams) {
		const hasAdminAccess = await hasTeamPermission(
			team.id,
			TEAM_PERMISSIONS.SCHEDULE_WORKOUTS,
		)
		if (hasAdminAccess) {
			redirect(`/dashboard/teams/${team.id}/admin`)
		}
	}

	// No admin access to any team, redirect to main dashboard
	redirect("/dashboard")
}
