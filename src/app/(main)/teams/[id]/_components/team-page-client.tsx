"use client"

import { useState, useEffect } from "react"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { isSameDay } from "date-fns"
import { Button } from "@/components/ui/button"
import type { ScheduledWorkoutWithTrackDetails } from "@/server/team-programming-tracks"
import { TeamWeeklyWorkouts } from "./team-weekly-workouts"
import { ExpandedWorkoutView } from "./expanded-workout-view"

interface TeamPageClientProps {
	scheduledWorkouts: ScheduledWorkoutWithTrackDetails[]
	teamName: string
}

export function TeamPageClient({
	scheduledWorkouts,
	teamName,
}: TeamPageClientProps) {
	const [selectedDate, setSelectedDate] = useState<Date | null>(null)

	// Set default to today on mount
	useEffect(() => {
		setSelectedDate(new Date())
	}, [])

	const handleDateSelect = (date: Date) => {
		setSelectedDate(date)
	}

	// Get workouts for the selected date
	const selectedDateWorkouts = selectedDate
		? scheduledWorkouts.filter((workout) =>
				isSameDay(new Date(workout.scheduledDate), selectedDate),
			)
		: []

	const isToday = selectedDate ? isSameDay(selectedDate, new Date()) : false

	return (
		<div>
			<div className="mb-6 flex items-center gap-4">
				<Button variant="ghost" size="sm" asChild>
					<Link href="/teams">
						<ChevronLeft className="h-4 w-4 mr-2" />
						Back to Teams
					</Link>
				</Button>
				<h1 className="">{teamName.toUpperCase()}</h1>
			</div>

			<div className="space-y-6">
				<TeamWeeklyWorkouts
					scheduledWorkouts={scheduledWorkouts}
					teamName={teamName}
					selectedDate={selectedDate}
					onDateSelect={handleDateSelect}
				/>

				<ExpandedWorkoutView
					workouts={selectedDateWorkouts}
					selectedDate={selectedDate}
					isToday={isToday}
				/>
			</div>
		</div>
	)
}
