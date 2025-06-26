// Shared types and symbols for track workout drag and drop functionality

import type { TrackWorkout } from "@/db/schema"

// Shared symbol for track workout data identification
export const trackWorkoutKey = Symbol("track-workout")

export type TrackWorkoutData = {
	[trackWorkoutKey]: true
	trackWorkout: TrackWorkout & {
		isScheduled?: boolean
		lastScheduledAt?: Date | null
	}
	index: number
	instanceId: symbol
}

export function getTrackWorkoutData({
	trackWorkout,
	index,
	instanceId,
}: {
	trackWorkout: TrackWorkout & {
		isScheduled?: boolean
		lastScheduledAt?: Date | null
	}
	index: number
	instanceId: symbol
}): TrackWorkoutData {
	return {
		[trackWorkoutKey]: true,
		trackWorkout,
		index,
		instanceId,
	}
}

export function isTrackWorkoutData(
	data: Record<string | symbol, unknown>,
): data is TrackWorkoutData {
	const hasKey = data[trackWorkoutKey] === true
	console.log("DEBUG: [Types] isTrackWorkoutData check:", {
		data,
		trackWorkoutKey,
		hasKey,
		dataKeys: Object.getOwnPropertySymbols(data),
	})
	return hasKey
}
