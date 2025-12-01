"use client"

import { useMemo } from "react"
import { Clock, MapPin, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CompetitionWorkout } from "@/server/competition-workouts"
import type { HeatWithAssignments } from "@/server/competition-heats"

interface ScheduleContentProps {
	events: CompetitionWorkout[]
	heats: HeatWithAssignments[]
	currentUserId?: string
}

export function ScheduleContent({
	events,
	heats,
	currentUserId,
}: ScheduleContentProps) {
	// Group heats by date
	const heatsByDate = useMemo(() => {
		const grouped = new Map<string, HeatWithAssignments[]>()

		for (const heat of heats) {
			const dateKey = heat.scheduledTime
				? new Date(heat.scheduledTime).toDateString()
				: "Unscheduled"

			const existing = grouped.get(dateKey) ?? []
			existing.push(heat)
			grouped.set(dateKey, existing)
		}

		// Sort heats within each day by time
		for (const [key, dayHeats] of grouped) {
			dayHeats.sort((a, b) => {
				if (!a.scheduledTime) return 1
				if (!b.scheduledTime) return -1
				return (
					new Date(a.scheduledTime).getTime() -
					new Date(b.scheduledTime).getTime()
				)
			})
			grouped.set(key, dayHeats)
		}

		return grouped
	}, [heats])

	// Get event name map
	const eventMap = useMemo(() => {
		const map = new Map<string, CompetitionWorkout>()
		for (const event of events) {
			map.set(event.id, event)
		}
		return map
	}, [events])

	// Check if current user is in a heat
	function isUserInHeat(heat: HeatWithAssignments): boolean {
		if (!currentUserId) return false
		return heat.assignments.some(
			(a) => a.registration.user.id === currentUserId,
		)
	}

	// Get user's lane number in a heat
	function getUserLane(heat: HeatWithAssignments): number | null {
		if (!currentUserId) return null
		const assignment = heat.assignments.find(
			(a) => a.registration.user.id === currentUserId,
		)
		return assignment?.laneNumber ?? null
	}

	// Format time
	function formatTime(date: Date | null): string {
		if (!date) return ""
		return new Date(date).toLocaleTimeString(undefined, {
			hour: "numeric",
			minute: "2-digit",
		})
	}

	// Format date
	function formatDate(dateString: string): string {
		if (dateString === "Unscheduled") return dateString
		return new Date(dateString).toLocaleDateString(undefined, {
			weekday: "long",
			month: "long",
			day: "numeric",
		})
	}

	if (heats.length === 0) {
		return (
			<div className="container mx-auto py-8">
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

	// Get user's heats for "My Heats" section
	const userHeats = currentUserId
		? heats.filter((heat) => isUserInHeat(heat))
		: []

	return (
		<div className="container mx-auto py-8 space-y-8">
			{/* My Heats Section */}
			{userHeats.length > 0 && (
				<section>
					<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
						<User className="h-5 w-5" />
						My Heats
					</h2>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{userHeats.map((heat) => {
							const event = eventMap.get(heat.trackWorkoutId)
							const laneNumber = getUserLane(heat)

							return (
								<Card
									key={heat.id}
									className="border-teal-500/50 bg-teal-500/5"
								>
									<CardContent className="py-4">
										<div className="flex justify-between items-start">
											<div>
												<p className="font-medium">
													Event {event?.trackOrder}: {event?.workout.name}
												</p>
												<p className="text-sm text-muted-foreground">
													Heat {heat.heatNumber}
													{laneNumber && ` • Lane ${laneNumber}`}
												</p>
											</div>
											{heat.scheduledTime && (
												<Badge variant="secondary">
													{formatTime(heat.scheduledTime)}
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

			{/* Full Schedule */}
			<section>
				<h2 className="text-xl font-semibold mb-4">Full Schedule</h2>

				{Array.from(heatsByDate.entries()).map(([dateKey, dayHeats]) => (
					<div key={dateKey} className="mb-8">
						<h3 className="text-lg font-medium mb-4 pb-2 border-b">
							{formatDate(dateKey)}
						</h3>

						<div className="space-y-4">
							{dayHeats.map((heat) => {
								const event = eventMap.get(heat.trackWorkoutId)
								const userInHeat = isUserInHeat(heat)

								return (
									<Card
										key={heat.id}
										className={userInHeat ? "border-teal-500/50" : ""}
									>
										<CardHeader className="pb-2">
											<div className="flex items-center justify-between">
												<CardTitle className="text-base">
													{heat.scheduledTime && (
														<span className="text-muted-foreground mr-2">
															{formatTime(heat.scheduledTime)}
														</span>
													)}
													Event {event?.trackOrder}: {event?.workout.name} -
													Heat {heat.heatNumber}
												</CardTitle>
												<div className="flex items-center gap-2">
													{heat.division && (
														<Badge variant="outline">
															{heat.division.label}
														</Badge>
													)}
													{userInHeat && (
														<Badge className="bg-teal-500">
															You're in this heat
														</Badge>
													)}
												</div>
											</div>
											{heat.venue && (
												<p className="text-sm text-muted-foreground flex items-center gap-1">
													<MapPin className="h-3 w-3" />
													{heat.venue.name}
												</p>
											)}
										</CardHeader>
										<CardContent>
											<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
												{heat.assignments
													.sort((a, b) => a.laneNumber - b.laneNumber)
													.map((assignment) => {
														const isUser =
															currentUserId &&
															assignment.registration.user.id === currentUserId

														return (
															<div
																key={assignment.id}
																className={`text-sm px-2 py-1 rounded ${
																	isUser
																		? "bg-teal-500/20 font-medium"
																		: "bg-muted"
																}`}
															>
																<span className="text-muted-foreground mr-1">
																	L{assignment.laneNumber}:
																</span>
																{assignment.registration.teamName ??
																	(`${assignment.registration.user.firstName ?? ""} ${assignment.registration.user.lastName ?? ""}`.trim() ||
																		"Unknown")}
															</div>
														)
													})}
											</div>
										</CardContent>
									</Card>
								)
							})}
						</div>
					</div>
				))}
			</section>
		</div>
	)
}
