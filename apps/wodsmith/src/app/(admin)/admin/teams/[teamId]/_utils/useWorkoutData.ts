import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import {
	getTeamTracksAction,
	getWorkoutsForTrackAction,
	getWorkoutsNotInTracksAction,
} from "../_actions/programming-actions"
import { getScheduledWorkoutsAction } from "../_actions/scheduling-actions"
import {
	type ProgrammingTrack,
	type ScheduledWorkoutWithDetails,
	STANDALONE_TRACK_ID,
	type StandaloneWorkout,
	type TrackWorkout,
} from "../_components/workout-selection"

interface UseWorkoutDataProps {
	isOpen: boolean
	teamId: string
	selectedDate: Date | null
	selectedTrack: ProgrammingTrack | null
}

export function useWorkoutData({
	isOpen,
	teamId,
	selectedDate,
	selectedTrack,
}: UseWorkoutDataProps) {
	// State
	const [tracks, setTracks] = useState<ProgrammingTrack[]>([])
	const [trackWorkouts, setTrackWorkouts] = useState<
		(TrackWorkout & { isScheduled?: boolean; lastScheduledAt?: Date | null })[]
	>([])
	const [standaloneWorkouts, setStandaloneWorkouts] = useState<
		(StandaloneWorkout & {
			isScheduled?: boolean
			lastScheduledAt?: Date | null
		})[]
	>([])
	const [scheduledWorkouts, setScheduledWorkouts] = useState<
		ScheduledWorkoutWithDetails[]
	>([])

	// Server actions
	const { execute: getTeamTracks, isPending: isLoadingTracks } =
		useServerAction(getTeamTracksAction)
	const { execute: getWorkoutsForTrack, isPending: isLoadingWorkouts } =
		useServerAction(getWorkoutsForTrackAction)
	const {
		execute: getWorkoutsNotInTracks,
		isPending: isLoadingStandaloneWorkouts,
	} = useServerAction(getWorkoutsNotInTracksAction)
	const { execute: getScheduledWorkouts, isPending: isLoadingScheduled } =
		useServerAction(getScheduledWorkoutsAction)

	// Load data functions
	const loadTeamTracks = useCallback(async () => {
		const [result] = await getTeamTracks({ teamId })
		if (result?.success && result.data) {
			setTracks(result.data)
		} else {
			toast.error("Failed to load team tracks")
		}
	}, [teamId, getTeamTracks])

	const loadTrackWorkouts = useCallback(
		async (trackId: string) => {
			const [result] = await getWorkoutsForTrack({ trackId, teamId })
			if (result?.success && result.data) {
				setTrackWorkouts(result.data)
			} else {
				toast.error("Failed to load track workouts")
			}
		},
		[getWorkoutsForTrack, teamId],
	)

	const loadStandaloneWorkouts = useCallback(async () => {
		const [result] = await getWorkoutsNotInTracks({ teamId })
		if (result?.success && result.data) {
			setStandaloneWorkouts(result.data)
		} else {
			toast.error("Failed to load standalone workouts")
		}
	}, [teamId, getWorkoutsNotInTracks])

	const loadScheduledWorkouts = useCallback(async () => {
		if (!selectedDate) return

		// Get the start and end of the selected date
		const startOfDay = new Date(selectedDate)
		startOfDay.setHours(0, 0, 0, 0)
		const endOfDay = new Date(selectedDate)
		endOfDay.setHours(23, 59, 59, 999)

		const [result] = await getScheduledWorkouts({
			teamId,
			startDate: startOfDay.toISOString(),
			endDate: endOfDay.toISOString(),
		})

		if (result?.success && result.data) {
			setScheduledWorkouts(result.data)
		} else {
			toast.error("Failed to load scheduled workouts")
		}
	}, [selectedDate, teamId, getScheduledWorkouts])

	// Effects
	useEffect(() => {
		if (isOpen && teamId) {
			loadTeamTracks()
			loadScheduledWorkouts()
		}
	}, [isOpen, teamId, loadTeamTracks, loadScheduledWorkouts])

	useEffect(() => {
		if (selectedTrack) {
			if (selectedTrack.id === STANDALONE_TRACK_ID) {
				loadStandaloneWorkouts()
			} else {
				loadTrackWorkouts(selectedTrack.id)
			}
		}
	}, [selectedTrack, loadStandaloneWorkouts, loadTrackWorkouts])

	// Reset function
	const resetData = useCallback(() => {
		setTracks([])
		setTrackWorkouts([])
		setStandaloneWorkouts([])
		setScheduledWorkouts([])
	}, [])

	return {
		// Data
		tracks,
		trackWorkouts,
		standaloneWorkouts,
		scheduledWorkouts,
		// Loading states
		isLoadingTracks,
		isLoadingWorkouts,
		isLoadingStandaloneWorkouts,
		isLoadingScheduled,
		// Functions
		loadScheduledWorkouts,
		resetData,
	}
}
