/**
 * Game Day Timeline Component
 *
 * Live competition day view showing real-time heat schedule,
 * current/upcoming heats, and event progress.
 * Adapted from v0 competition-timeline component for light/dark mode support.
 */

import { useState, useEffect, useMemo } from "react"
import {
	Clock,
	MapPin,
	Flame,
	ChevronRight,
	Calendar,
	Users,
	ChevronDown,
	ChevronUp,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { CompetitionVenue, Sponsor } from "@/db/schema"
import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"

// ============================================================================
// Types
// ============================================================================

interface Competition {
	id: string
	name: string
	slug: string
	startDate: Date
	endDate: Date
}

interface Division {
	id: string
	label: string
	position: number
	registrationCount: number
}

interface CompetitionWorkout {
	id: string
	trackId: string
	workoutId: string
	trackOrder: number
	notes: string | null
	pointsMultiplier: number | null
	sponsorId: string | null
	workout: {
		id: string
		name: string
		description: string | null
	}
}

interface GameDayTimelineProps {
	competition: Competition
	venues: CompetitionVenue[]
	events: CompetitionWorkout[]
	heats: HeatWithAssignments[]
	divisions: Division[]
	sponsors: Sponsor[]
}

interface EventWithHeats {
	event: CompetitionWorkout
	heats: HeatWithAssignments[]
	sponsor: Sponsor | null
	startTime: Date | null
	endTime: Date | null
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get start of day in UTC.
 * Competition dates are stored as UTC midnight, so we need UTC-aware comparison.
 */
function startOfUTCDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	)
}

/**
 * Add days to a UTC date, preserving UTC midnight.
 */
function addUTCDays(date: Date, days: number): Date {
	return new Date(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate() + days,
		),
	)
}

/**
 * Check if two dates are the same UTC calendar day.
 */
function isSameUTCDay(date1: Date, date2: Date): boolean {
	return (
		date1.getUTCFullYear() === date2.getUTCFullYear() &&
		date1.getUTCMonth() === date2.getUTCMonth() &&
		date1.getUTCDate() === date2.getUTCDate()
	)
}

/**
 * Format a UTC date for display as day of week.
 */
function formatUTCDayOfWeek(date: Date): string {
	const days = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	]
	return days[date.getUTCDay()]!
}

/**
 * Format a UTC date as "MMM d" (e.g., "Jan 3").
 */
function formatUTCMonthDay(date: Date): string {
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	]
	return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`
}

function formatTime(date: Date): string {
	return format(date, "h:mm a")
}

function getDivisionColor(divisionLabel: string): string {
	const label = divisionLabel.toLowerCase()
	if (label.includes("rx")) return "bg-rose-500"
	if (label.includes("intermediate") || label.includes("scaled"))
		return "bg-amber-500"
	if (label.includes("rookie") || label.includes("beginner"))
		return "bg-emerald-500"
	if (label.includes("masters") || label.includes("master")) return "bg-sky-500"
	if (label.includes("teen")) return "bg-fuchsia-500"
	return "bg-muted-foreground"
}

function getDivisionBadgeStyle(divisionLabel: string): string {
	const label = divisionLabel.toLowerCase()
	if (label.includes("rx"))
		return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
	if (label.includes("intermediate") || label.includes("scaled"))
		return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
	if (label.includes("rookie") || label.includes("beginner"))
		return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
	if (label.includes("masters") || label.includes("master"))
		return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
	if (label.includes("teen"))
		return "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20"
	return "bg-muted text-muted-foreground"
}

/**
 * Get the division label for a heat.
 * First checks if the heat has a direct division assigned,
 * then falls back to deriving unique divisions from the heat's athlete assignments.
 */
function getHeatDivisionLabel(heat: HeatWithAssignments): string {
	// If heat has a direct division, use it
	if (heat.division?.label) {
		return heat.division.label
	}

	// Otherwise, derive from assignments
	const uniqueDivisions = new Map<string, string>()
	for (const assignment of heat.assignments) {
		if (assignment.registration.division) {
			uniqueDivisions.set(
				assignment.registration.division.id,
				assignment.registration.division.label,
			)
		}
	}

	if (uniqueDivisions.size === 0) {
		return "All Divisions"
	}

	if (uniqueDivisions.size === 1) {
		return [...uniqueDivisions.values()][0]!
	}

	// Multiple divisions - list them
	return [...uniqueDivisions.values()].join(", ")
}

/**
 * Get the primary division for styling purposes.
 * Returns the first division found (for color coding).
 */
function getHeatPrimaryDivision(
	heat: HeatWithAssignments,
): { id: string; label: string } | null {
	// If heat has a direct division, use it
	if (heat.division) {
		return heat.division
	}

	// Otherwise, get first division from assignments
	for (const assignment of heat.assignments) {
		if (assignment.registration.division) {
			return assignment.registration.division
		}
	}

	return null
}

// ============================================================================
// Component
// ============================================================================

export function GameDayTimeline({
	competition,
	venues,
	events,
	heats,
	divisions,
	sponsors,
}: GameDayTimelineProps) {
	const [currentTime, setCurrentTime] = useState(new Date())
	const [expandedEvent, setExpandedEvent] = useState<string | null>(null)

	// Update current time every second
	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentTime(new Date())
		}, 1000)
		return () => clearInterval(timer)
	}, [])

	// Create sponsor map for quick lookup
	const sponsorMap = useMemo(
		() => new Map(sponsors.map((s) => [s.id, s])),
		[sponsors],
	)

	// Create venue map for quick lookup
	const venueMap = useMemo(
		() => new Map(venues.map((v) => [v.id, v])),
		[venues],
	)

	// Group heats by event (trackWorkoutId) and calculate event times
	const eventsWithHeats = useMemo<EventWithHeats[]>(() => {
		const eventMap = new Map<string, HeatWithAssignments[]>()

		for (const heat of heats) {
			const existing = eventMap.get(heat.trackWorkoutId) ?? []
			existing.push(heat)
			eventMap.set(heat.trackWorkoutId, existing)
		}

		return events
			.map((event) => {
				const eventHeats = eventMap.get(event.id) ?? []
				// Sort heats by scheduled time, then by heat number
				eventHeats.sort((a, b) => {
					if (a.scheduledTime && b.scheduledTime) {
						return (
							new Date(a.scheduledTime).getTime() -
							new Date(b.scheduledTime).getTime()
						)
					}
					return a.heatNumber - b.heatNumber
				})

				// Calculate start and end times
				const scheduledHeats = eventHeats.filter((h) => h.scheduledTime)
				const startTime =
					scheduledHeats.length > 0
						? new Date(scheduledHeats[0]!.scheduledTime!)
						: null
				const lastHeat =
					scheduledHeats.length > 0
						? scheduledHeats[scheduledHeats.length - 1]
						: null
				const endTime =
					lastHeat?.scheduledTime && lastHeat?.durationMinutes
						? new Date(
								new Date(lastHeat.scheduledTime).getTime() +
									lastHeat.durationMinutes * 60 * 1000,
							)
						: lastHeat?.scheduledTime
							? new Date(
									new Date(lastHeat.scheduledTime).getTime() + 15 * 60 * 1000,
								)
							: null

				return {
					event,
					heats: eventHeats,
					sponsor: event.sponsorId
						? (sponsorMap.get(event.sponsorId) ?? null)
						: null,
					startTime,
					endTime,
				}
			})
			.filter((e) => e.heats.length > 0) // Only show events with heats
			.sort((a, b) => {
				// Sort by start time, then by track order
				if (a.startTime && b.startTime) {
					return a.startTime.getTime() - b.startTime.getTime()
				}
				if (a.startTime) return -1
				if (b.startTime) return 1
				return a.event.trackOrder - b.event.trackOrder
			})
	}, [events, heats, sponsorMap])

	// Get unique days from competition dates (using UTC since dates are stored as UTC midnight)
	const competitionDays = useMemo(() => {
		const days: Date[] = []
		let current = startOfUTCDay(new Date(competition.startDate))
		const end = startOfUTCDay(new Date(competition.endDate))

		while (current <= end) {
			days.push(current)
			current = addUTCDays(current, 1)
		}

		return days
	}, [competition.startDate, competition.endDate])

	// Find the current day (default to first day with events, or today if during competition)
	const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
		const today = startOfUTCDay(new Date())
		const idx = competitionDays.findIndex((d) => isSameUTCDay(d, today))
		return idx >= 0 ? idx : 0
	})

	// Reset selectedDayIndex if competitionDays changes and current index is out of bounds
	useEffect(() => {
		if (selectedDayIndex >= competitionDays.length) {
			setSelectedDayIndex(0)
		}
	}, [competitionDays.length, selectedDayIndex])

	const selectedDay = competitionDays[selectedDayIndex] ?? competitionDays[0]

	// Filter events for selected day
	// Heat times are actual timestamps in UTC, competition days are UTC calendar dates
	// We compare using UTC to avoid timezone issues
	const eventsForDay = useMemo(() => {
		if (!selectedDay) return eventsWithHeats
		return eventsWithHeats.filter((e) => {
			if (!e.startTime) return false
			// Compare the UTC date of the heat start time to the selected day
			return isSameUTCDay(e.startTime, selectedDay)
		})
	}, [eventsWithHeats, selectedDay])

	// Get event status
	const getEventStatus = (
		event: EventWithHeats,
	): "upcoming" | "live" | "completed" => {
		if (!event.startTime || !event.endTime) return "upcoming"
		if (currentTime < event.startTime) return "upcoming"
		if (currentTime >= event.endTime) return "completed"
		return "live"
	}

	// Get current heat for an event
	const getCurrentHeat = (
		event: EventWithHeats,
	): HeatWithAssignments | null => {
		return (
			event.heats.find((heat) => {
				if (!heat.scheduledTime) return false
				const heatStart = new Date(heat.scheduledTime)
				const heatEnd = new Date(
					heatStart.getTime() + (heat.durationMinutes ?? 15) * 60 * 1000,
				)
				return currentTime >= heatStart && currentTime < heatEnd
			}) ?? null
		)
	}

	// Get next heat for an event
	const getNextHeat = (event: EventWithHeats): HeatWithAssignments | null => {
		return (
			event.heats.find((heat) => {
				if (!heat.scheduledTime) return false
				return currentTime < new Date(heat.scheduledTime)
			}) ?? null
		)
	}

	// Get completed heats count
	const getCompletedHeatsCount = (event: EventWithHeats): number => {
		return event.heats.filter((heat) => {
			if (!heat.scheduledTime) return false
			const heatEnd = new Date(
				new Date(heat.scheduledTime).getTime() +
					(heat.durationMinutes ?? 15) * 60 * 1000,
			)
			return currentTime >= heatEnd
		}).length
	}

	// Find live events
	const liveEvents = eventsForDay.filter((e) => getEventStatus(e) === "live")

	if (eventsWithHeats.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Game Day</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="py-12 text-center">
						<Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
						<h3 className="mt-4 text-lg font-medium">No heats scheduled</h3>
						<p className="mt-2 text-sm text-muted-foreground">
							Create a heat schedule to see the game day timeline.
						</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-6">
			{/* Header with current time */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Game Day</h1>
					<p className="text-muted-foreground">
						Live competition timeline for {competition.name}
					</p>
				</div>
				<div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2">
					<div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
					<Clock className="h-4 w-4 text-muted-foreground" />
					<span className="font-mono text-sm">
						{format(currentTime, "h:mm:ss a")}
					</span>
				</div>
			</div>

			{/* Day Tabs */}
			{competitionDays.length > 1 && (
				<div className="flex gap-2 flex-wrap">
					{competitionDays.map((day, index) => (
						<Button
							key={day.toISOString()}
							type="button"
							variant={selectedDayIndex === index ? "default" : "outline"}
							size="sm"
							onClick={() => setSelectedDayIndex(index)}
							className="gap-2"
						>
							<Calendar className="h-4 w-4" />
							{formatUTCDayOfWeek(day)}
							<span className="text-xs opacity-70">
								{formatUTCMonthDay(day)}
							</span>
						</Button>
					))}
				</div>
			)}

			{/* Live Now Banner */}
			{liveEvents.length > 0 && (
				<div className="space-y-4">
					{liveEvents.map((eventData) => {
						const currentHeat = getCurrentHeat(eventData)
						const nextHeat = getNextHeat(eventData)
						const completedHeats = getCompletedHeatsCount(eventData)
						const totalHeats = eventData.heats.length

						return (
							<Card
								key={eventData.event.id}
								className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden"
							>
								<CardContent className="pt-6">
									<div className="relative">
										<div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-16 rounded-full bg-primary/10 blur-3xl" />
										<div className="relative">
											<div className="mb-4 flex items-center gap-3">
												<Badge className="gap-1 animate-pulse bg-primary text-primary-foreground hover:bg-primary/90">
													<Flame className="h-3 w-3" />
													LIVE NOW
												</Badge>
												<span className="text-sm text-muted-foreground">
													Event {eventData.event.trackOrder}
													{eventData.sponsor && ` • ${eventData.sponsor.name}`}
												</span>
											</div>
											<h2 className="mb-4 text-2xl font-bold">
												{eventData.event.workout.name}
											</h2>

											<div className="grid gap-4 md:grid-cols-2">
												{/* Current Heat */}
												<div className="rounded-xl bg-muted/50 p-4">
													<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
														Current Heat
													</p>
													{currentHeat ? (
														<div className="flex items-center justify-between">
															<div>
																<p className="text-lg font-semibold">
																	{getHeatDivisionLabel(currentHeat)}
																</p>
																<p className="text-sm text-muted-foreground">
																	Heat {currentHeat.heatNumber} of {totalHeats}
																</p>
															</div>
															{currentHeat.scheduledTime && (
																<div
																	className={cn(
																		"rounded-lg border px-3 py-1 text-sm font-medium",
																		getHeatPrimaryDivision(currentHeat)
																			? getDivisionBadgeStyle(
																					getHeatPrimaryDivision(currentHeat)!
																						.label,
																				)
																			: "bg-muted",
																	)}
																>
																	{formatTime(
																		new Date(currentHeat.scheduledTime),
																	)}
																</div>
															)}
														</div>
													) : (
														<p className="text-muted-foreground">
															Transitioning...
														</p>
													)}
												</div>

												{/* Up Next */}
												<div className="rounded-xl bg-muted/50 p-4">
													<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
														Up Next
													</p>
													{nextHeat ? (
														<div className="flex items-center justify-between">
															<div>
																<p className="text-lg font-semibold">
																	{getHeatDivisionLabel(nextHeat)}
																</p>
																<p className="text-sm text-muted-foreground">
																	Heat {nextHeat.heatNumber} of {totalHeats}
																</p>
															</div>
															{nextHeat.scheduledTime && (
																<div className="flex items-center gap-2 text-sm text-muted-foreground">
																	<ChevronRight className="h-4 w-4" />
																	{formatTime(new Date(nextHeat.scheduledTime))}
																</div>
															)}
														</div>
													) : (
														<p className="text-muted-foreground">
															Final heat in progress
														</p>
													)}
												</div>
											</div>

											{/* Progress Bar */}
											<div className="mt-4">
												<div className="mb-2 flex justify-between text-xs text-muted-foreground">
													<span>Progress</span>
													<span>
														{completedHeats}/{totalHeats} heats complete
													</span>
												</div>
												<Progress
													value={
														totalHeats > 0
															? (completedHeats / totalHeats) * 100
															: 0
													}
													className="h-2"
												/>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						)
					})}
				</div>
			)}

			{/* Timeline */}
			<Card>
				<CardHeader className="pb-4">
					<CardTitle className="flex items-center gap-2 text-lg">
						<Calendar className="h-5 w-5" />
						Full Schedule
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<div className="relative">
						{/* Continuous vertical timeline line */}
						<div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

						<div className="space-y-8">
							{eventsForDay.map((eventData) => {
								const status = getEventStatus(eventData)
								const isExpanded = expandedEvent === eventData.event.id
								const totalHeats = eventData.heats.length
								const venue = eventData.heats[0]?.venueId
									? venueMap.get(eventData.heats[0].venueId)
									: null

								// Get unique divisions for this event
								const eventDivisions = new Map<string, string>()
								for (const heat of eventData.heats) {
									const div = getHeatPrimaryDivision(heat)
									if (div) {
										eventDivisions.set(div.id, div.label)
									}
								}

								return (
									<div key={eventData.event.id} className="relative">
										<button
											type="button"
											onClick={() =>
												setExpandedEvent(isExpanded ? null : eventData.event.id)
											}
											className="w-full text-left group"
										>
											{/* Mobile: stacked layout, Desktop: horizontal layout */}
											<div className="flex gap-4 md:gap-6">
												{/* Timeline dot */}
												<div className="relative z-10 mt-1.5 shrink-0">
													<div
														className={cn(
															"h-4 w-4 rounded-full border-2 transition-all",
															status === "live" &&
																"bg-primary border-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.4)]",
															status === "completed" &&
																"bg-background border-muted-foreground/50",
															status === "upcoming" &&
																"bg-muted-foreground/30 border-muted-foreground/50",
														)}
													/>
												</div>

												{/* Content area - stacks on mobile, horizontal on desktop */}
												<div className="flex-1 min-w-0 pb-2">
													<div className="flex flex-col md:flex-row md:items-start md:gap-6">
														{/* Time column */}
														<div className="shrink-0 md:w-20 mb-1 md:mb-0">
															{eventData.startTime && (
																<div className="flex items-baseline gap-2 md:flex-col md:gap-0">
																	<p
																		className={cn(
																			"font-mono text-base md:text-lg font-semibold tabular-nums",
																			status === "live" && "text-primary",
																			status === "completed" &&
																				"text-muted-foreground",
																		)}
																	>
																		{format(eventData.startTime, "HH:mm")}
																	</p>
																	{eventData.endTime && (
																		<p className="font-mono text-sm text-muted-foreground tabular-nums">
																			{format(eventData.endTime, "HH:mm")}
																		</p>
																	)}
																</div>
															)}
														</div>

														{/* Event name and venue */}
														<div className="flex-1 min-w-0">
															<h3
																className={cn(
																	"text-base md:text-lg font-semibold transition-colors",
																	status === "live" && "text-foreground",
																	status === "completed" &&
																		"text-muted-foreground",
																	status === "upcoming" &&
																		"text-muted-foreground",
																)}
															>
																Event {eventData.event.trackOrder}:{" "}
																{eventData.event.workout.name}
															</h3>

															{/* Venue and type */}
															<div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground/70">
																{venue && (
																	<>
																		<MapPin className="h-3.5 w-3.5" />
																		<span>{venue.name}</span>
																		<span className="mx-1">·</span>
																	</>
																)}
																<span>Workout</span>
																{eventData.sponsor && (
																	<>
																		<span className="mx-1">·</span>
																		<span>{eventData.sponsor.name}</span>
																	</>
																)}
															</div>
														</div>

														{/* Division badges - inline on desktop */}
														{eventDivisions.size > 0 && (
															<div className="mt-2 md:mt-0 flex flex-wrap gap-2 md:justify-end md:flex-1">
																{[...eventDivisions.entries()].map(
																	([id, label]) => (
																		<Badge
																			key={id}
																			variant="outline"
																			className={cn(
																				"text-xs font-medium",
																				getDivisionBadgeStyle(label),
																			)}
																		>
																			{label}
																		</Badge>
																	),
																)}
															</div>
														)}

														{/* Heat count and expand - right aligned on desktop */}
														<div className="mt-2 md:mt-0 flex items-center gap-4 text-xs text-muted-foreground/60 md:shrink-0 md:ml-4">
															<span className="flex items-center gap-1">
																<Users className="h-3 w-3" />
																{totalHeats} heats
															</span>
															{isExpanded ? (
																<span className="flex items-center gap-1">
																	<ChevronUp className="h-3 w-3" />
																	<span className="hidden sm:inline">Hide</span>
																</span>
															) : (
																<span className="flex items-center gap-1 group-hover:text-muted-foreground transition-colors">
																	<ChevronDown className="h-3 w-3" />
																	<span className="hidden sm:inline">View</span>
																</span>
															)}
														</div>
													</div>
												</div>
											</div>
										</button>

										{/* Expanded Heat Schedule */}
										{isExpanded && (
											<div className="ml-10 mt-4 pl-6 border-l-2 border-muted">
												<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
													Heat Schedule
												</p>
												<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
													{eventData.heats.map((heat) => {
														const heatStart = heat.scheduledTime
															? new Date(heat.scheduledTime)
															: null
														// Use 15-minute default to match getCurrentHeat logic
														const heatEnd = heatStart
															? new Date(
																	heatStart.getTime() +
																		(heat.durationMinutes ?? 15) * 60 * 1000,
																)
															: null
														const isCurrentHeat =
															status === "live" &&
															heatStart &&
															heatEnd &&
															currentTime >= heatStart &&
															currentTime < heatEnd
														const isCompleted =
															heatEnd && currentTime >= heatEnd

														return (
															<div
																key={heat.id}
																className={cn(
																	"relative flex items-center gap-3 rounded-lg border p-3 transition-all",
																	isCurrentHeat &&
																		"border-primary/50 bg-primary/10",
																	isCompleted && "opacity-60",
																	!isCurrentHeat &&
																		!isCompleted &&
																		"bg-muted/30",
																)}
															>
																{isCurrentHeat && (
																	<div className="absolute -left-px top-1/2 h-8 w-1 -translate-y-1/2 rounded-r bg-primary" />
																)}
																<div
																	className={cn(
																		"h-2 w-2 shrink-0 rounded-full",
																		getHeatPrimaryDivision(heat)
																			? getDivisionColor(
																					getHeatPrimaryDivision(heat)!.label,
																				)
																			: "bg-muted-foreground",
																	)}
																/>
																<div className="flex-1 min-w-0">
																	<p className="text-sm font-medium truncate">
																		{getHeatDivisionLabel(heat)}
																	</p>
																	{heatStart && (
																		<p className="font-mono text-xs text-muted-foreground">
																			{formatTime(heatStart)}
																		</p>
																	)}
																</div>
																<div className="text-xs text-muted-foreground">
																	#{heat.heatNumber}
																</div>
															</div>
														)
													})}
												</div>
											</div>
										)}
									</div>
								)
							})}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Division Legend */}
			{divisions.length > 0 && (
				<Card>
					<CardContent className="pt-4">
						<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Division Legend
						</p>
						<div className="flex flex-wrap gap-3">
							{divisions.map((div) => (
								<div key={div.id} className="flex items-center gap-2">
									<div
										className={cn(
											"h-3 w-3 rounded-full",
											getDivisionColor(div.label),
										)}
									/>
									<span className="text-sm text-muted-foreground">
										{div.label}
									</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
