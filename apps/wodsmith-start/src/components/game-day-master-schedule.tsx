"use client"

import { ChevronDown, ChevronRight, Clock, MapPin, Users } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"
import { cn } from "@/utils/cn"

interface Venue {
	id: string
	name: string
	laneCount: number
	transitionMinutes: number
	sortOrder: number
	address?: {
		streetLine1?: string | null
		city?: string | null
		state?: string | null
	} | null
}

interface GameDayMasterScheduleProps {
	events: CompetitionWorkout[]
	heats: HeatWithAssignments[]
	venues: Venue[]
	timezone: string
}

type HeatStatus = "past" | "current" | "next" | "upcoming"

interface HeatWithStatus {
	heat: HeatWithAssignments
	event: CompetitionWorkout
	status: HeatStatus
}

interface VenueSchedule {
	venue: Venue
	heats: HeatWithStatus[]
}

interface DayOption {
	dateKey: string
	label: string
	shortLabel: string
}

function toDate(value: Date | string | number): Date {
	if (value instanceof Date) return new Date(value.getTime())
	return new Date(value)
}

function getDateKey(date: Date, timezone: string): string {
	// Use Intl.DateTimeFormat to get date parts in the correct timezone
	const formatter = new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone: timezone,
	})
	const parts = formatter.formatToParts(date)
	const year = parts.find((p) => p.type === "year")?.value
	const month = parts.find((p) => p.type === "month")?.value
	const day = parts.find((p) => p.type === "day")?.value
	return `${year}-${month}-${day}`
}

function formatDayLabel(date: Date, timezone: string): string {
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
		timeZone: timezone,
	})
}

function formatShortDayLabel(date: Date, timezone: string): string {
	return date.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		timeZone: timezone,
	})
}

function formatTime(date: Date, timezone: string): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		timeZone: timezone,
	})
}

function formatCurrentTime(date: Date, timezone: string): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
		hour12: true,
		timeZone: timezone,
	})
}

function getCompetitorName(
	registration: HeatWithAssignments["assignments"][0]["registration"],
): string {
	if (registration.teamName) return registration.teamName
	const { firstName, lastName } = registration.user
	const name = `${firstName ?? ""} ${lastName ?? ""}`.trim()
	return name || "Unknown"
}

function calculateHeatStatus(
	scheduledTime: Date,
	durationMinutes: number,
	currentTime: Date,
): HeatStatus {
	const heatTime = toDate(scheduledTime)
	const endTime = new Date(heatTime.getTime() + durationMinutes * 60 * 1000)

	if (currentTime >= endTime) {
		return "past"
	}
	if (currentTime >= heatTime && currentTime < endTime) {
		return "current"
	}
	return "upcoming"
}

function processHeatsForVenue(
	venueHeats: HeatWithAssignments[],
	events: CompetitionWorkout[],
	currentTime: Date,
	effectiveDateKey: string | null,
	timezone: string,
): HeatWithStatus[] {
	const processed: HeatWithStatus[] = []

	for (const heat of venueHeats) {
		if (!heat.scheduledTime) continue

		// Apply date filter
		if (effectiveDateKey) {
			const heatDateKey = getDateKey(toDate(heat.scheduledTime), timezone)
			if (heatDateKey !== effectiveDateKey) continue
		}

		const event = events.find((e) => e.id === heat.trackWorkoutId)
		if (!event) continue

		const status = calculateHeatStatus(
			heat.scheduledTime,
			heat.durationMinutes ?? 10,
			currentTime,
		)

		processed.push({ heat, event, status })
	}

	// Sort by scheduled time
	processed.sort((a, b) => {
		const aTime = toDate(a.heat.scheduledTime!).getTime()
		const bTime = toDate(b.heat.scheduledTime!).getTime()
		return aTime - bTime
	})

	// Mark the first "upcoming" as "next"
	const firstUpcomingIndex = processed.findIndex((h) => h.status === "upcoming")
	if (firstUpcomingIndex > -1) {
		processed[firstUpcomingIndex]!.status = "next"
	}

	return processed
}

export function GameDayMasterSchedule({
	events,
	heats,
	venues,
	timezone,
}: GameDayMasterScheduleProps) {
	const [currentTime, setCurrentTime] = useState(new Date())
	const [selectedDay, setSelectedDay] = useState<string>("today")

	// Update time every second
	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentTime(new Date())
		}, 1000)
		return () => clearInterval(timer)
	}, [])

	// Get all available days from heats
	const availableDays = useMemo(() => {
		const daysMap = new Map<string, DayOption>()

		for (const heat of heats) {
			if (heat.scheduledTime) {
				const date = toDate(heat.scheduledTime)
				const dateKey = getDateKey(date, timezone)
				if (!daysMap.has(dateKey)) {
					daysMap.set(dateKey, {
						dateKey,
						label: formatDayLabel(date, timezone),
						shortLabel: formatShortDayLabel(date, timezone),
					})
				}
			}
		}

		return Array.from(daysMap.values()).sort((a, b) =>
			a.dateKey.localeCompare(b.dateKey),
		)
	}, [heats, timezone])

	// Get today's date key for "today" filter (in competition timezone)
	const todayDateKey = useMemo(
		() => getDateKey(currentTime, timezone),
		[currentTime, timezone],
	)

	// Build venue schedules
	const venueSchedules = useMemo(() => {
		const schedules: VenueSchedule[] = []

		// Get the effective date filter
		const effectiveDateKey =
			selectedDay === "today"
				? todayDateKey
				: selectedDay === "all"
					? null
					: selectedDay

		for (const venue of venues) {
			// Get all heats for this venue
			const venueHeatsFiltered = heats.filter(
				(heat) => heat.venue?.id === venue.id,
			)
			const processedHeats = processHeatsForVenue(
				venueHeatsFiltered,
				events,
				currentTime,
				effectiveDateKey,
				timezone,
			)

			if (processedHeats.length > 0) {
				schedules.push({ venue, heats: processedHeats })
			}
		}

		// Also handle heats without a venue assigned
		const noVenueHeatsFiltered = heats.filter((heat) => !heat.venue)
		const processedNoVenueHeats = processHeatsForVenue(
			noVenueHeatsFiltered,
			events,
			currentTime,
			effectiveDateKey,
			timezone,
		)

		if (processedNoVenueHeats.length > 0) {
			schedules.push({
				venue: {
					id: "no-venue",
					name: "Unassigned",
					laneCount: 10,
					transitionMinutes: 3,
					sortOrder: 999,
				},
				heats: processedNoVenueHeats,
			})
		}

		return schedules.sort((a, b) => a.venue.sortOrder - b.venue.sortOrder)
	}, [heats, events, venues, currentTime, selectedDay, todayDateKey, timezone])

	// Empty state
	if (heats.length === 0) {
		return (
			<div className="rounded-2xl border border-black/10 bg-black/5 p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
				<div className="text-center py-12">
					<Clock className="mx-auto mb-4 h-12 w-12 opacity-50" />
					<p className="mb-2 text-lg font-medium">Schedule Coming Soon</p>
					<p className="text-sm text-muted-foreground">
						The heat schedule for this competition hasn't been published yet.
					</p>
				</div>
			</div>
		)
	}

	// If no venues have heats today
	if (venueSchedules.length === 0) {
		return (
			<div className="rounded-2xl border border-black/10 bg-black/5 p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
				<div className="mb-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
					<h2 className="text-2xl font-bold">Master Schedule</h2>
					<div className="flex items-center gap-4">
						{availableDays.length > 1 && (
							<DaySelector
								availableDays={availableDays}
								selectedDay={selectedDay}
								onSelectDay={setSelectedDay}
							/>
						)}
						<CurrentTimeDisplay time={currentTime} timezone={timezone} />
					</div>
				</div>
				<div className="py-12 text-center">
					<Clock className="mx-auto mb-4 h-12 w-12 opacity-50" />
					<p className="mb-2 text-lg font-medium">No Events Scheduled</p>
					<p className="text-sm text-muted-foreground">
						{selectedDay === "today"
							? "No heats are scheduled for today. Try viewing all days."
							: "No heats match the selected filter."}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="rounded-2xl border border-black/10 bg-black/5 p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
			{/* Header */}
			<div className="mb-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
				<h2 className="text-2xl font-bold">Master Schedule</h2>
				<div className="flex flex-wrap items-center gap-4">
					{availableDays.length > 1 && (
						<DaySelector
							availableDays={availableDays}
							selectedDay={selectedDay}
							onSelectDay={setSelectedDay}
						/>
					)}
					<CurrentTimeDisplay time={currentTime} timezone={timezone} />
				</div>
			</div>

			{/* Venue Columns */}
			<div
				className={cn(
					"grid gap-6",
					venueSchedules.length === 1
						? "mx-auto grid-cols-1 lg:max-w-3xl"
						: venueSchedules.length === 2
							? "grid-cols-1 md:grid-cols-2"
							: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
				)}
			>
				{venueSchedules.map(({ venue, heats: venueHeats }) => (
					<Card key={venue.id} className="overflow-hidden">
						<CardHeader className="bg-gradient-to-r from-orange-600 to-orange-500 py-4 text-white">
							<CardTitle className="flex items-center justify-between">
								<span className="flex items-center gap-2">
									<MapPin className="h-5 w-5" />
									{venue.name}
								</span>
								<Badge
									variant="secondary"
									className="border-0 bg-white/20 text-white"
								>
									{venue.laneCount} lanes
								</Badge>
							</CardTitle>
							{venue.address?.city && (
								<p className="text-sm text-white/80">
									{venue.address.city}
									{venue.address.state ? `, ${venue.address.state}` : ""}
								</p>
							)}
						</CardHeader>
						<CardContent className="max-h-[600px] overflow-y-auto p-0">
							<div className="divide-y">
								{venueHeats.map(({ heat, event, status }) => (
									<HeatRow
										key={heat.id}
										heat={heat}
										event={event}
										status={status}
										laneCount={venue.laneCount}
										timezone={timezone}
									/>
								))}
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}

interface DaySelectorProps {
	availableDays: DayOption[]
	selectedDay: string
	onSelectDay: (day: string) => void
}

function DaySelector({
	availableDays,
	selectedDay,
	onSelectDay,
}: DaySelectorProps) {
	return (
		<div className="flex gap-1 overflow-x-auto rounded-lg border p-1">
			<button
				type="button"
				onClick={() => onSelectDay("today")}
				className={cn(
					"whitespace-nowrap rounded px-3 py-1 text-sm font-medium transition-colors",
					selectedDay === "today"
						? "bg-orange-500 text-white"
						: "hover:bg-muted",
				)}
			>
				Today
			</button>
			<button
				type="button"
				onClick={() => onSelectDay("all")}
				className={cn(
					"whitespace-nowrap rounded px-3 py-1 text-sm font-medium transition-colors",
					selectedDay === "all" ? "bg-orange-500 text-white" : "hover:bg-muted",
				)}
			>
				All
			</button>
			{availableDays.map((day) => (
				<button
					key={day.dateKey}
					type="button"
					onClick={() => onSelectDay(day.dateKey)}
					className={cn(
						"whitespace-nowrap rounded px-3 py-1 text-sm font-medium transition-colors",
						selectedDay === day.dateKey
							? "bg-orange-500 text-white"
							: "hover:bg-muted",
					)}
				>
					{day.shortLabel}
				</button>
			))}
		</div>
	)
}

interface CurrentTimeDisplayProps {
	time: Date
	timezone: string
}

function CurrentTimeDisplay({ time, timezone }: CurrentTimeDisplayProps) {
	return (
		<div className="flex items-center gap-2 font-mono text-lg tabular-nums">
			<Clock className="h-5 w-5" />
			{formatCurrentTime(time, timezone)}
		</div>
	)
}

interface HeatRowProps {
	heat: HeatWithAssignments
	event: CompetitionWorkout
	status: HeatStatus
	laneCount: number
	timezone: string
}

function HeatRow({ heat, event, status, laneCount, timezone }: HeatRowProps) {
	// Past heats are collapsed by default
	const [isExpanded, setIsExpanded] = useState(status !== "past")

	const statusStyles: Record<HeatStatus, string> = {
		past: "opacity-50",
		current: "border-l-4 border-l-green-500 bg-green-500/10",
		next: "border-l-4 border-l-orange-500 bg-orange-500/10",
		upcoming: "",
	}

	const statusBadge: Record<HeatStatus, React.ReactNode> = {
		past: null,
		current: (
			<Badge className="animate-pulse bg-green-500 text-white">NOW</Badge>
		),
		next: <Badge className="bg-orange-500 text-white">UP NEXT</Badge>,
		upcoming: null,
	}

	// Calculate division breakdown
	const divisionCounts = heat.assignments.reduce(
		(acc, a) => {
			const div = a.registration.division?.label ?? "No Div"
			acc[div] = (acc[div] ?? 0) + 1
			return acc
		},
		{} as Record<string, number>,
	)
	const divisionEntries = Object.entries(divisionCounts)
	const divisionSummary =
		divisionEntries.length === 1
			? divisionEntries[0]?.[0]
			: divisionEntries.length > 0
				? divisionEntries
						.map(([label, count]) => `${count} ${label}`)
						.join(", ")
				: null

	return (
		<div className={cn("p-4", statusStyles[status])}>
			{/* Heat Header */}
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className={cn(
					"flex w-full items-center justify-between text-left",
					isExpanded && "mb-3",
				)}
			>
				<div className="flex items-center gap-2">
					{status === "past" && (
						isExpanded ? (
							<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
						) : (
							<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
						)
					)}
					<div className="flex flex-col">
						<span className="font-semibold">
							Event {event.trackOrder}: {event.workout.name}
						</span>
						<span className="text-sm text-muted-foreground">
							Heat {heat.heatNumber}
							{heat.scheduledTime && (
								<>
									{" "}
									&middot;{" "}
									<span className="tabular-nums">
										{formatTime(toDate(heat.scheduledTime), timezone)}
									</span>
								</>
							)}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{divisionSummary && (
						<Badge variant="outline" className="text-xs">
							{divisionSummary}
						</Badge>
					)}
					{statusBadge[status]}
				</div>
			</button>

			{/* Lane Assignments - only show when expanded */}
			{isExpanded && (
				heat.assignments.length > 0 ? (
					<div className="grid gap-1 sm:grid-cols-2">
						{Array.from({ length: laneCount }, (_, i) => i + 1).map(
							(laneNumber) => {
								const assignment = heat.assignments.find(
									(a) => a.laneNumber === laneNumber,
								)

								if (!assignment) {
									return (
										<div
											key={laneNumber}
											className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1"
										>
											<div className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-bold tabular-nums text-muted-foreground">
												{laneNumber}
											</div>
											<span className="text-sm italic text-muted-foreground">
												Empty
											</span>
										</div>
									)
								}

								const name = getCompetitorName(assignment.registration)

								return (
									<div
										key={laneNumber}
										className="flex items-center gap-2 rounded border bg-card px-2 py-1"
									>
										<div
											className={cn(
												"flex h-6 w-6 items-center justify-center rounded text-xs font-bold tabular-nums",
												status === "current" || status === "next"
													? "bg-orange-500 text-white"
													: "bg-muted",
											)}
										>
											{laneNumber}
										</div>
										<div className="min-w-0 flex-1">
											<span className="block truncate text-sm font-medium">
												{name}
											</span>
										</div>
										{assignment.registration.division && (
											<Badge variant="outline" className="shrink-0 text-xs">
												{assignment.registration.division.label}
											</Badge>
										)}
									</div>
								)
							},
						)}
					</div>
				) : (
					<div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
						<Users className="h-4 w-4" />
						<span>No lane assignments yet</span>
					</div>
				)
			)}
		</div>
	)
}
