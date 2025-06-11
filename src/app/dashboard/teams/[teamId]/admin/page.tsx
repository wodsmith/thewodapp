import ScheduleWorkoutModal from "@/components/schedule/ScheduleWorkoutModal"
import TeamScheduleCalendar from "@/components/schedule/TeamScheduleCalendar"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { hasTeamPermission } from "@/utils/team-auth"
import { redirect } from "next/navigation"
import React from "react"

interface PageProps {
	params: Promise<{ teamId: string }>
}

export default async function AdminDashboardPage({ params }: PageProps) {
	const { teamId } = await params

	// Check if user has admin permissions
	const hasAdminAccess = await hasTeamPermission(
		teamId,
		TEAM_PERMISSIONS.SCHEDULE_WORKOUTS,
	)

	if (!hasAdminAccess) {
		redirect(`/dashboard/teams/${teamId}`)
	}

	if (process.env.NODE_ENV === "development") {
		console.log(
			`[AdminDashboard] Loading admin dashboard for teamId: ${teamId}`,
		)
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="container mx-auto p-6">
				<div className="mb-6">
					<h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
					<p className="text-gray-600 mt-2">
						Centralized team management and scheduling
					</p>
				</div>

				{/* Main layout with calendar focus */}
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
					{/* Left sidebar placeholder */}
					<div className="lg:col-span-3 bg-white rounded-lg shadow p-4">
						<h2 className="text-lg font-semibold mb-4">Track Management</h2>
						<p className="text-gray-500">
							Track management panel coming soon...
						</p>
					</div>

					{/* Main calendar area */}
					<div className="lg:col-span-6 bg-white rounded-lg shadow p-6">
						<TeamScheduleCalendar teamId={teamId} />
					</div>

					{/* Right sidebar placeholder */}
					<div className="lg:col-span-3 bg-white rounded-lg shadow p-4">
						<h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
						<div className="space-y-3">
							<ScheduleWorkoutModal teamId={teamId} />
							<button
								type="button"
								className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm"
							>
								Create Workout
							</button>
							<button
								type="button"
								className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm"
							>
								Manage Members
							</button>
							<button
								type="button"
								className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm"
							>
								View Analytics
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
