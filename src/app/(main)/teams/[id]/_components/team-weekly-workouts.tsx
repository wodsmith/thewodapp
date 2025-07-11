"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	WeeklyCalendar,
	type WeeklyCalendarEvent,
} from "@/components/weekly-calendar"
import type { ScheduledWorkoutWithTrackDetails } from "@/server/team-programming-tracks"

interface TeamWeeklyWorkoutsProps {
	scheduledWorkouts: ScheduledWorkoutWithTrackDetails[]
	teamName: string
	selectedDate?: Date | null
	onDateSelect?: (date: Date) => void
}

export function TeamWeeklyWorkouts({
	scheduledWorkouts,
	selectedDate,
	onDateSelect,
}: TeamWeeklyWorkoutsProps) {
	const [currentWeek, setCurrentWeek] = useState(new Date())

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

	const handleDayClick = (date: Date) => {
		onDateSelect?.(date)
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
						onDayClick={handleDayClick}
						selectedDate={selectedDate}
					/>
				</CardContent>
			</Card>
		</div>
	)
}
