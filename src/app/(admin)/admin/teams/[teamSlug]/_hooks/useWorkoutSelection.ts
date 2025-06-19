import { useState } from "react"
import type {
	ProgrammingTrack,
	StandaloneWorkout,
	TrackWorkout,
} from "../_components/workout-selection"

export function useWorkoutSelection() {
	const [selectedTrack, setSelectedTrack] = useState<ProgrammingTrack | null>(
		null,
	)
	const [selectedWorkout, setSelectedWorkout] = useState<
		| (TrackWorkout & { isScheduled?: boolean; lastScheduledAt?: Date | null })
		| null
	>(null)
	const [selectedStandaloneWorkout, setSelectedStandaloneWorkout] = useState<
		| (StandaloneWorkout & {
				isScheduled?: boolean
				lastScheduledAt?: Date | null
		  })
		| null
	>(null)

	// Track selection handlers
	const handleTrackSelect = (track: ProgrammingTrack) => {
		setSelectedTrack(track)
		// Clear workout selections when switching tracks
		setSelectedWorkout(null)
		setSelectedStandaloneWorkout(null)
	}

	// Workout selection handlers
	const handleWorkoutSelect = (
		workout: TrackWorkout & {
			isScheduled?: boolean
			lastScheduledAt?: Date | null
		},
	) => {
		setSelectedWorkout(workout)
		setSelectedStandaloneWorkout(null)
	}

	const handleStandaloneWorkoutSelect = (
		workout: StandaloneWorkout & {
			isScheduled?: boolean
			lastScheduledAt?: Date | null
		},
	) => {
		setSelectedStandaloneWorkout(workout)
		setSelectedWorkout(null)
	}

	// Reset function
	const resetSelection = () => {
		setSelectedTrack(null)
		setSelectedWorkout(null)
		setSelectedStandaloneWorkout(null)
	}

	return {
		// State
		selectedTrack,
		selectedWorkout,
		selectedStandaloneWorkout,
		// Handlers
		handleTrackSelect,
		handleWorkoutSelect,
		handleStandaloneWorkoutSelect,
		// Utils
		resetSelection,
	}
}
