"use client"

import { Clock, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { VolunteerRoleType } from "@/db/schemas/volunteers"
import type { VolunteerShiftData } from "@/server-fns/volunteer-schedule-fns"
import { cn } from "@/utils/cn"

interface ShiftCardProps {
	shift: VolunteerShiftData
}

/**
 * Format role type for display
 */
function formatRoleType(role: VolunteerRoleType): string {
	const roleLabels: Record<VolunteerRoleType, string> = {
		judge: "Judge",
		head_judge: "Head Judge",
		scorekeeper: "Scorekeeper",
		emcee: "Emcee",
		floor_manager: "Floor Manager",
		media: "Media",
		general: "General",
		equipment: "Equipment",
		medical: "Medical",
		check_in: "Check-in",
		staff: "Staff",
	}
	return roleLabels[role] || role
}

/**
 * Get badge color classes based on role type
 */
function getRoleBadgeClasses(role: VolunteerRoleType): string {
	const roleColors: Record<VolunteerRoleType, string> = {
		judge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
		head_judge:
			"bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100",
		scorekeeper:
			"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
		emcee:
			"bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
		floor_manager:
			"bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100",
		media: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100",
		general: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
		equipment:
			"bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
		medical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
		check_in:
			"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
		staff: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
	}
	return roleColors[role] || roleColors.general
}

/**
 * Format a date/time range for display
 * Example output: "Sat 8:00 AM - 12:00 PM"
 */
function formatShiftTimeRange(startTime: Date, endTime: Date): string {
	const dayFormatter = new Intl.DateTimeFormat("en-US", {
		weekday: "short",
	})

	const timeFormatter = new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	})

	const dayStr = dayFormatter.format(startTime)
	const startTimeStr = timeFormatter.format(startTime)
	const endTimeStr = timeFormatter.format(endTime)

	// Check if start and end are on the same day
	const startDay = startTime.toDateString()
	const endDay = endTime.toDateString()

	if (startDay === endDay) {
		return `${dayStr} ${startTimeStr} - ${endTimeStr}`
	}

	// Different days - show both day abbreviations
	const endDayStr = dayFormatter.format(endTime)
	return `${dayStr} ${startTimeStr} - ${endDayStr} ${endTimeStr}`
}

/**
 * Check if a shift is upcoming (starts in the future)
 */
function isShiftUpcoming(startTime: Date): boolean {
	return startTime > new Date()
}

/**
 * Displays a single volunteer shift assignment with time, role, location, and notes
 * Used in the my-schedule page for non-judge volunteer assignments
 */
export function ShiftCard({ shift }: ShiftCardProps) {
	const isUpcoming = isShiftUpcoming(shift.startTime)
	const timeRangeStr = formatShiftTimeRange(shift.startTime, shift.endTime)

	return (
		<Card
			className={cn(
				"border-l-4",
				isUpcoming ? "border-l-primary" : "border-l-muted opacity-70",
			)}
		>
			<CardContent className="py-3 px-4 space-y-3">
				{/* Header: Shift name and role badge */}
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="font-semibold text-base">{shift.name}</h3>
					<Badge
						className={cn("border-0", getRoleBadgeClasses(shift.roleType))}
					>
						{formatRoleType(shift.roleType)}
					</Badge>
				</div>

				{/* Time and location row */}
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
					{/* Time */}
					<div className="flex items-center gap-1.5 text-muted-foreground">
						<Clock className="h-4 w-4" />
						<span className="font-medium">{timeRangeStr}</span>
					</div>

					{/* Location (if set) */}
					{shift.location && (
						<div className="flex items-center gap-1.5 text-muted-foreground">
							<MapPin className="h-4 w-4" />
							<span>{shift.location}</span>
						</div>
					)}
				</div>

				{/* Notes (if set) */}
				{shift.notes && (
					<div className="text-sm text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 rounded px-2 py-1">
						{shift.notes}
					</div>
				)}
			</CardContent>
		</Card>
	)
}
