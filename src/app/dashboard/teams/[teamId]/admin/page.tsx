"use client"

import AdminScheduleCalendar from "@/components/admin/AdminScheduleCalendar"
import QuickActionsSidebar from "@/components/admin/QuickActionsSidebar"
import TrackManagementSidebar from "@/components/admin/TrackManagementSidebar"
import ScheduleWorkoutModal from "@/components/schedule/ScheduleWorkoutModal"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TEAM_PERMISSIONS } from "@/db/schema"
import {
	type AdminDashboardData,
	getAdminDashboardData,
	invalidateAdminDashboardCache,
} from "@/server/admin-dashboard"
import { hasTeamPermission } from "@/utils/team-auth"
import { redirect } from "next/navigation"
import React, { useState, useEffect, useCallback } from "react"

interface AdminDashboardPageProps {
	params: { teamId: string }
}

// Server component wrapper for permission checking
export default function AdminDashboardPage({
	params,
}: AdminDashboardPageProps) {
	return <AdminDashboardClient teamId={params.teamId} />
}

// Client component for interactive functionality
function AdminDashboardClient({ teamId }: { teamId: string }) {
	const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
	const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
	const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
	const [scheduleWorkoutModalOpen, setScheduleWorkoutModalOpen] =
		useState(false)
	const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(
		null,
	)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Load dashboard data with performance optimization
	const loadDashboardData = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)

			if (process.env.NODE_ENV === "development") {
				console.log(
					`[AdminDashboard] Loading dashboard data for teamId: ${teamId}`,
				)
			}

			const data = await getAdminDashboardData(teamId)
			setDashboardData(data)

			if (process.env.NODE_ENV === "development") {
				console.log(
					`[AdminDashboard] Dashboard data loaded in ${data.performanceMetrics.dataFetchTime}ms`,
				)
			}
		} catch (err) {
			console.error("[AdminDashboard] Error loading dashboard data:", err)
			setError(
				err instanceof Error ? err.message : "Failed to load dashboard data",
			)
		} finally {
			setLoading(false)
		}
	}, [teamId])

	// Load data on component mount
	useEffect(() => {
		loadDashboardData()
	}, [loadDashboardData])

	// Development logging
	if (process.env.NODE_ENV === "development") {
		console.log(
			`[AdminDashboard] Loading admin dashboard for teamId: ${teamId}`,
		)
	}

	const handleTrackSelected = (trackId: string) => {
		setSelectedTrackId(trackId)
		if (process.env.NODE_ENV === "development") {
			console.log(`[AdminDashboard] Track selected: ${trackId}`)
		}
	}

	const handleScheduleWorkout = async () => {
		setScheduleWorkoutModalOpen(true)
		if (process.env.NODE_ENV === "development") {
			console.log(
				`[AdminDashboard] Opening schedule workout modal for team: ${teamId}`,
			)
		}
	}

	const handleCreateWorkout = () => {
		// TODO: Implement create workout modal
		if (process.env.NODE_ENV === "development") {
			console.log(`[AdminDashboard] Create workout action for team: ${teamId}`)
		}
	}

	const handleManageMembers = () => {
		// TODO: Implement manage members modal
		if (process.env.NODE_ENV === "development") {
			console.log(`[AdminDashboard] Manage members action for team: ${teamId}`)
		}
	}

	const handleViewAnalytics = () => {
		// TODO: Implement analytics view
		if (process.env.NODE_ENV === "development") {
			console.log(`[AdminDashboard] View analytics action for team: ${teamId}`)
		}
	}

	const handleDataRefresh = async () => {
		await invalidateAdminDashboardCache(teamId)
		await loadDashboardData()
		if (process.env.NODE_ENV === "development") {
			console.log(
				`[AdminDashboard] Dashboard data refreshed for team: ${teamId}`,
			)
		}
	}

	const handleWorkoutScheduled = async () => {
		if (process.env.NODE_ENV === "development") {
			console.log(
				`[AdminDashboard] Workout scheduled for team: ${teamId}, refreshing data`,
			)
		}
		// Refresh dashboard data after scheduling
		await handleDataRefresh()
	}

	// Show loading state
	if (loading && !dashboardData) {
		return (
			<div className="min-h-screen bg-gray-50 flex">
				<div className="w-80 bg-white border-r border-gray-200">
					<Skeleton className="h-full w-full" />
				</div>
				<div className="flex-1 flex flex-col">
					<div className="bg-white border-b border-gray-200 p-6">
						<Skeleton className="h-8 w-64 mb-2" />
						<Skeleton className="h-4 w-96" />
					</div>
					<div className="flex-1 p-6">
						<Skeleton className="h-full w-full rounded-lg" />
					</div>
				</div>
				<div className="w-80 bg-white border-l border-gray-200">
					<Skeleton className="h-full w-full" />
				</div>
			</div>
		)
	}

	// Show error state
	if (error) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<Alert className="max-w-md">
					<AlertDescription>
						{error}
						<button
							type="button"
							onClick={loadDashboardData}
							className="ml-2 text-blue-600 hover:text-blue-800 underline"
						>
							Try again
						</button>
					</AlertDescription>
				</Alert>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-gray-50 flex">
			{/* Left Sidebar - Track Management */}
			<TrackManagementSidebar
				teamId={teamId}
				isCollapsed={leftSidebarCollapsed}
				onToggleCollapsed={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
				onTrackSelected={handleTrackSelected}
				className="shrink-0"
			/>

			{/* Main Content Area */}
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<div className="bg-white border-b border-gray-200 p-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold text-gray-900">
								Admin Dashboard
							</h1>
							<p className="text-gray-600 mt-2">
								Centralized team management and scheduling
								{selectedTrackId && (
									<span className="ml-2 text-blue-600">
										• Track: {selectedTrackId}
									</span>
								)}
							</p>
							{dashboardData && (
								<div className="flex items-center gap-4 mt-3">
									<Badge variant="outline">
										{dashboardData.team.memberCount} members
									</Badge>
									<Badge variant="outline">
										{dashboardData.tracks.length} tracks
									</Badge>
									<Badge variant="outline">
										{dashboardData.schedulingStats.upcomingWorkouts} upcoming
										workouts
									</Badge>
									<Badge
										variant={
											dashboardData.performanceMetrics.cacheStatus === "hit"
												? "default"
												: "secondary"
										}
										className="text-xs"
									>
										{dashboardData.performanceMetrics.dataFetchTime}ms load time
									</Badge>
								</div>
							)}
						</div>
						<button
							type="button"
							onClick={handleDataRefresh}
							className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
							disabled={loading}
						>
							{loading ? "Refreshing..." : "Refresh Data"}
						</button>
					</div>
				</div>

				{/* Calendar Area */}
				<div className="flex-1 p-6">
					<div className="bg-white rounded-lg shadow h-full">
						<AdminScheduleCalendar
							teamId={teamId}
							onWorkoutScheduled={handleWorkoutScheduled}
						/>
					</div>
				</div>
			</div>

			{/* Right Sidebar - Quick Actions */}
			<QuickActionsSidebar
				teamId={teamId}
				isCollapsed={rightSidebarCollapsed}
				onToggleCollapsed={() =>
					setRightSidebarCollapsed(!rightSidebarCollapsed)
				}
				onScheduleWorkout={handleScheduleWorkout}
				onCreateWorkout={handleCreateWorkout}
				onManageMembers={handleManageMembers}
				onViewAnalytics={handleViewAnalytics}
				className="shrink-0"
			/>

			{/* Schedule Workout Modal */}
			{scheduleWorkoutModalOpen && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
						<div className="flex justify-between items-center mb-4">
							<h3 className="font-semibold">Schedule Workout</h3>
							<button
								type="button"
								onClick={() => setScheduleWorkoutModalOpen(false)}
								className="text-gray-500 hover:text-gray-700"
							>
								×
							</button>
						</div>
						<ScheduleWorkoutModal teamId={teamId} />
					</div>
				</div>
			)}
		</div>
	)
}
