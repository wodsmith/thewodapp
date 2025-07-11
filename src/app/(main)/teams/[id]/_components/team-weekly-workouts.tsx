"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
	WeeklyCalendar,
	type WeeklyCalendarEvent,
} from "@/components/weekly-calendar"
import type { ScheduledWorkoutWithTrackDetails } from "@/server/team-programming-tracks"

interface TeamWeeklyWorkoutsProps {
	scheduledWorkouts: ScheduledWorkoutWithTrackDetails[]
	teamName: string
}

export function TeamWeeklyWorkouts({
	scheduledWorkouts,
}: TeamWeeklyWorkoutsProps) {
	const [currentWeek, setCurrentWeek] = useState(new Date())
	const [selectedWorkout, setSelectedWorkout] =
		useState<ScheduledWorkoutWithTrackDetails | null>(null)

	// Convert scheduled workouts to calendar events
	const calendarEvents: WeeklyCalendarEvent[] = scheduledWorkouts.map(
		(workout) => ({
			id: workout.id,
			title: workout.trackWorkout.workout.name,
			date: new Date(workout.scheduledDate),
			time: workout.classTimes || undefined,
			description: workout.trackWorkout.workout.description || undefined,
			metadata: {
				workout,
			},
		}),
	)

	const handleEventClick = (event: WeeklyCalendarEvent) => {
		const workout = event.metadata?.workout as ScheduledWorkoutWithTrackDetails
		setSelectedWorkout(workout)
	}

	const navigateWeek = (direction: "prev" | "next") => {
		const newDate = new Date(currentWeek)
		newDate.setDate(currentWeek.getDate() + (direction === "next" ? 7 : -7))
		setCurrentWeek(newDate)
	}

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Calendar className="h-5 w-5" />
							Weekly Schedule
						</CardTitle>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => navigateWeek("prev")}
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<span className="text-sm font-medium px-2">
								{format(currentWeek, "MMM d, yyyy")}
							</span>
							<Button
								variant="outline"
								size="sm"
								onClick={() => navigateWeek("next")}
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setCurrentWeek(new Date())}
								className="ml-2"
							>
								Today
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<WeeklyCalendar
						events={calendarEvents}
						currentDate={currentWeek}
						onEventClick={handleEventClick}
					/>
				</CardContent>
			</Card>

			{/* Selected Workout Details */}
			{selectedWorkout && (
				<Card>
					<CardHeader>
						<div className="flex items-start justify-between">
							<div>
								<CardTitle className="text-lg">
									{selectedWorkout.trackWorkout.workout.name}
								</CardTitle>
								<p className="text-sm text-muted-foreground mt-1">
									{format(
										new Date(selectedWorkout.scheduledDate),
										"EEEE, MMMM d",
									)}
									{selectedWorkout.classTimes &&
										` • ${selectedWorkout.classTimes}`}
								</p>
							</div>
							<div className="flex gap-2">
								<Badge variant="outline">
									{selectedWorkout.trackWorkout.track.name}
								</Badge>
								{selectedWorkout.trackWorkout.dayNumber && (
									<Badge variant="secondary">
										Day {selectedWorkout.trackWorkout.dayNumber}
									</Badge>
								)}
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{selectedWorkout.trackWorkout.workout.description && (
							<div>
								<h4 className="font-medium mb-1">Description</h4>
								<p className="text-sm text-muted-foreground whitespace-pre-wrap">
									{selectedWorkout.trackWorkout.workout.description}
								</p>
							</div>
						)}

						{selectedWorkout.trackWorkout.workout.scheme && (
							<div>
								<h4 className="font-medium mb-1">Scheme</h4>
								<Badge variant="outline">
									{selectedWorkout.trackWorkout.workout.scheme.toUpperCase()}
								</Badge>
							</div>
						)}

						{selectedWorkout.scalingGuidanceForDay && (
							<div>
								<h4 className="font-medium mb-1">Scaling Guidance</h4>
								<p className="text-sm text-muted-foreground whitespace-pre-wrap">
									{selectedWorkout.scalingGuidanceForDay}
								</p>
							</div>
						)}

						{selectedWorkout.teamSpecificNotes && (
							<div>
								<h4 className="font-medium mb-1">Team Notes</h4>
								<p className="text-sm text-muted-foreground whitespace-pre-wrap">
									{selectedWorkout.teamSpecificNotes}
								</p>
							</div>
						)}

						<div className="pt-4 border-t">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setSelectedWorkout(null)}
							>
								Close Details
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
