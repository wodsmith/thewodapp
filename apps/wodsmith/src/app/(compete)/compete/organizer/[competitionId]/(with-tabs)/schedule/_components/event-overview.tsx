"use client"

import { useMemo } from "react"
import { Clock } from "lucide-react"
import type { CompetitionWorkout } from "@/server/competition-workouts"
import type { HeatWithAssignments } from "@/server/competition-heats"

interface EventOverviewProps {
	events: CompetitionWorkout[]
	heats: HeatWithAssignments[]
}

interface EventSummary {
	event: CompetitionWorkout
	heatCount: number
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

export function EventOverview({ events, heats }: EventOverviewProps) {
	const dayGroups = useMemo<DayGroup[]>(() => {
		const summaries: EventSummary[] = events
			.map((event) => {
				const eventHeats = heats.filter(
					(h) => h.trackWorkoutId === event.id && h.scheduledTime,
				)

				if (eventHeats.length === 0) {
					return {
						event,
						heatCount: heats.filter((h) => h.trackWorkoutId === event.id)
							.length,
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
					return { event, heatCount: eventHeats.length, startTime: null, endTime: null }
				}

				const startTime = toDate(firstHeat.scheduledTime)

				// End time = last heat start + duration (default 8 min if not set)
				const lastHeatDuration = lastHeat.durationMinutes ?? 8
				const endTime = toDate(lastHeat.scheduledTime)
				endTime.setMinutes(endTime.getMinutes() + lastHeatDuration)

				return {
					event,
					heatCount: heats.filter((h) => h.trackWorkoutId === event.id).length,
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
	}, [events, heats])

	if (events.length === 0) return null

	const hasScheduledHeats = dayGroups.some(
		(g) => g.dateKey !== "unscheduled" && g.summaries.length > 0,
	)
	if (!hasScheduledHeats) return null

	return (
		<div className="mb-6 rounded-lg border bg-muted/30 p-4">
			<div className="flex items-center gap-2 mb-3">
				<Clock className="h-4 w-4 text-muted-foreground" />
				<h3 className="font-medium text-sm">Schedule Overview</h3>
			</div>
			<div className="space-y-4">
				{dayGroups.map((group) => (
					<div key={group.dateKey}>
						<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
							{group.label}
						</h4>
						<div className="space-y-1.5">
							{group.summaries.map((summary) => (
								<div
									key={summary.event.id}
									className="flex items-center gap-3 text-sm tabular-nums"
								>
									<span className="text-muted-foreground w-6 text-right">
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
											<span className="text-muted-foreground w-16 text-right">
												{summary.heatCount} heat
												{summary.heatCount !== 1 ? "s" : ""}
											</span>
										</>
									) : (
										<span className="text-muted-foreground italic">
											{summary.heatCount > 0
												? `${summary.heatCount} heat${summary.heatCount !== 1 ? "s" : ""}`
												: "No heats"}
										</span>
									)}
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
