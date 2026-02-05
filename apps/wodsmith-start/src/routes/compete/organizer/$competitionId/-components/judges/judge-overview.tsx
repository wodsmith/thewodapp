"use client"

import { Clock } from "lucide-react"
import { useMemo } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"
import type { JudgeHeatAssignment } from "@/server-fns/judge-scheduling-fns"

interface JudgeOverviewProps {
	events: CompetitionWorkout[]
	heats: HeatWithAssignments[]
	judgeAssignments: JudgeHeatAssignment[]
	filterEmptyLanes: boolean
	onFilterEmptyLanesChange: (value: boolean) => void
}

interface EventSummary {
	event: CompetitionWorkout
	heatCount: number
	assignedJudges: number
	totalRequiredJudges: number // Based on lane count
	startTime: Date | null
	endTime: Date | null
}

interface DayGroup {
	dateKey: string
	label: string
	summaries: EventSummary[]
}

function formatTime(date: Date): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	})
}

function formatDayLabel(date: Date): string {
	return date.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	})
}

function getDateKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function toDate(value: Date | string | number): Date {
	if (value instanceof Date) return new Date(value.getTime())
	return new Date(value)
}

/**
 * Shows judge assignment progress per event.
 * Displays how many judges are assigned vs how many are needed based on lane count.
 */
export function JudgeOverview({
	events,
	heats,
	judgeAssignments,
	filterEmptyLanes,
	onFilterEmptyLanesChange,
}: JudgeOverviewProps) {
	// Compute occupied lanes per heat from athlete assignments
	// Key by heat ID instead of heat number to handle multiple events correctly
	const occupiedLanesByHeatId = useMemo(() => {
		const map = new Map<string, Set<number>>()
		for (const heat of heats) {
			const occupiedLanes = new Set<number>()
			for (const assignment of heat.assignments) {
				occupiedLanes.add(assignment.laneNumber)
			}
			map.set(heat.id, occupiedLanes)
		}
		return map
	}, [heats])

	const dayGroups = useMemo<DayGroup[]>(() => {
		const summaries: EventSummary[] = events
			.map((event) => {
				const eventHeats = heats.filter(
					(h) => h.trackWorkoutId === event.id && h.scheduledTime,
				)

				// Get judge assignments for this event
				const eventJudgeAssignments = judgeAssignments.filter((ja) =>
					heats.find(
						(h) => h.id === ja.heatId && h.trackWorkoutId === event.id,
					),
				)

				// Calculate total required judges (one per lane per heat)
				const totalRequiredJudges = heats
					.filter((h) => h.trackWorkoutId === event.id)
					.reduce((sum, heat) => {
						const laneCount = heat.venue?.laneCount ?? 10
						if (filterEmptyLanes) {
							const occupiedLanes = occupiedLanesByHeatId.get(heat.id)
							return sum + (occupiedLanes?.size ?? 0)
						}
						return sum + laneCount
					}, 0)

				if (eventHeats.length === 0) {
					return {
						event,
						heatCount: heats.filter((h) => h.trackWorkoutId === event.id)
							.length,
						assignedJudges: eventJudgeAssignments.length,
						totalRequiredJudges,
						startTime: null,
						endTime: null,
					}
				}

				// Sort by scheduled time
				const sortedHeats = eventHeats.sort((a, b) => {
					const aTime = a.scheduledTime ? toDate(a.scheduledTime).getTime() : 0
					const bTime = b.scheduledTime ? toDate(b.scheduledTime).getTime() : 0
					return aTime - bTime
				})

				const firstHeat = sortedHeats[0]
				const lastHeat = sortedHeats[sortedHeats.length - 1]

				if (!firstHeat?.scheduledTime || !lastHeat?.scheduledTime) {
					return {
						event,
						heatCount: eventHeats.length,
						assignedJudges: eventJudgeAssignments.length,
						totalRequiredJudges,
						startTime: null,
						endTime: null,
					}
				}

				const startTime = toDate(firstHeat.scheduledTime)

				// End time = last heat start + duration (default 15 min if not set)
				const lastHeatDuration = lastHeat.durationMinutes ?? 15
				const endTime = toDate(lastHeat.scheduledTime)
				endTime.setMinutes(endTime.getMinutes() + lastHeatDuration)

				return {
					event,
					heatCount: heats.filter((h) => h.trackWorkoutId === event.id).length,
					assignedJudges: eventJudgeAssignments.length,
					totalRequiredJudges,
					startTime,
					endTime,
				}
			})
			.sort((a, b) => {
				// Sort by start time first, then by track order
				if (a.startTime && b.startTime) {
					const timeDiff = a.startTime.getTime() - b.startTime.getTime()
					if (timeDiff !== 0) return timeDiff
				}
				// Unscheduled events go last
				if (a.startTime && !b.startTime) return -1
				if (!a.startTime && b.startTime) return 1
				return a.event.trackOrder - b.event.trackOrder
			})

		// Group by day
		const groups = new Map<string, DayGroup>()

		for (const summary of summaries) {
			const dateKey = summary.startTime
				? getDateKey(summary.startTime)
				: "unscheduled"
			const label = summary.startTime
				? formatDayLabel(summary.startTime)
				: "Unscheduled"

			const existing = groups.get(dateKey)
			if (existing) {
				existing.summaries.push(summary)
			} else {
				groups.set(dateKey, { dateKey, label, summaries: [summary] })
			}
		}

		return Array.from(groups.values())
	}, [events, heats, judgeAssignments, filterEmptyLanes, occupiedLanesByHeatId])

	if (events.length === 0) return null

	const hasScheduledHeats = dayGroups.some(
		(g) => g.dateKey !== "unscheduled" && g.summaries.length > 0,
	)
	if (!hasScheduledHeats) return null

	return (
		<div className="mb-6 rounded-lg border bg-muted/30 p-4">
			<div className="mb-3 flex items-center gap-2">
				<Clock className="h-4 w-4 text-muted-foreground" />
				<h3 className="text-sm font-medium">Judge Assignment Overview</h3>
				<div className="ml-auto flex items-center gap-2">
					<Checkbox
						id="filter-empty-lanes-overview"
						checked={filterEmptyLanes}
						onCheckedChange={(checked) =>
							onFilterEmptyLanesChange(checked === true)
						}
					/>
					<label
						htmlFor="filter-empty-lanes-overview"
						className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
					>
						Only show lanes with athletes
					</label>
				</div>
			</div>
			<div className="space-y-4">
				{dayGroups.map((group) => (
					<div key={group.dateKey}>
						<h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{group.label}
						</h4>
						<div className="space-y-1.5">
							{group.summaries.map((summary) => {
								const isFullyStaffed =
									summary.assignedJudges >= summary.totalRequiredJudges
								const progressPercent =
									summary.totalRequiredJudges > 0
										? Math.round(
												(summary.assignedJudges / summary.totalRequiredJudges) *
													100,
											)
										: 0

								return (
									<div
										key={summary.event.id}
										className="flex items-center gap-3 text-sm tabular-nums"
									>
										<span className="w-6 text-right text-muted-foreground">
											{String(summary.event.trackOrder).padStart(2, "0")}
										</span>
										<span className="flex-1 truncate font-sans">
											{summary.event.workout.name}
										</span>
										{summary.startTime && summary.endTime ? (
											<>
												<span className="text-muted-foreground">
													{formatTime(summary.startTime)}-
													{formatTime(summary.endTime)}
												</span>
												<span
													className={`w-24 text-right ${
														isFullyStaffed
															? "font-medium text-green-600"
															: "text-orange-600"
													}`}
												>
													{summary.assignedJudges}/{summary.totalRequiredJudges}{" "}
													judges
												</span>
												<span className="w-12 text-right text-xs text-muted-foreground">
													{progressPercent}%
												</span>
											</>
										) : (
											<span className="italic text-muted-foreground">
												{summary.heatCount > 0
													? `${summary.heatCount} heat${summary.heatCount !== 1 ? "s" : ""} - ${summary.assignedJudges}/${summary.totalRequiredJudges} judges`
													: "No heats"}
											</span>
										)}
									</div>
								)
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
