import { useServerAction } from "@repo/zsa-react"
import { useCallback } from "react"
import { toast } from "sonner"
import {
	deleteScheduledWorkoutAction,
	scheduleStandaloneWorkoutAction,
	scheduleWorkoutAction,
	updateScheduledWorkoutAction,
} from "../_actions/scheduling-actions"
import type {
	ProgrammingTrack,
	StandaloneWorkout,
	TrackWorkout,
} from "../_components/workout-selection"

interface UseWorkoutSchedulingProps {
	teamId: string
	selectedDate: Date | null
	selectedTrack: ProgrammingTrack | null
	selectedWorkout:
		| (TrackWorkout & {
				isScheduled?: boolean
				lastScheduledAt?: Date | null
		  })
		| null
	selectedStandaloneWorkout:
		| (StandaloneWorkout & {
				isScheduled?: boolean
				lastScheduledAt?: Date | null
		  })
		| null
	onWorkoutScheduledAction: () => void
	onCloseAction: () => void
	loadScheduledWorkouts: () => void
}

interface SchedulingFormData {
	classTimes: string
	teamNotes: string
	scalingGuidance: string
}

export function useWorkoutScheduling({
	teamId,
	selectedDate,
	selectedTrack,
	selectedWorkout,
	selectedStandaloneWorkout,
	onWorkoutScheduledAction,
	onCloseAction,
	loadScheduledWorkouts,
}: UseWorkoutSchedulingProps) {
	// Server actions
	const { execute: scheduleWorkout, isPending: isScheduling } = useServerAction(
		scheduleWorkoutAction,
	)
	const {
		execute: scheduleStandaloneWorkout,
		isPending: isSchedulingStandalone,
	} = useServerAction(scheduleStandaloneWorkoutAction)
	const { execute: updateScheduledWorkout, isPending: isUpdatingScheduled } =
		useServerAction(updateScheduledWorkoutAction)
	const { execute: deleteScheduledWorkout, isPending: isDeletingScheduled } =
		useServerAction(deleteScheduledWorkoutAction)

	// Scheduling handlers
	const handleScheduleWorkout = useCallback(
		async (formData: SchedulingFormData) => {
			const { classTimes, teamNotes, scalingGuidance } = formData

			if (process.env.LOG_LEVEL === "info") {
				console.log(
					`INFO: [WorkoutSelectionModal] Scheduling workout: track=${
						selectedTrack?.id
					}, workout=${selectedWorkout?.id || selectedStandaloneWorkout?.id}`,
				)
			}

			// Check if either a track workout or standalone workout is selected
			if (!selectedWorkout && !selectedStandaloneWorkout) {
				toast.error("Please select a workout")
				return
			}

			if (!selectedDate) {
				toast.error("Please select a date")
				return
			}

			// Handle standalone workouts
			if (selectedStandaloneWorkout) {
				// Format date as YYYY-MM-DD in local timezone to preserve the selected date
				const year = selectedDate.getFullYear()
				const month = String(selectedDate.getMonth() + 1).padStart(2, "0")
				const day = String(selectedDate.getDate()).padStart(2, "0")
				const localDateString = `${year}-${month}-${day}`

				const [result] = await scheduleStandaloneWorkout({
					teamId,
					workoutId: selectedStandaloneWorkout.id,
					scheduledDate: localDateString,
					teamSpecificNotes: teamNotes || undefined,
					scalingGuidanceForDay: scalingGuidance || undefined,
					classTimes: classTimes || undefined,
				})

				if (result?.success) {
					console.log(
						`INFO: [WorkoutScheduling] Workflow completed: selected standalone workout '${
							selectedStandaloneWorkout.id
						}' scheduled for '${
							selectedDate.toISOString().split("T")[0]
						}' with ${classTimes ? "1" : "0"} class time`,
					)
					toast.success("Standalone workout scheduled successfully!")
					onWorkoutScheduledAction()
					onCloseAction()
				} else {
					toast.error("Failed to schedule standalone workout")
				}
				return
			}

			// Handle track workouts
			if (selectedWorkout) {
				// Format date as YYYY-MM-DD in local timezone to preserve the selected date
				const year = selectedDate.getFullYear()
				const month = String(selectedDate.getMonth() + 1).padStart(2, "0")
				const day = String(selectedDate.getDate()).padStart(2, "0")
				const localDateString = `${year}-${month}-${day}`

				const [result] = await scheduleWorkout({
					teamId,
					trackWorkoutId: selectedWorkout.id,
					scheduledDate: localDateString,
					teamSpecificNotes: teamNotes || undefined,
					scalingGuidanceForDay: scalingGuidance || undefined,
					classTimes: classTimes || undefined,
				})

				if (result?.success) {
					console.log(
						`INFO: [WorkoutScheduling] Workflow completed: selected workout '${
							selectedWorkout.workoutId
						}' from track '${selectedTrack?.id}' scheduled for '${
							selectedDate.toISOString().split("T")[0]
						}' with ${classTimes ? "1" : "0"} class time`,
					)
					toast.success("Workout scheduled successfully!")
					onWorkoutScheduledAction()
					onCloseAction()
				} else {
					toast.error("Failed to schedule workout")
				}
			}
		},
		[
			selectedWorkout,
			selectedStandaloneWorkout,
			selectedDate,
			selectedTrack,
			teamId,
			scheduleWorkout,
			scheduleStandaloneWorkout,
			onWorkoutScheduledAction,
			onCloseAction,
		],
	)

	// Scheduled workout management handlers
	const handleUpdateScheduled = useCallback(
		async (instanceId: string, formData: SchedulingFormData) => {
			const { classTimes, teamNotes, scalingGuidance } = formData

			const [result] = await updateScheduledWorkout({
				instanceId,
				teamId,
				teamSpecificNotes: teamNotes || undefined,
				scalingGuidanceForDay: scalingGuidance || undefined,
				classTimes: classTimes || undefined,
			})

			if (result?.success) {
				toast.success("Scheduled workout updated successfully!")
				loadScheduledWorkouts() // Reload the list
				onWorkoutScheduledAction() // Refresh the calendar
				return true
			}
			toast.error("Failed to update scheduled workout")
			return false
		},
		[
			updateScheduledWorkout,
			teamId,
			loadScheduledWorkouts,
			onWorkoutScheduledAction,
		],
	)

	const handleDeleteScheduled = useCallback(
		async (instanceId: string) => {
			const [result] = await deleteScheduledWorkout({
				instanceId,
				teamId,
			})

			if (result?.success) {
				toast.success("Scheduled workout removed successfully!")
				loadScheduledWorkouts() // Reload the list
				onWorkoutScheduledAction() // Refresh the calendar
				return true
			}
			toast.error("Failed to remove scheduled workout")
			return false
		},
		[
			deleteScheduledWorkout,
			teamId,
			loadScheduledWorkouts,
			onWorkoutScheduledAction,
		],
	)

	return {
		// Handlers
		handleScheduleWorkout,
		handleUpdateScheduled,
		handleDeleteScheduled,
		// Loading states
		isScheduling,
		isSchedulingStandalone,
		isUpdatingScheduled,
		isDeletingScheduled,
	}
}
