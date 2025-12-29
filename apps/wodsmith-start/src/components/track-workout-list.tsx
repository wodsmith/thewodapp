"use client"

import type { TrackWorkoutWithDetails } from "@/server-fns/programming-fns"
import { TrackWorkoutRow } from "./track-workout-row"

interface TrackWorkoutListProps {
	trackWorkouts: TrackWorkoutWithDetails[]
	onWorkoutRemoved?: () => void
}

export function TrackWorkoutList({
	trackWorkouts,
	onWorkoutRemoved,
}: TrackWorkoutListProps) {
	// Sort workouts by track order
	const sortedWorkouts = [...trackWorkouts].sort(
		(a, b) => a.trackOrder - b.trackOrder,
	)

	if (sortedWorkouts.length === 0) {
		return (
			<div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
				<p className="text-muted-foreground font-mono">
					No workouts in this track yet.
				</p>
				<p className="text-sm text-muted-foreground font-mono mt-2">
					Add workouts to get started.
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-3">
			{sortedWorkouts.map((trackWorkout) => (
				<TrackWorkoutRow
					key={trackWorkout.id}
					trackWorkout={trackWorkout}
					onRemoved={onWorkoutRemoved}
				/>
			))}
		</div>
	)
}
