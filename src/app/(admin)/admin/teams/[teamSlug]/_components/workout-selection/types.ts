export interface ProgrammingTrack {
	id: string
	name: string
	description: string | null
	type: string
}

export interface TrackWorkout {
	id: string
	dayNumber: number
	weekNumber: number | null
	notes: string | null
	workoutId: string
	workout?: {
		id: string
		name: string
		description: string
		scheme: string
	}
}

export interface StandaloneWorkout {
	id: string
	name: string
	description: string
	scheme: string
}

export interface ScheduledWorkoutWithDetails {
	id: string
	teamId: string
	trackWorkoutId: string
	scheduledDate: Date
	teamSpecificNotes: string | null
	scalingGuidanceForDay: string | null
	classTimes: string | null
	createdAt: Date
	updatedAt: Date
	trackWorkout?: {
		id: string
		dayNumber: number
		weekNumber: number | null
		notes: string | null
		workoutId: string
		workout?: {
			id: string
			name: string
			description: string
			scheme: string
		}
	} | null
}

// Special track ID for standalone workouts
export const STANDALONE_TRACK_ID = "standalone"
