"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
	BarChart3,
	Calendar,
	ChevronLeft,
	ChevronRight,
	Clock,
	Copy,
	Edit,
	Plus,
	Settings,
	Target,
	Trash2,
	Users,
	Zap,
} from "lucide-react"
import type React from "react"
import { useCallback, useState } from "react"

interface QuickActionsSidebarProps {
	teamId: string
	isCollapsed?: boolean
	onToggleCollapsed?: () => void
	onScheduleWorkout?: () => void
	onCreateWorkout?: () => void
	onManageMembers?: () => void
	onViewAnalytics?: () => void
	className?: string
}

interface QuickAction {
	id: string
	label: string
	icon: React.ComponentType<{ className?: string }>
	description: string
	action: () => void
	variant: "default" | "outline" | "secondary"
	badge?: string
}

export default function QuickActionsSidebar({
	teamId,
	isCollapsed = false,
	onToggleCollapsed,
	onScheduleWorkout,
	onCreateWorkout,
	onManageMembers,
	onViewAnalytics,
	className = "",
}: QuickActionsSidebarProps) {
	const [recentActions, setRecentActions] = useState<string[]>([])

	// Development logging
	const logAction = useCallback(
		(action: string, data: Record<string, unknown>) => {
			if (process.env.NODE_ENV === "development") {
				console.log(`[QuickActionsSidebar] ${action}`, data)
			}
		},
		[],
	)

	const trackAction = useCallback(
		(actionId: string, actionName: string) => {
			setRecentActions((prev) => [
				actionId,
				...prev.filter((id) => id !== actionId).slice(0, 4),
			])
			logAction(actionName, { actionId, teamId })
		},
		[teamId, logAction],
	)

	const handleScheduleWorkout = () => {
		trackAction("schedule-workout", "Schedule workout action")
		onScheduleWorkout?.()
	}

	const handleCreateWorkout = () => {
		trackAction("create-workout", "Create workout action")
		onCreateWorkout?.()
	}

	const handleManageMembers = () => {
		trackAction("manage-members", "Manage members action")
		onManageMembers?.()
	}

	const handleViewAnalytics = () => {
		trackAction("view-analytics", "View analytics action")
		onViewAnalytics?.()
	}

	const handleBulkSchedule = () => {
		trackAction("bulk-schedule", "Bulk schedule workouts")
		logAction("Bulk schedule workouts", { teamId })
		// TODO: Implement bulk scheduling modal
	}

	const handleCopySchedule = () => {
		trackAction("copy-schedule", "Copy schedule")
		logAction("Copy schedule", { teamId })
		// TODO: Implement copy schedule functionality
	}

	const handleClearSchedule = () => {
		trackAction("clear-schedule", "Clear schedule")
		logAction("Clear schedule", { teamId })
		// TODO: Implement clear schedule confirmation
	}

	const primaryActions: QuickAction[] = [
		{
			id: "schedule-workout",
			label: "Schedule Workout",
			icon: Calendar,
			description: "Schedule a workout for specific date",
			action: handleScheduleWorkout,
			variant: "default",
		},
		{
			id: "create-workout",
			label: "Create Workout",
			icon: Plus,
			description: "Create a new workout",
			action: handleCreateWorkout,
			variant: "outline",
		},
		{
			id: "manage-members",
			label: "Manage Members",
			icon: Users,
			description: "Manage team members and permissions",
			action: handleManageMembers,
			variant: "outline",
		},
		{
			id: "view-analytics",
			label: "View Analytics",
			icon: BarChart3,
			description: "View team performance analytics",
			action: handleViewAnalytics,
			variant: "outline",
			badge: "New",
		},
	]

	const bulkActions: QuickAction[] = [
		{
			id: "bulk-schedule",
			label: "Bulk Schedule",
			icon: Target,
			description: "Schedule multiple workouts at once",
			action: handleBulkSchedule,
			variant: "secondary",
		},
		{
			id: "copy-schedule",
			label: "Copy Schedule",
			icon: Copy,
			description: "Copy schedule from another week",
			action: handleCopySchedule,
			variant: "secondary",
		},
		{
			id: "clear-schedule",
			label: "Clear Schedule",
			icon: Trash2,
			description: "Clear all scheduled workouts",
			action: handleClearSchedule,
			variant: "secondary",
		},
	]

	const quickEditActions: QuickAction[] = [
		{
			id: "edit-today",
			label: "Edit Today",
			icon: Edit,
			description: "Quickly edit today's workouts",
			action: () => {
				trackAction("edit-today", "Edit today's workouts")
				// TODO: Open today's workouts in edit mode
			},
			variant: "outline",
		},
		{
			id: "time-blocks",
			label: "Time Blocks",
			icon: Clock,
			description: "Manage class time blocks",
			action: () => {
				trackAction("time-blocks", "Manage time blocks")
				// TODO: Open time blocks management
			},
			variant: "outline",
		},
	]

	return (
		<div
			className={`bg-white border-l border-gray-200 transition-all duration-300 ${
				isCollapsed ? "w-12" : "w-80"
			} ${className}`}
		>
			{/* Header */}
			<div className="border-b border-gray-200 p-4 flex items-center justify-between">
				<Button
					variant="ghost"
					size="sm"
					onClick={onToggleCollapsed}
					className="p-1 h-8 w-8"
					aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
				>
					{isCollapsed ? (
						<ChevronLeft className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
				</Button>
				{!isCollapsed && (
					<div className="text-right">
						<h2 className="text-lg font-semibold text-gray-900">
							Quick Actions
						</h2>
						<p className="text-sm text-gray-500">Common admin tasks</p>
					</div>
				)}
			</div>

			{!isCollapsed && (
				<div className="flex-1 overflow-y-auto p-4 space-y-6">
					{/* Primary Actions */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 mb-3">
							Primary Actions
						</h3>
						<div className="space-y-2">
							{primaryActions.map((action) => (
								<div key={action.id} className="relative">
									<Button
										onClick={action.action}
										variant={action.variant}
										className="w-full justify-start h-auto p-3"
									>
										<action.icon className="h-4 w-4 mr-3 shrink-0" />
										<div className="text-left">
											<div className="flex items-center">
												<span className="font-medium">{action.label}</span>
												{action.badge && (
													<Badge variant="secondary" className="ml-2 text-xs">
														{action.badge}
													</Badge>
												)}
											</div>
											<p className="text-xs text-gray-500 mt-1">
												{action.description}
											</p>
										</div>
									</Button>
									{recentActions.includes(action.id) && (
										<div className="absolute -top-1 -right-1">
											<div className="w-2 h-2 bg-green-500 rounded-full" />
										</div>
									)}
								</div>
							))}
						</div>
					</div>

					<Separator />

					{/* Bulk Operations */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 mb-3">
							Bulk Operations
						</h3>
						<div className="space-y-2">
							{bulkActions.map((action) => (
								<Button
									key={action.id}
									onClick={action.action}
									variant={action.variant}
									className="w-full justify-start h-auto p-3"
								>
									<action.icon className="h-4 w-4 mr-3 shrink-0" />
									<div className="text-left">
										<span className="font-medium">{action.label}</span>
										<p className="text-xs text-gray-500 mt-1">
											{action.description}
										</p>
									</div>
								</Button>
							))}
						</div>
					</div>

					<Separator />

					{/* Quick Edit */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 mb-3">
							Quick Edit
						</h3>
						<div className="space-y-2">
							{quickEditActions.map((action) => (
								<Button
									key={action.id}
									onClick={action.action}
									variant={action.variant}
									className="w-full justify-start h-auto p-3"
								>
									<action.icon className="h-4 w-4 mr-3 shrink-0" />
									<div className="text-left">
										<span className="font-medium">{action.label}</span>
										<p className="text-xs text-gray-500 mt-1">
											{action.description}
										</p>
									</div>
								</Button>
							))}
						</div>
					</div>

					<Separator />

					{/* Recent Activity */}
					{recentActions.length > 0 && (
						<div>
							<h3 className="text-sm font-medium text-gray-700 mb-3">
								Recent Actions
							</h3>
							<Card>
								<CardContent className="p-3">
									<div className="space-y-2">
										{recentActions.slice(0, 3).map((actionId) => {
											const action = [
												...primaryActions,
												...bulkActions,
												...quickEditActions,
											].find((a) => a.id === actionId)
											if (!action) return null

											return (
												<div
													key={actionId}
													className="flex items-center text-sm"
												>
													<action.icon className="h-3 w-3 mr-2 text-gray-400" />
													<span className="text-gray-600">{action.label}</span>
													<Zap className="h-3 w-3 ml-auto text-green-500" />
												</div>
											)
										})}
									</div>
								</CardContent>
							</Card>
						</div>
					)}
				</div>
			)}

			{/* Collapsed State Icons */}
			{isCollapsed && (
				<div className="p-2 space-y-2">
					{primaryActions.slice(0, 4).map((action) => (
						<Button
							key={action.id}
							variant="ghost"
							size="sm"
							className="w-full p-2 h-10 relative"
							onClick={action.action}
							title={action.label}
						>
							<action.icon className="h-4 w-4" />
							{recentActions.includes(action.id) && (
								<div className="absolute -top-1 -right-1">
									<div className="w-2 h-2 bg-green-500 rounded-full" />
								</div>
							)}
						</Button>
					))}
				</div>
			)}
		</div>
	)
}
