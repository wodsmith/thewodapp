"use client"

import { CalendarIcon } from "@heroicons/react/24/outline"
import { format } from "date-fns"
import { TeamWorkoutCard } from "./team-workout-card"
import { toLocalDate } from "@/utils/date-utils"
import type { TrackWorkout, Workout } from "@/db/schema"

type ViewMode = "daily" | "weekly"

// Define interface for the instance object to match team-workout-card
interface WorkoutInstance {
	id: string
	result?: any
	classTimes?: string | null
	teamSpecificNotes?: string | null
	scalingGuidanceForDay?: string | null
}

interface WorkoutDateGroupProps {
	dateKey: string
	workouts: Array<{
		instance: WorkoutInstance
		workout: Workout
		trackWorkout?: TrackWorkout | null
	}>
	viewMode: ViewMode
}

export function WorkoutDateGroup({
	dateKey,
	workouts,
	viewMode,
}: WorkoutDateGroupProps) {
	return (
		<div className="space-y-4">
			{/* Date Header */}
			<div className="flex items-center gap-2">
				<CalendarIcon
					className={`${viewMode === "daily" ? "h-5 w-5" : "h-4 w-4"} text-primary`}
				/>
				<h3
					className={`font-semibold ${viewMode === "daily" ? "text-lg" : "text-base"}`}
				>
					{format(toLocalDate(dateKey), "EEEE, MMMM d, yyyy")}
				</h3>
			</div>

			{/* Workouts for this date */}
			<div
				className={`${
					viewMode === "daily"
						? "ml-7 grid grid-cols-1 sm:grid-cols-2 gap-4"
						: "flex flex-col gap-4"
				}`}
			>
				{workouts.map(({ instance, workout, trackWorkout }, index) => (
					<TeamWorkoutCard
						key={instance.id || index}
						instance={instance}
						workout={workout}
						trackWorkout={trackWorkout}
						viewMode={viewMode}
						index={index}
					/>
				))}
			</div>
		</div>
	)
}
