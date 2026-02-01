"use client"

import { Clock, MapPin, User } from "lucide-react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { JudgesScheduleEvent } from "@/server-fns/judge-scheduling-fns"
import { cn } from "@/utils/cn"

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
	const first = firstName ?? ""
	const last = lastName ?? ""
	if (!first && !last) return ""
	// Return first name + last initial for compactness on screen
	if (last) return `${first} ${last.charAt(0)}.`
	return first
}

function getFullJudgeName(
	firstName: string | null,
	lastName: string | null,
): string {
	const first = firstName ?? ""
	const last = lastName ?? ""
	return `${first} ${last}`.trim() || "Unknown"
}

// Chunk an array into smaller arrays of specified size
function chunkArray<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = []
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size))
	}
	return chunks
}

// Max lanes per row in print view
const PRINT_LANES_PER_ROW = 8

export function JudgesScheduleContent({
	competitionName,
	events,
	timezone,
}: JudgesScheduleContentProps) {
	// Group events by day, splitting events that span multiple days
	const dayGroups = useMemo(() => {
		const groups = new Map<string, DayGroup>()

		for (const event of events) {
			// Group this event's heats by their scheduled day
			const heatsByDay = new Map<
				string,
				{ label: string; heats: typeof event.heats }
			>()

			for (const heat of event.heats) {
				const dateKey = heat.scheduledTime
					? getDateKey(toDate(heat.scheduledTime), timezone)
					: "unscheduled"
				const label = heat.scheduledTime
					? formatDayLabel(toDate(heat.scheduledTime), timezone)
					: "Unscheduled"

				const existing = heatsByDay.get(dateKey)
				if (existing) {
					existing.heats.push(heat)
				} else {
					heatsByDay.set(dateKey, { label, heats: [heat] })
				}
			}

			// Create an event slice for each day that has heats
			for (const [dateKey, { label, heats }] of heatsByDay) {
				const eventSlice: JudgesScheduleEvent = {
					...event,
					heats,
				}

				const existingGroup = groups.get(dateKey)
				if (existingGroup) {
					existingGroup.events.push(eventSlice)
				} else {
					groups.set(dateKey, { dateKey, label, events: [eventSlice] })
				}
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
				<Card className="border-dashed print:hidden">
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
		<div className="space-y-8 print:space-y-0">
			{/* Screen Header - hidden on print */}
			<div className="text-center print:hidden">
				<h1 className="text-3xl font-bold mb-2">
					Judges Schedule
				</h1>
				<p className="text-muted-foreground">{competitionName}</p>
			</div>

			{/* Print Header - plain text, hidden on screen */}
			<div className="hidden print:block print:mb-4">
				<h1 className="text-xl font-bold">Judges Schedule</h1>
				<p className="text-sm text-gray-600">{competitionName}</p>
			</div>

			{/* Schedule by day */}
			{dayGroups.map((dayGroup) => (
				<div
					key={dayGroup.dateKey}
					className="space-y-6 print:space-y-0"
				>
					{/* Events for this day */}
					{dayGroup.events.map((event, eventIndex) => {
						// Find max lane count across all heats for this event
						const maxLanes = Math.max(
							...event.heats.map((h) => {
								const fromVenue = h.venue?.laneCount ?? 0
								const fromAssignments = Math.max(
									...h.laneAssignments.map((la) => la.laneNumber),
									0,
								)
								const fromJudges = Math.max(
									...h.judges.map((j) => j.laneNumber ?? 0),
									0,
								)
								return Math.max(fromVenue, fromAssignments, fromJudges)
							}),
							1,
						)

						// Check if this is the first event overall (to not add page break)
						const isFirstEvent = dayGroup.dateKey === dayGroups[0]?.dateKey && eventIndex === 0

						return (
							<div
								key={event.trackWorkoutId}
								className={cn(
									// Screen styles
									"print:block",
									// Print: each workout on its own page (except first)
									!isFirstEvent && "print:break-before-page",
								)}
							>
								{/* Screen View - Card layout */}
								<Card className="print:hidden overflow-hidden">
									<CardHeader className="pb-3">
										<CardTitle className="flex items-center gap-3">
											<span className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-500 rounded-lg flex items-center justify-center">
												<span className="text-white text-sm font-bold tabular-nums">
													{String(event.trackOrder).padStart(2, "0")}
												</span>
											</span>
											<span>{event.eventName}</span>
										</CardTitle>
									</CardHeader>
									<CardContent className="px-0 sm:px-6">
										{/* Heat rows */}
										<div className="space-y-4">
											{event.heats.map((heat) => {
												// Create a map of lane -> { judge, division }
												const laneData = new Map<
													number,
													{
														judge: (typeof heat.judges)[0] | null
														division: string | null
													}
												>()

												// Initialize all lanes
												for (let i = 1; i <= maxLanes; i++) {
													laneData.set(i, { judge: null, division: null })
												}

												// Fill in divisions from lane assignments
												for (const la of heat.laneAssignments) {
													const existing = laneData.get(la.laneNumber)
													if (existing) {
														existing.division = la.division?.label ?? null
													}
												}

												// Fill in judges
												for (const judge of heat.judges) {
													if (judge.laneNumber) {
														const existing = laneData.get(judge.laneNumber)
														if (existing) {
															existing.judge = judge
														}
													}
												}

												return (
													<div key={heat.id}>
														{/* Heat header - simple inline text */}
														<div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-1.5 text-sm">
															<span className="font-semibold tabular-nums">
																Heat {heat.heatNumber}
															</span>
															{heat.scheduledTime && (
																<span className="text-muted-foreground flex items-center gap-1">
																	<Clock className="h-3 w-3" />
																	{formatTime(
																		toDate(heat.scheduledTime),
																		timezone,
																	)}
																</span>
															)}
															{heat.venue && (
																<span className="text-muted-foreground flex items-center gap-1">
																	<MapPin className="h-3 w-3" />
																	{heat.venue.name}
																</span>
															)}
														</div>

														{/* Lane grid - wraps automatically */}
														<div
															className="grid gap-1 px-1 pb-2"
															style={{
																gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
															}}
														>
															{Array.from({ length: maxLanes }, (_, i) => {
																const lane = i + 1
																const data = laneData.get(lane)
																const hasJudge = !!data?.judge
																const hasDivision = !!data?.division

																return (
																	<div
																		key={lane}
																		className={cn(
																			"rounded-md border p-2 min-w-0",
																			hasJudge
																				? "bg-muted/50"
																				: "bg-muted/20 border-dashed",
																		)}
																	>
																		{/* Lane number */}
																		<div className="text-[10px] font-bold text-muted-foreground mb-1 tabular-nums">
																			Lane {lane}
																		</div>

																		{/* Judge name */}
																		<div className="min-h-[1.25rem]">
																			{hasJudge ? (
																				<p className="text-xs font-medium truncate">
																					{getJudgeName(
																						data.judge!.firstName,
																						data.judge!.lastName,
																					)}
																				</p>
																			) : (
																				<p className="text-xs text-muted-foreground/50">
																					—
																				</p>
																			)}
																		</div>

																		{/* Division */}
																		<div className="mt-1 min-h-[1rem]">
																			{hasDivision ? (
																				<span className="inline-block text-[10px] px-1 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium truncate max-w-full">
																					{data.division}
																				</span>
																			) : (
																				<span className="text-[10px] text-muted-foreground/50">
																					—
																				</span>
																			)}
																		</div>
																	</div>
																)
															})}
														</div>
													</div>
												)
											})}
										</div>

										{/* Legend for judges without lane assignments (floating judges) */}
										{event.heats.some((h) =>
											h.judges.some((j) => !j.laneNumber),
										) && (
											<div className="mt-4 pt-3 border-t px-4 sm:px-0">
												<h4 className="text-xs font-medium text-muted-foreground mb-2">
													Floating Judges (No Lane Assignment)
												</h4>
												<div className="flex flex-wrap gap-2">
													{event.heats.map((heat) =>
														heat.judges
															.filter((j) => !j.laneNumber)
															.map((judge) => (
																<div
																	key={judge.assignmentId}
																	className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded text-xs"
																>
																	<span className="font-medium tabular-nums">
																		H{heat.heatNumber}:
																	</span>
																	<span>
																		{getJudgeName(
																			judge.firstName,
																			judge.lastName,
																		) || "Unknown"}
																	</span>
																	{judge.position && (
																		<span className="text-muted-foreground">
																			({judge.position})
																		</span>
																	)}
																</div>
															)),
													)}
												</div>
											</div>
										)}
									</CardContent>
								</Card>

								{/* Print View - Table layout */}
								<div className="hidden print:block">
									{/* Event header for print - plain text */}
									<div className="mb-2 pb-1 border-b border-gray-400">
										<h2 className="text-base font-bold">
											Event {event.trackOrder}: {event.eventName}
										</h2>
										<p className="text-xs text-gray-600">{dayGroup.label}</p>
									</div>

									{/* Print tables - one per heat */}
									{event.heats.map((heat) => {
										// Create a map of lane -> { judge, division }
										const laneData = new Map<
											number,
											{
												judge: (typeof heat.judges)[0] | null
												division: string | null
											}
										>()

										// Initialize all lanes
										for (let i = 1; i <= maxLanes; i++) {
											laneData.set(i, { judge: null, division: null })
										}

										// Fill in divisions from lane assignments
										for (const la of heat.laneAssignments) {
											const existing = laneData.get(la.laneNumber)
											if (existing) {
												existing.division = la.division?.label ?? null
											}
										}

										// Fill in judges
										for (const judge of heat.judges) {
											if (judge.laneNumber) {
												const existing = laneData.get(judge.laneNumber)
												if (existing) {
													existing.judge = judge
												}
											}
										}

										// Chunk lanes into rows for print
										const allLanes = Array.from({ length: maxLanes }, (_, i) => i + 1)
										const laneChunks = chunkArray(allLanes, PRINT_LANES_PER_ROW)

										return (
											<div key={heat.id} className="mb-4 break-inside-avoid">
												{/* Heat header */}
												<div className="text-sm font-semibold mb-1">
													Heat {heat.heatNumber}
													{heat.scheduledTime && (
														<span className="font-normal text-gray-600">
															{" "}— {formatTime(toDate(heat.scheduledTime), timezone)}
														</span>
													)}
													{heat.venue && (
														<span className="font-normal text-gray-600">
															{" "}— {heat.venue.name}
														</span>
													)}
												</div>

												{/* Lane tables - chunked into rows */}
												{laneChunks.map((laneChunk, chunkIndex) => (
													<table key={chunkIndex} className="w-full border-collapse text-sm mb-2">
														<thead>
															<tr className="bg-gray-100">
																{laneChunk.map((lane) => (
																	<th
																		key={lane}
																		className="border border-gray-300 px-2 py-1 text-center font-semibold"
																	>
																		Lane {lane}
																	</th>
																))}
															</tr>
														</thead>
														<tbody>
															<tr>
																{laneChunk.map((lane) => {
																	const data = laneData.get(lane)
																	const hasJudge = !!data?.judge
																	const hasDivision = !!data?.division

																	return (
																		<td
																			key={lane}
																			className={cn(
																				"border border-gray-300 px-2 py-2 text-center align-top",
																				!hasJudge && "bg-gray-50 text-gray-400",
																			)}
																		>
																			{hasJudge ? (
																				<div>
																					<div className="font-medium whitespace-nowrap">
																						{getFullJudgeName(
																							data.judge!.firstName,
																							data.judge!.lastName,
																						)}
																					</div>
																					{hasDivision && (
																						<div className="text-xs text-gray-600 mt-0.5">
																							{data.division}
																						</div>
																					)}
																				</div>
																			) : (
																				<span>—</span>
																			)}
																		</td>
																	)
																})}
															</tr>
														</tbody>
													</table>
												))}
											</div>
										)
									})}

									{/* Floating judges for print */}
									{event.heats.some((h) =>
										h.judges.some((j) => !j.laneNumber),
									) && (
										<div className="mt-2 pt-2 border-t border-gray-300 text-xs">
											<span className="font-semibold">Floating Judges: </span>
											{event.heats
												.flatMap((heat) =>
													heat.judges
														.filter((j) => !j.laneNumber)
														.map((judge) => (
															<span key={judge.assignmentId} className="mr-3">
																H{heat.heatNumber}:{" "}
																{getFullJudgeName(
																	judge.firstName,
																	judge.lastName,
																)}
																{judge.position && ` (${judge.position})`}
															</span>
														)),
												)}
										</div>
									)}
								</div>
							</div>
						)
					})}
				</div>
			))}

		</div>
	)
}
