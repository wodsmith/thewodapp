"use client"

import type { TrackWorkout, Workout } from "@/db/schema"
import type { WorkoutResult } from "@/types"
import { DailyWorkoutCard } from "./daily-workout-card"
import { WeeklyWorkoutCard } from "./weekly-workout-card"

type ViewMode = "daily" | "weekly"

type WorkoutWithMovements = Workout & {
	movements?: Array<{ id: string; name: string; type: string }>
}

interface WorkoutInstance {
	id: string
	result?: WorkoutResult
	classTimes?: string | null
	teamSpecificNotes?: string | null
	scalingGuidanceForDay?: string | null
}

interface TeamWorkoutCardProps {
	instance: WorkoutInstance
	workout: WorkoutWithMovements
	trackWorkout?: TrackWorkout | null
	viewMode: ViewMode
	index: number
}

export function TeamWorkoutCard({
	instance,
	workout,
	trackWorkout,
	viewMode,
	index,
}: TeamWorkoutCardProps) {
	if (viewMode === "daily") {
		return (
			<DailyWorkoutCard
				instance={instance}
				workout={workout}
				trackWorkout={trackWorkout}
				index={index}
			/>
		)
	}

	return (
		<WeeklyWorkoutCard
			instance={instance}
			workout={workout}
			trackWorkout={trackWorkout}
			index={index}
		/>
	)
}
