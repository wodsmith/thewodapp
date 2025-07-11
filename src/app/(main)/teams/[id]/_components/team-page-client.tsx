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
	const [selectedWorkout, setSelectedWorkout] =
		useState<ScheduledWorkoutWithTrackDetails | null>(null)
	const [isToday, setIsToday] = useState(false)

	// Set default to today's workout on mount
	useEffect(() => {
		const today = new Date()
		const todaysWorkout = scheduledWorkouts.find((workout) =>
			isSameDay(new Date(workout.scheduledDate), today),
		)
		if (todaysWorkout) {
			setSelectedWorkout(todaysWorkout)
			setIsToday(true)
		}
	}, [scheduledWorkouts])

	const handleWorkoutSelect = (
		workout: ScheduledWorkoutWithTrackDetails | null,
	) => {
		setSelectedWorkout(workout)
		if (workout) {
			const today = new Date()
			setIsToday(isSameDay(new Date(workout.scheduledDate), today))
		} else {
			setIsToday(false)
		}
	}

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
					selectedWorkout={selectedWorkout}
					onWorkoutSelect={handleWorkoutSelect}
				/>

				<ExpandedWorkoutView workout={selectedWorkout} isToday={isToday} />
			</div>
		</div>
	)
}
