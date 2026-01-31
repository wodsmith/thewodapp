"use client"

import { ChevronDown, Clock, MapPin, Search, User, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"
import { cn } from "@/utils/cn"

interface SchedulePageContentProps {
	events: CompetitionWorkout[]
	heats: HeatWithAssignments[]
	currentUserId?: string
}

interface WorkoutSchedule {
	event: CompetitionWorkout
	heats: HeatWithAssignments[]
	startTime: Date | null
	endTime: Date | null
}

interface DayGroup {
	dateKey: string
	label: string
	shortLabel: string
	workouts: WorkoutSchedule[]
}

function toDate(value: Date | string | number): Date {
	if (value instanceof Date) return new Date(value.getTime())
	return new Date(value)
}

function getDateKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatDayLabel(date: Date): string {
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
	})
}

function formatShortDayLabel(date: Date): string {
	return date.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	})
}

function formatTime(date: Date): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	})
}

function formatTimeRange(start: Date | null, end: Date | null): string {
	if (!start || !end) return ""
	return `${formatTime(start)} - ${formatTime(end)}`
}

function getCompetitorName(
	registration: HeatWithAssignments["assignments"][0]["registration"],
): string {
	if (registration.teamName) return registration.teamName
	const { firstName, lastName } = registration.user
	const name = `${firstName ?? ""} ${lastName ?? ""}`.trim()
	return name || "Unknown"
}

export function SchedulePageContent({
	events,
	heats,
	currentUserId,
}: SchedulePageContentProps) {
	const [selectedTab, setSelectedTab] = useState<string>("all")
	const [searchTerm, setSearchTerm] = useState("")
	const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(
		new Set(),
	)
	const [expandedHeats, setExpandedHeats] = useState<Set<string>>(new Set())

	// Build day groups with workouts and their heats
	const { dayGroups, allDays } = useMemo(() => {
		// Build workout schedules with their heats
		const workoutSchedules: WorkoutSchedule[] = events.map((event) => {
			const eventHeats = heats.filter((h) => h.trackWorkoutId === event.id)

			// Get time range from heats
			const scheduledHeats = eventHeats.filter((h) => h.scheduledTime)
			let startTime: Date | null = null
			let endTime: Date | null = null

			if (scheduledHeats.length > 0) {
				const sortedHeats = scheduledHeats.sort((a, b) => {
					const aTime = a.scheduledTime ? toDate(a.scheduledTime).getTime() : 0
					const bTime = b.scheduledTime ? toDate(b.scheduledTime).getTime() : 0
					return aTime - bTime
				})
				const firstHeat = sortedHeats[0]
				const lastHeat = sortedHeats[sortedHeats.length - 1]

				if (firstHeat?.scheduledTime) {
					startTime = toDate(firstHeat.scheduledTime)
				}
				if (lastHeat?.scheduledTime) {
					endTime = toDate(lastHeat.scheduledTime)
				}
				// Add duration of last heat
				if (endTime && lastHeat) {
					const duration = lastHeat.durationMinutes ?? 8
					endTime.setMinutes(endTime.getMinutes() + duration)
				}
			}

			return { event, heats: eventHeats, startTime, endTime }
		})

		// Group by day
		const groups = new Map<string, DayGroup>()

		for (const workout of workoutSchedules) {
			const dateKey = workout.startTime
				? getDateKey(workout.startTime)
				: "unscheduled"
			const label = workout.startTime
				? formatDayLabel(workout.startTime)
				: "Unscheduled"
			const shortLabel = workout.startTime
				? formatShortDayLabel(workout.startTime)
				: "TBD"

			const existing = groups.get(dateKey)
			if (existing) {
				existing.workouts.push(workout)
			} else {
				groups.set(dateKey, { dateKey, label, shortLabel, workouts: [workout] })
			}
		}

		// Sort workouts within each day by start time
		for (const group of groups.values()) {
			group.workouts.sort((a, b) => {
				if (a.startTime && b.startTime) {
					return a.startTime.getTime() - b.startTime.getTime()
				}
				if (a.startTime) return -1
				if (b.startTime) return 1
				return a.event.trackOrder - b.event.trackOrder
			})
		}

		// Sort days chronologically
		const sortedGroups = Array.from(groups.values()).sort((a, b) => {
			if (a.dateKey === "unscheduled") return 1
			if (b.dateKey === "unscheduled") return -1
			return a.dateKey.localeCompare(b.dateKey)
		})

		return {
			dayGroups: sortedGroups,
			allDays: sortedGroups.filter((g) => g.dateKey !== "unscheduled"),
		}
	}, [events, heats])

	// Filter workouts and heats based on search term
	const filteredDayGroups = useMemo(() => {
		if (!searchTerm.trim()) {
			return selectedTab === "all"
				? dayGroups
				: dayGroups.filter((g) => g.dateKey === selectedTab)
		}

		const term = searchTerm.toLowerCase()

		const filtered = (
			selectedTab === "all"
				? dayGroups
				: dayGroups.filter((g) => g.dateKey === selectedTab)
		)
			.map((group) => {
				const filteredWorkouts = group.workouts
					.map((workout) => {
						// Only search published heats
						if (workout.event.heatStatus !== "published") return null

						// Filter heats that have matching competitors
						const matchingHeats = workout.heats.filter((heat) =>
							heat.assignments.some((a) => {
								const name = getCompetitorName(a.registration)
								const division = a.registration.division?.label ?? ""
								const affiliate = a.registration.affiliate ?? ""
								return (
									name.toLowerCase().includes(term) ||
									division.toLowerCase().includes(term) ||
									affiliate.toLowerCase().includes(term)
								)
							}),
						)

						if (matchingHeats.length === 0) return null
						return { ...workout, heats: matchingHeats }
					})
					.filter((w): w is WorkoutSchedule => w !== null)

				if (filteredWorkouts.length === 0) return null
				return { ...group, workouts: filteredWorkouts }
			})
			.filter((g): g is DayGroup => g !== null)

		return filtered
	}, [dayGroups, selectedTab, searchTerm])

	// Auto-expand when searching
	useEffect(() => {
		if (searchTerm.trim()) {
			const workoutIds = new Set<string>()
			const heatKeys = new Set<string>()

			for (const group of filteredDayGroups) {
				for (const workout of group.workouts) {
					workoutIds.add(workout.event.id)
					for (const heat of workout.heats) {
						heatKeys.add(`${workout.event.id}-${heat.id}`)
					}
				}
			}

			setExpandedWorkouts(workoutIds)
			setExpandedHeats(heatKeys)
		}
	}, [searchTerm, filteredDayGroups])

	const toggleWorkout = (workoutId: string) => {
		setExpandedWorkouts((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(workoutId)) {
				newSet.delete(workoutId)
				// Collapse all heats for this workout
				setExpandedHeats((heatSet) => {
					const newHeatSet = new Set(heatSet)
					for (const key of newHeatSet) {
						if (key.startsWith(`${workoutId}-`)) {
							newHeatSet.delete(key)
						}
					}
					return newHeatSet
				})
			} else {
				newSet.add(workoutId)
			}
			return newSet
		})
	}

	const toggleHeat = (workoutId: string, heatId: string) => {
		const key = `${workoutId}-${heatId}`
		setExpandedHeats((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(key)) {
				newSet.delete(key)
			} else {
				newSet.add(key)
			}
			return newSet
		})
	}

	const checkMatch = (text: string): boolean => {
		if (!searchTerm.trim()) return false
		return text.toLowerCase().includes(searchTerm.toLowerCase())
	}

	const isUserInHeat = (heat: HeatWithAssignments): boolean => {
		if (!currentUserId) return false
		return heat.assignments.some(
			(a) => a.registration.user.id === currentUserId,
		)
	}

	// Empty state
	if (heats.length === 0) {
		return (
			<div className="space-y-6">
				<h2 className="text-2xl font-bold">Schedule</h2>
				<Card className="border-dashed">
					<CardContent className="py-12 text-center text-muted-foreground">
						<Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
						<p className="text-lg font-medium mb-2">Schedule Coming Soon</p>
						<p className="text-sm">
							The heat schedule for this competition hasn't been published yet.
						</p>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Get user's heats (only from events with published heat status)
	const userHeats = currentUserId
		? heats.filter((heat) => {
				const event = events.find((e) => e.id === heat.trackWorkoutId)
				return isUserInHeat(heat) && event?.heatStatus === "published"
			})
		: []

	return (
		<div className="space-y-6">
			<h2 className="text-2xl font-bold">Schedule</h2>

			{/* My Heats Section */}
			{userHeats.length > 0 && (
				<section className="mb-8">
					<h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
						<User className="h-5 w-5" />
						My Heats
					</h3>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{userHeats.map((heat) => {
							const event = events.find((e) => e.id === heat.trackWorkoutId)
							const laneNumber = heat.assignments.find(
								(a) => a.registration.user.id === currentUserId,
							)?.laneNumber

							return (
								<Card
									key={heat.id}
									className="border-orange-500/50 bg-orange-500/5"
								>
									<CardContent className="py-4">
										<div className="flex justify-between items-start">
											<div>
												<p className="font-medium">
													Event{" "}
													<span className="tabular-nums">
														{event?.trackOrder}
													</span>
													: {event?.workout.name}
												</p>
												<p className="text-sm text-muted-foreground tabular-nums">
													Heat {heat.heatNumber}
													{laneNumber && ` • Lane ${laneNumber}`}
												</p>
											</div>
											{heat.scheduledTime && (
												<Badge variant="secondary">
													{formatTime(toDate(heat.scheduledTime))}
												</Badge>
											)}
										</div>
										{heat.venue && (
											<p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
												<MapPin className="h-3 w-3" />
												{heat.venue.name}
											</p>
										)}
									</CardContent>
								</Card>
							)
						})}
					</div>
				</section>
			)}

			{/* Search Bar */}
			<div className="max-w-xl mx-auto">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						type="text"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Search competitor, division, or affiliate..."
						className="pl-10 pr-10"
					/>
					{searchTerm && (
						<button
							type="button"
							onClick={() => setSearchTerm("")}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>
				{searchTerm && (
					<p className="text-sm text-muted-foreground mt-2 text-center">
						{filteredDayGroups.reduce(
							(acc, g) => acc + g.workouts.length,
							0,
						) === 0 ? (
							<span>No matches found for "{searchTerm}"</span>
						) : (
							<span className="text-orange-500">
								Found matches in{" "}
								{filteredDayGroups.reduce(
									(acc, g) => acc + g.workouts.length,
									0,
								)}{" "}
								workout
								{filteredDayGroups.reduce(
									(acc, g) => acc + g.workouts.length,
									0,
								) !== 1
									? "s"
									: ""}
							</span>
						)}
					</p>
				)}
			</div>

			{/* Day Tabs */}
			{allDays.length > 1 && (
				<div className="flex justify-center border-b">
					<button
						type="button"
						onClick={() => setSelectedTab("all")}
						className={cn(
							"px-4 py-2 text-sm font-medium transition-colors border-b-2",
							selectedTab === "all"
								? "border-orange-500 text-orange-500"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
					>
						All Days
					</button>
					{allDays.map((day) => (
						<button
							key={day.dateKey}
							type="button"
							onClick={() => setSelectedTab(day.dateKey)}
							className={cn(
								"px-4 py-2 text-sm font-medium transition-colors border-b-2",
								selectedTab === day.dateKey
									? "border-orange-500 text-orange-500"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)}
						>
							{day.shortLabel}
						</button>
					))}
				</div>
			)}

			{/* Schedule Content */}
			<div className="rounded-lg border overflow-hidden">
				<div className="max-h-[800px] overflow-y-auto">
					{filteredDayGroups.map((dayGroup) => (
						<div key={dayGroup.dateKey}>
							{/* Day Header */}
							<div className="sticky top-0 z-10 bg-muted px-4 py-2 border-b">
								<h3 className="text-sm font-semibold uppercase tracking-wide">
									{dayGroup.label}
								</h3>
							</div>

							{/* Workouts */}
							<div className="divide-y">
								{dayGroup.workouts.map((workout) => {
									const isExpanded = expandedWorkouts.has(workout.event.id)
									// Only show lane assignments if event is published and has assignments
									const hasLaneAssignments =
										workout.event.heatStatus === "published" &&
										workout.heats.some((h) => h.assignments.length > 0)

									return (
										<div key={workout.event.id}>
											{/* Workout Header */}
											<button
												type="button"
												onClick={() => toggleWorkout(workout.event.id)}
												className="w-full px-4 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
											>
												<div className="flex items-center gap-4 flex-1">
													<div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-500 rounded-lg flex items-center justify-center">
														<span className="text-white text-sm font-bold tabular-nums">
															{String(workout.event.trackOrder).padStart(
																2,
																"0",
															)}
														</span>
													</div>
													<div className="flex-1 min-w-0">
														<h4 className="font-semibold truncate">
															{workout.event.workout.name}
														</h4>
														<div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-muted-foreground">
															{workout.startTime && workout.endTime && (
																<span className="flex items-center gap-1">
																	<Clock className="h-3 w-3" />
																	{formatTimeRange(
																		workout.startTime,
																		workout.endTime,
																	)}
																</span>
															)}
															<Badge
																variant="outline"
																className="text-xs tabular-nums"
															>
																{workout.heats.length} heat
																{workout.heats.length !== 1 ? "s" : ""}
																{searchTerm ? " (filtered)" : ""}
															</Badge>
														</div>
													</div>
												</div>
												<ChevronDown
													className={cn(
														"h-5 w-5 text-muted-foreground transition-transform",
														isExpanded && "rotate-180",
													)}
												/>
											</button>

											{/* Heats */}
											{isExpanded && (
												<div className="bg-muted/30 border-t">
													{workout.heats
														.sort((a, b) => a.heatNumber - b.heatNumber)
														.map((heat) => {
															const heatKey = `${workout.event.id}-${heat.id}`
															const isHeatExpanded = expandedHeats.has(heatKey)
															// Only show user in heat if event is published
															const userInHeat =
																workout.event.heatStatus === "published" &&
																isUserInHeat(heat)

															// Calculate division breakdown
															const divisionCounts = heat.assignments.reduce(
																(acc, a) => {
																	const div =
																		a.registration.division?.label ?? "No Div"
																	acc[div] = (acc[div] ?? 0) + 1
																	return acc
																},
																{} as Record<string, number>,
															)
															const divisionEntries =
																Object.entries(divisionCounts)
															const divisionSummary =
																divisionEntries.length === 1
																	? divisionEntries[0]?.[0]
																	: divisionEntries
																			.map(
																				([label, count]) => `${count} ${label}`,
																			)
																			.join(", ")

															return (
																<div
																	key={heat.id}
																	className="border-b last:border-b-0"
																>
																	{/* Heat Header */}
																	<button
																		type="button"
																		onClick={() =>
																			hasLaneAssignments &&
																			toggleHeat(workout.event.id, heat.id)
																		}
																		disabled={!hasLaneAssignments}
																		className={cn(
																			"w-full px-4 sm:px-6 py-3 flex items-center justify-between text-left transition-colors gap-2",
																			hasLaneAssignments
																				? "hover:bg-muted/50 cursor-pointer"
																				: "cursor-default opacity-75",
																			userInHeat && "bg-orange-500/10",
																		)}
																	>
																		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
																			{/* Primary info - always visible */}
																			<span className="font-medium tabular-nums shrink-0">
																				Heat {heat.heatNumber}
																			</span>
																			{heat.scheduledTime && (
																				<span className="text-sm text-muted-foreground tabular-nums shrink-0">
																					{formatTime(
																						toDate(heat.scheduledTime),
																					)}
																				</span>
																			)}
																			{heat.venue && (
																				<span className="text-sm text-muted-foreground flex items-center gap-1 shrink-0">
																					<MapPin className="h-3 w-3" />
																					<span className="truncate max-w-[100px] sm:max-w-none">
																						{heat.venue.name}
																					</span>
																				</span>
																			)}
																			{/* Secondary info - badges */}
																			{divisionSummary &&
																				heat.assignments.length > 0 && (
																					<Badge
																						variant="outline"
																						className="text-[10px] sm:text-xs tabular-nums shrink-0"
																					>
																						{divisionSummary}
																					</Badge>
																				)}
																			{userInHeat && (
																				<Badge className="bg-orange-500 text-[10px] sm:text-xs shrink-0">
																					You're here
																				</Badge>
																			)}
																			{!hasLaneAssignments && (
																				<Badge
																					variant="outline"
																					className="text-[10px] sm:text-xs text-amber-500 border-amber-500 shrink-0"
																				>
																					{workout.event.heatStatus !==
																					"published"
																						? "Coming soon"
																						: "Pending"}
																				</Badge>
																			)}
																		</div>
																		{hasLaneAssignments && (
																			<ChevronDown
																				className={cn(
																					"h-4 w-4 text-muted-foreground transition-transform shrink-0",
																					isHeatExpanded && "rotate-180",
																				)}
																			/>
																		)}
																	</button>

																	{/* Lane Assignments */}
																	{isHeatExpanded &&
																		heat.assignments.length > 0 && (
																			<div className="px-6 py-3 bg-background/50">
																				{/* Mobile View - compact horizontal layout */}
																				<div className="grid gap-2 md:hidden">
																					{heat.assignments
																						.sort(
																							(a, b) =>
																								a.laneNumber - b.laneNumber,
																						)
																						.map((assignment) => {
																							const name = getCompetitorName(
																								assignment.registration,
																							)
																							const isUser =
																								currentUserId ===
																								assignment.registration.user.id
																							const isMatch =
																								checkMatch(name) ||
																								checkMatch(
																									assignment.registration
																										.division?.label ?? "",
																								) ||
																								checkMatch(
																									assignment.registration
																										.affiliate ?? "",
																								)

																							return (
																								<div
																									key={assignment.id}
																									className={cn(
																										"rounded-lg px-3 py-2 border flex items-center gap-3",
																										isMatch
																											? "bg-orange-500/10 border-orange-500"
																											: isUser
																												? "bg-orange-500/5 border-orange-500/50"
																												: "bg-card",
																									)}
																								>
																									{/* Lane number */}
																									<div
																										className={cn(
																											"w-8 h-8 rounded flex items-center justify-center text-sm font-bold tabular-nums shrink-0",
																											isMatch || isUser
																												? "bg-orange-500 text-white"
																												: "bg-muted",
																										)}
																									>
																										{assignment.laneNumber}
																									</div>
																									{/* Info */}
																									<div className="flex-1 min-w-0 flex items-center justify-between gap-2">
																										<div className="min-w-0">
																											<p className="font-medium text-sm truncate">
																												{name}
																											</p>
																											<p className="text-xs text-muted-foreground truncate">
																												{assignment.registration
																													.affiliate ||
																													"Independent"}
																											</p>
																										</div>
																										{assignment.registration
																											.division && (
																											<Badge
																												variant="outline"
																												className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-orange-500/50 text-orange-500"
																											>
																												{
																													assignment
																														.registration
																														.division.label
																												}
																											</Badge>
																										)}
																									</div>
																								</div>
																							)
																						})}
																				</div>

																				{/* Desktop View */}
																				<div className="hidden md:block space-y-1">
																					{/* Column Headers */}
																					<div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-4 items-center px-2 pb-1 border-b border-border/50 text-xs text-muted-foreground uppercase tracking-wide">
																						<span className="w-8 text-center">
																							Lane
																						</span>
																						<span>Athlete</span>
																						<span>Affiliate</span>
																						<span>Division</span>
																					</div>
																					{heat.assignments
																						.sort(
																							(a, b) =>
																								a.laneNumber - b.laneNumber,
																						)
																						.map((assignment) => {
																							const name = getCompetitorName(
																								assignment.registration,
																							)
																							const isUser =
																								currentUserId ===
																								assignment.registration.user.id
																							const isMatch =
																								checkMatch(name) ||
																								checkMatch(
																									assignment.registration
																										.division?.label ?? "",
																								) ||
																								checkMatch(
																									assignment.registration
																										.affiliate ?? "",
																								)

																							return (
																								<div
																									key={assignment.id}
																									className={cn(
																										"grid grid-cols-[auto_1fr_1fr_1fr] gap-4 items-center rounded p-2",
																										isMatch
																											? "bg-orange-500/10 border border-orange-500"
																											: isUser
																												? "bg-orange-500/5 border border-orange-500/50"
																												: "bg-card border",
																									)}
																								>
																									<div className="flex items-center gap-2">
																										<div
																											className={cn(
																												"w-8 h-8 rounded flex items-center justify-center text-sm font-bold tabular-nums",
																												isMatch || isUser
																													? "bg-orange-500 text-white"
																													: "bg-muted",
																											)}
																										>
																											{assignment.laneNumber}
																										</div>
																									</div>
																									<span className="font-medium text-sm truncate">
																										{name}
																									</span>
																									<span className="text-sm text-muted-foreground truncate">
																										{assignment.registration
																											.affiliate ||
																											"Independent"}
																									</span>
																									<span className="text-sm text-orange-500 truncate">
																										{assignment.registration
																											.division?.label || "—"}
																									</span>
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
											)}
										</div>
									)
								})}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
