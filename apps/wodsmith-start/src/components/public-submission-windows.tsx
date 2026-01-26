"use client"

import { Link } from "@tanstack/react-router"
import {
	Calendar,
	Clock,
	CheckCircle2,
	AlertCircle,
	Timer,
	ChevronRight,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"
import { cn } from "@/utils/cn"

interface SubmissionWindowEvent {
	id: string
	competitionId: string
	trackWorkoutId: string
	submissionOpensAt: string | null
	submissionClosesAt: string | null
}

interface PublicSubmissionWindowsProps {
	events: CompetitionWorkout[]
	submissionWindows: SubmissionWindowEvent[]
	competitionStarted: boolean
	timezone?: string
	slug: string
}

function formatDateOnly(isoString: string, timezone?: string): string {
	const date = new Date(isoString)
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		timeZone: timezone,
	})
}

function formatShortDate(isoString: string, timezone?: string): string {
	const date = new Date(isoString)
	return date.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		timeZone: timezone,
	})
}

function formatDateRange(
	opensAt: string,
	closesAt: string,
	timezone?: string,
): string {
	const openDate = new Date(opensAt)
	const closeDate = new Date(closesAt)
	const openKey = openDate.toLocaleDateString("en-CA", { timeZone: timezone })
	const closeKey = closeDate.toLocaleDateString("en-CA", { timeZone: timezone })

	const formatDate = (date: Date) =>
		date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			timeZone: timezone,
		})

	if (openKey === closeKey) {
		return formatDate(openDate)
	}
	return `${formatDate(openDate)} - ${formatDate(closeDate)}`
}

function formatTimeOnly(isoString: string, timezone?: string): string {
	const date = new Date(isoString)
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		timeZone: timezone,
	})
}

type WindowStatus = "upcoming" | "open" | "closed" | "not-set"

function getWindowStatus(
	opensAt: string | null,
	closesAt: string | null,
): WindowStatus {
	if (!opensAt && !closesAt) return "not-set"

	const now = new Date()
	const opens = opensAt ? new Date(opensAt) : null
	const closes = closesAt ? new Date(closesAt) : null

	if (opens && now < opens) return "upcoming"
	if (closes && now > closes) return "closed"
	if (opens && now >= opens) return "open"

	return "not-set"
}

function getTimeUntil(dateString: string): string {
	const now = new Date()
	const target = new Date(dateString)
	const diff = target.getTime() - now.getTime()

	if (diff < 0) return "now"

	const hours = Math.floor(diff / (1000 * 60 * 60))
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

	if (hours > 24) {
		const days = Math.floor(hours / 24)
		return `in ${days} day${days !== 1 ? "s" : ""}`
	}
	if (hours > 0) {
		return `in ${hours}h ${minutes}m`
	}
	return `in ${minutes}m`
}

function getTimeRemaining(dateString: string): string {
	const now = new Date()
	const target = new Date(dateString)
	const diff = target.getTime() - now.getTime()

	if (diff < 0) return "closed"

	const hours = Math.floor(diff / (1000 * 60 * 60))
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

	if (hours >= 24) {
		const days = Math.floor(hours / 24)
		return `${days} day${days !== 1 ? "s" : ""} left to submit`
	}
	if (hours > 0) {
		return `${hours}h ${minutes}m left to submit`
	}
	return `${minutes}m left to submit`
}

interface WindowGroup {
	dateKey: string
	label: string
	shortLabel: string
	items: Array<{
		event: CompetitionWorkout
		window: SubmissionWindowEvent | null
		status: WindowStatus
	}>
}

export function PublicSubmissionWindows({
	events,
	submissionWindows,
	competitionStarted,
	timezone,
	slug,
}: PublicSubmissionWindowsProps) {
	// State must be declared before any early returns (React hooks rules)
	const [selectedTab, setSelectedTab] = useState<string>("all")

	// Build window lookup map
	const windowMap = new Map(submissionWindows.map((w) => [w.trackWorkoutId, w]))

	// Combine events with their windows
	const eventsWithWindows = events.map((event) => {
		const window = windowMap.get(event.id)
		const status = window
			? getWindowStatus(window.submissionOpensAt, window.submissionClosesAt)
			: "not-set"
		return { event, window: window ?? null, status }
	})

	// Helper to get date key with timezone consideration
	const getDateKey = (isoString: string): string => {
		const date = new Date(isoString)
		return date.toLocaleDateString("en-CA", { timeZone: timezone }) // YYYY-MM-DD format
	}

	// Group by submission opens date
	const groups = new Map<string, WindowGroup>()
	for (const item of eventsWithWindows) {
		const opensAt = item.window?.submissionOpensAt
		const closesAt = item.window?.submissionClosesAt
		const dateKey = opensAt ? getDateKey(opensAt) : "unscheduled"

		// Check if window spans multiple days (using timezone-aware comparison)
		const spansMultipleDays =
			opensAt && closesAt && getDateKey(opensAt) !== getDateKey(closesAt)

		// Build labels with date range if spanning multiple days
		let label: string
		let shortLabel: string
		if (!opensAt) {
			label = "No Schedule Set"
			shortLabel = "TBD"
		} else if (spansMultipleDays && closesAt) {
			label = `${formatDateOnly(opensAt, timezone)} - ${formatDateOnly(closesAt, timezone)}`
			shortLabel = `${formatShortDate(opensAt, timezone)} - ${formatShortDate(closesAt, timezone)}`
		} else {
			label = formatDateOnly(opensAt, timezone)
			shortLabel = formatShortDate(opensAt, timezone)
		}

		const existing = groups.get(dateKey)
		if (existing) {
			// Update label if this item has a longer date range
			if (spansMultipleDays && !existing.label.includes(" - ")) {
				existing.label = label
				existing.shortLabel = shortLabel
			}
			existing.items.push(item)
		} else {
			groups.set(dateKey, { dateKey, label, shortLabel, items: [item] })
		}
	}

	// Sort groups by date
	const sortedGroups = Array.from(groups.values()).sort((a, b) => {
		if (a.dateKey === "unscheduled") return 1
		if (b.dateKey === "unscheduled") return -1
		return a.dateKey.localeCompare(b.dateKey)
	})

	// Sort items within each group by trackOrder
	for (const group of sortedGroups) {
		group.items.sort((a, b) => a.event.trackOrder - b.event.trackOrder)
	}

	// Empty state - competition hasn't started
	if (!competitionStarted) {
		return (
			<div className="space-y-6">
				<h2 className="text-2xl font-bold">Submission Schedule</h2>
				<Card className="border-dashed">
					<CardContent className="py-12 text-center text-muted-foreground">
						<Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
						<p className="text-lg font-medium mb-2">
							Competition Hasn't Started Yet
						</p>
						<p className="text-sm">
							The submission schedule will be available once the competition
							begins.
						</p>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Empty state - no submission windows
	if (submissionWindows.length === 0) {
		return (
			<div className="space-y-6">
				<h2 className="text-2xl font-bold">Submission Schedule</h2>
				<Card className="border-dashed">
					<CardContent className="py-12 text-center text-muted-foreground">
						<Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
						<p className="text-lg font-medium mb-2">
							Submission Windows Coming Soon
						</p>
						<p className="text-sm">
							The organizer is finalizing the submission schedule. Check back
							soon.
						</p>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Filter groups based on selected tab
	const scheduledGroups = sortedGroups.filter(
		(g) => g.dateKey !== "unscheduled",
	)
	const filteredGroups =
		selectedTab === "all"
			? sortedGroups
			: sortedGroups.filter((g) => g.dateKey === selectedTab)

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold">Submission Schedule</h2>
				<p className="text-sm text-muted-foreground mt-1">
					Submit your scores and videos within the designated windows
				</p>
			</div>

			{/* Day Tabs - only show if multiple days */}
			{scheduledGroups.length > 1 && (
				<div className="flex justify-center border-b overflow-x-auto">
					<button
						type="button"
						onClick={() => setSelectedTab("all")}
						className={cn(
							"px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
							selectedTab === "all"
								? "border-orange-500 text-orange-500"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
					>
						All Days
					</button>
					{scheduledGroups.map((group) => (
						<button
							key={group.dateKey}
							type="button"
							onClick={() => setSelectedTab(group.dateKey)}
							className={cn(
								"px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
								selectedTab === group.dateKey
									? "border-orange-500 text-orange-500"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)}
						>
							{group.shortLabel}
						</button>
					))}
				</div>
			)}

			{/* Schedule Content */}
			<div className="rounded-lg border overflow-hidden">
				<div className="max-h-[800px] overflow-y-auto">
					{filteredGroups.map((group) => (
						<div key={group.dateKey}>
							{/* Day Header */}
							<div className="sticky top-0 z-10 bg-muted px-4 py-2 border-b">
								<h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
									<Calendar className="h-4 w-4" />
									{group.label}
								</h3>
							</div>

							{/* Events */}
							<div className="divide-y">
								{group.items.map(({ event, window, status }) => (
									<SubmissionWindowRow
										key={event.id}
										event={event}
										window={window}
										status={status}
										timezone={timezone}
										slug={slug}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

interface SubmissionWindowRowProps {
	event: CompetitionWorkout
	window: SubmissionWindowEvent | null
	status: WindowStatus
	timezone?: string
	slug: string
}

function SubmissionWindowRow({
	event,
	window,
	status,
	timezone,
	slug,
}: SubmissionWindowRowProps) {
	// Check if window spans multiple days (timezone-aware)
	const getDateKey = (isoString: string): string => {
		const date = new Date(isoString)
		return date.toLocaleDateString("en-CA", { timeZone: timezone }) // YYYY-MM-DD format
	}

	const spansMultipleDays =
		window?.submissionOpensAt &&
		window?.submissionClosesAt &&
		getDateKey(window.submissionOpensAt) !==
			getDateKey(window.submissionClosesAt)

	return (
		<Link
			to="/compete/$slug/workouts/$eventId"
			params={{ slug, eventId: event.id }}
			className={cn(
				"px-4 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors group",
				status === "open" && "bg-orange-500/5",
			)}
		>
			<div className="flex items-center gap-4 flex-1">
				<div
					className={cn(
						"flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center backdrop-blur-sm",
						status === "open"
							? "bg-orange-500/90"
							: status === "closed"
								? "bg-muted"
								: "bg-white/10 border border-white/20",
					)}
				>
					<span
						className={cn(
							"text-sm font-bold tabular-nums",
							status === "closed"
								? "text-muted-foreground"
								: status === "open"
									? "text-white"
									: "text-foreground",
						)}
					>
						{String(event.trackOrder).padStart(2, "0")}
					</span>
				</div>
				<div className="flex-1 min-w-0">
					<h4
						className={cn(
							"font-semibold truncate group-hover:text-orange-500 transition-colors",
							status === "closed" && "text-muted-foreground",
						)}
					>
						{event.workout.name}
					</h4>
					<div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-muted-foreground">
						{window?.submissionOpensAt && window?.submissionClosesAt && (
							<>
								<span className="flex items-center gap-1">
									<Calendar className="h-3 w-3" />
									{formatDateRange(
										window.submissionOpensAt,
										window.submissionClosesAt,
										timezone,
									)}
								</span>
								<span className="flex items-center gap-1">
									<Timer className="h-3 w-3" />
									{spansMultipleDays ? (
										<>
											{formatTimeOnly(window.submissionOpensAt, timezone)} -{" "}
											{formatShortDate(window.submissionClosesAt, timezone)}{" "}
											{formatTimeOnly(window.submissionClosesAt, timezone)}
										</>
									) : (
										<>
											{formatTimeOnly(window.submissionOpensAt, timezone)} -{" "}
											{formatTimeOnly(window.submissionClosesAt, timezone)}
										</>
									)}
								</span>
							</>
						)}
					</div>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<StatusBadge
					status={status}
					opensAt={window?.submissionOpensAt ?? null}
					closesAt={window?.submissionClosesAt ?? null}
				/>
				<ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-orange-500 transition-colors" />
			</div>
		</Link>
	)
}

interface StatusBadgeProps {
	status: WindowStatus
	opensAt: string | null
	closesAt: string | null
}

function StatusBadge({ status, opensAt, closesAt }: StatusBadgeProps) {
	switch (status) {
		case "open":
			return (
				<div className="flex flex-col items-end gap-1">
					<Badge className="bg-orange-500 text-white gap-1">
						<CheckCircle2 className="h-3 w-3" />
						Open
					</Badge>
					{closesAt && (
						<span className="text-xs text-muted-foreground">
							{getTimeRemaining(closesAt)}
						</span>
					)}
				</div>
			)
		case "upcoming":
			return (
				<div className="flex flex-col items-end gap-1">
					<Badge variant="outline" className="gap-1">
						<Clock className="h-3 w-3" />
						Upcoming
					</Badge>
					{opensAt && (
						<span className="text-xs text-muted-foreground">
							Opens {getTimeUntil(opensAt)}
						</span>
					)}
				</div>
			)
		case "closed":
			return (
				<Badge variant="secondary" className="gap-1 text-muted-foreground">
					<AlertCircle className="h-3 w-3" />
					Closed
				</Badge>
			)
		case "not-set":
			return (
				<Badge
					variant="outline"
					className="gap-1 text-amber-500 border-amber-500"
				>
					<Clock className="h-3 w-3" />
					TBD
				</Badge>
			)
	}
}
