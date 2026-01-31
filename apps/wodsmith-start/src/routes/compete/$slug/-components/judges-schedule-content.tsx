"use client"

import { Clock, MapPin, User } from "lucide-react"
import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { JudgesScheduleEvent } from "@/server-fns/judge-scheduling-fns"

interface JudgesScheduleContentProps {
	competitionName: string
	events: JudgesScheduleEvent[]
	timezone: string
}

interface DayGroup {
	dateKey: string
	label: string
	events: JudgesScheduleEvent[]
}

function toDate(value: Date | string | number): Date {
	if (value instanceof Date) return new Date(value.getTime())
	return new Date(value)
}

function getDateKey(date: Date, timezone: string): string {
	const formatter = new Intl.DateTimeFormat("sv-SE", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	})
	return formatter.format(date)
}

function formatDayLabel(date: Date, timezone: string): string {
	return date.toLocaleDateString("en-US", {
		timeZone: timezone,
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	})
}

function formatTime(date: Date, timezone: string): string {
	return date.toLocaleTimeString("en-US", {
		timeZone: timezone,
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	})
}

function getJudgeName(
	firstName: string | null,
	lastName: string | null,
): string {
	const name = `${firstName ?? ""} ${lastName ?? ""}`.trim()
	return name || "Unknown"
}

export function JudgesScheduleContent({
	competitionName,
	events,
	timezone,
}: JudgesScheduleContentProps) {
	// Group events by day
	const dayGroups = useMemo(() => {
		const groups = new Map<string, DayGroup>()

		for (const event of events) {
			// Find the first heat's scheduled time for grouping
			const firstHeat = event.heats.find((h) => h.scheduledTime)
			const dateKey = firstHeat?.scheduledTime
				? getDateKey(toDate(firstHeat.scheduledTime), timezone)
				: "unscheduled"
			const label = firstHeat?.scheduledTime
				? formatDayLabel(toDate(firstHeat.scheduledTime), timezone)
				: "Unscheduled"

			const existing = groups.get(dateKey)
			if (existing) {
				existing.events.push(event)
			} else {
				groups.set(dateKey, { dateKey, label, events: [event] })
			}
		}

		// Sort days chronologically
		return Array.from(groups.values()).sort((a, b) => {
			if (a.dateKey === "unscheduled") return 1
			if (b.dateKey === "unscheduled") return -1
			return a.dateKey.localeCompare(b.dateKey)
		})
	}, [events, timezone])

	// Empty state
	if (events.length === 0) {
		return (
			<div className="space-y-6">
				<div className="text-center print:text-left">
					<h1 className="text-3xl font-bold mb-2 print:text-2xl">
						Judges Schedule
					</h1>
					<p className="text-muted-foreground">{competitionName}</p>
				</div>
				<Card className="border-dashed">
					<CardContent className="py-12 text-center text-muted-foreground">
						<User className="h-12 w-12 mx-auto mb-4 opacity-50" />
						<p className="text-lg font-medium mb-2">
							No Judges Schedule Available
						</p>
						<p className="text-sm">
							The judges schedule for this competition hasn't been published
							yet.
						</p>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="space-y-8 print:space-y-4">
			{/* Header */}
			<div className="text-center print:text-left print:border-b print:pb-4">
				<h1 className="text-3xl font-bold mb-2 print:text-2xl">
					Judges Schedule
				</h1>
				<p className="text-muted-foreground print:text-sm">{competitionName}</p>
			</div>

			{/* Schedule by day */}
			{dayGroups.map((dayGroup) => (
				<div
					key={dayGroup.dateKey}
					className="space-y-6 print:space-y-3 print:break-inside-avoid-page"
				>
					{/* Day header */}
					<h2 className="text-xl font-semibold border-b pb-2 print:text-lg print:pb-1">
						{dayGroup.label}
					</h2>

					{/* Events for this day */}
					{dayGroup.events.map((event) => (
						<Card
							key={event.trackWorkoutId}
							className="print:shadow-none print:border print:break-inside-avoid"
						>
							<CardHeader className="pb-3 print:pb-2">
								<CardTitle className="flex items-center gap-3 print:text-base">
									<span className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-500 rounded-lg flex items-center justify-center print:w-8 print:h-8">
										<span className="text-white text-sm font-bold tabular-nums print:text-xs">
											{String(event.trackOrder).padStart(2, "0")}
										</span>
									</span>
									<span>{event.eventName}</span>
								</CardTitle>
							</CardHeader>
							<CardContent className="print:pt-0">
								{/* Heats table */}
								<div className="overflow-x-auto">
									<table className="w-full text-sm print:text-xs">
										<thead>
											<tr className="border-b">
												<th className="text-left py-2 px-2 font-medium print:py-1">
													Heat
												</th>
												<th className="text-left py-2 px-2 font-medium print:py-1">
													Time
												</th>
												<th className="text-left py-2 px-2 font-medium print:py-1">
													Floor
												</th>
												<th className="text-left py-2 px-2 font-medium print:py-1">
													Division
												</th>
												<th className="text-left py-2 px-2 font-medium print:py-1">
													Judges
												</th>
											</tr>
										</thead>
										<tbody className="divide-y">
											{event.heats.map((heat) => {
												// Get unique divisions from lane assignments
												const divisionLabels = [
													...new Set(
														heat.laneAssignments
															.map((la) => la.division?.label)
															.filter(Boolean),
													),
												]
												const divisionDisplay =
													heat.division?.label ||
													(divisionLabels.length > 0
														? divisionLabels.join(", ")
														: "Mixed")

												return (
													<tr
														key={heat.id}
														className="print:break-inside-avoid"
													>
														<td className="py-2 px-2 font-medium tabular-nums print:py-1">
															Heat {heat.heatNumber}
														</td>
														<td className="py-2 px-2 tabular-nums print:py-1">
															{heat.scheduledTime ? (
																<span className="flex items-center gap-1">
																	<Clock className="h-3 w-3 text-muted-foreground print:hidden" />
																	{formatTime(
																		toDate(heat.scheduledTime),
																		timezone,
																	)}
																</span>
															) : (
																<span className="text-muted-foreground">
																	TBD
																</span>
															)}
														</td>
														<td className="py-2 px-2 print:py-1">
															{heat.venue ? (
																<span className="flex items-center gap-1">
																	<MapPin className="h-3 w-3 text-muted-foreground print:hidden" />
																	{heat.venue.name}
																</span>
															) : (
																<span className="text-muted-foreground">—</span>
															)}
														</td>
														<td className="py-2 px-2 print:py-1">
															<Badge
																variant="outline"
																className="text-xs print:border-gray-400"
															>
																{divisionDisplay}
															</Badge>
														</td>
														<td className="py-2 px-2 print:py-1">
															{heat.judges.length > 0 ? (
																<div className="flex flex-wrap gap-1">
																	{heat.judges.map((judge) => (
																		<span
																			key={judge.assignmentId}
																			className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs print:bg-gray-100"
																		>
																			{judge.laneNumber && (
																				<span className="font-bold tabular-nums">
																					L{judge.laneNumber}:
																				</span>
																			)}
																			{getJudgeName(
																				judge.firstName,
																				judge.lastName,
																			)}
																		</span>
																	))}
																</div>
															) : (
																<span className="text-muted-foreground text-xs">
																	No judges assigned
																</span>
															)}
														</td>
													</tr>
												)
											})}
										</tbody>
									</table>
								</div>

								{/* Lane-Division summary for printing */}
								{event.heats.some((h) => h.laneAssignments.length > 0) && (
									<div className="mt-4 pt-4 border-t print:mt-2 print:pt-2">
										<h4 className="text-sm font-medium mb-2 print:text-xs">
											Lane Divisions by Heat
										</h4>
										<div className="grid gap-2 text-xs print:gap-1">
											{event.heats
												.filter((h) => h.laneAssignments.length > 0)
												.map((heat) => (
													<div
														key={heat.id}
														className="flex flex-wrap items-center gap-2 print:gap-1"
													>
														<span className="font-medium tabular-nums w-16 print:w-12">
															Heat {heat.heatNumber}:
														</span>
														{heat.laneAssignments.map((la) => (
															<span
																key={`${heat.id}-${la.laneNumber}`}
																className="inline-flex items-center bg-muted/50 px-1.5 py-0.5 rounded print:bg-gray-50"
															>
																<span className="font-bold tabular-nums">
																	L{la.laneNumber}
																</span>
																{la.division && (
																	<span className="ml-1 text-muted-foreground">
																		{la.division.label}
																	</span>
																)}
															</span>
														))}
													</div>
												))}
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					))}
				</div>
			))}

			{/* Print footer */}
			<div className="hidden print:block text-center text-xs text-muted-foreground pt-4 border-t">
				<p>
					Generated on {new Date().toLocaleDateString()} at{" "}
					{new Date().toLocaleTimeString()}
				</p>
			</div>
		</div>
	)
}
