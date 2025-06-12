import { TEAM_PERMISSIONS } from "@/db/schema"
import {
	type AdminDashboardData,
	getAdminDashboardData,
	invalidateAdminDashboardCache,
} from "@/server/admin-dashboard"
import { hasTeamPermission } from "@/utils/team-auth"
import { redirect } from "next/navigation"
import AdminDashboardClient from "./_components/AdminDashboardClient"

interface AdminDashboardPageProps {
	params: { teamId: string }
}

// Server component for permission checking and data loading
export default async function AdminDashboardPage({
	params,
}: AdminDashboardPageProps) {
	const { teamId } = params

	// Check permissions on the server side
	const hasAdminPermission = await hasTeamPermission(
		teamId,
		TEAM_PERMISSIONS.SCHEDULE_WORKOUTS,
	)

	if (!hasAdminPermission) {
		redirect(`/dashboard/teams/${teamId}`)
	}

	// Load initial dashboard data on the server
	let initialData: AdminDashboardData | undefined

	try {
		initialData = await getAdminDashboardData(teamId)

		if (process.env.NODE_ENV === "development") {
			console.log(
				`[AdminDashboard] Server-side data loaded for teamId: ${teamId} in ${initialData.performanceMetrics.dataFetchTime}ms`,
			)
		}
	} catch (error) {
		console.error("[AdminDashboard] Server-side data loading failed:", error)
		// Don't redirect on error, let the client component handle it
	}

	return (
		<AdminDashboardClient
			teamId={teamId}
			initialData={initialData}
			invalidateCacheAction={() => invalidateAdminDashboardCache(teamId)}
		/>
	)
}
