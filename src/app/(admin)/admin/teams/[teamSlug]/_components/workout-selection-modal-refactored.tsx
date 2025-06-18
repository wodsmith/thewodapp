"use client"

import { getAllMovementsAction } from "@/actions/movement-actions"
import { getAllTagsAction } from "@/actions/tag-actions"
import { getWorkoutByIdAction } from "@/actions/workout-actions"
import { updateWorkoutAction } from "@/actions/workout-actions"
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer"
import type {
	Movement,
	Tag,
	WorkoutUpdate,
	WorkoutWithTagsAndMovements,
} from "@/types"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import {
	getTeamTracksAction,
	getWorkoutsForTrackAction,
	getWorkoutsNotInTracksAction,
} from "../_actions/programming-actions"
import {
	deleteScheduledWorkoutAction,
	getScheduledWorkoutsAction,
	scheduleStandaloneWorkoutAction,
	scheduleWorkoutAction,
	updateScheduledWorkoutAction,
} from "../_actions/scheduling-actions"
import EditWorkoutClientCompact from "./edit-workout-client-compact"
import {
	type ProgrammingTrack,
	STANDALONE_TRACK_ID,
	type ScheduledWorkoutWithDetails,
	ScheduledWorkouts,
	SchedulingDetails,
	type StandaloneWorkout,
	TrackSelection,
	type TrackWorkout,
	WorkoutSelection,
} from "./workout-selection"

interface WorkoutSelectionModalProps {
	isOpen: boolean
	onClose: () => void
	selectedDate: Date | null
	teamId: string
	onWorkoutScheduledAction: () => void
}

export function WorkoutSelectionModal({
	isOpen,
	onClose,
	selectedDate,
	teamId,
	onWorkoutScheduledAction,
}: WorkoutSelectionModalProps) {
	// State for component selections and data
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
	const [editingScheduled, setEditingScheduled] = useState<string | null>(null)
	const [editingWorkout, setEditingWorkout] =
		useState<WorkoutWithTagsAndMovements | null>(null)
	const [allMovements, setAllMovements] = useState<Movement[]>([])
	const [allTags, setAllTags] = useState<Tag[]>([])

	// Form state
	const [classTimes, setClassTimes] = useState("")
	const [teamNotes, setTeamNotes] = useState("")
	const [scalingGuidance, setScalingGuidance] = useState("")

	// Server actions
	const { execute: getTeamTracks, isPending: isLoadingTracks } =
		useServerAction(getTeamTracksAction)
	const { execute: getWorkoutsForTrack, isPending: isLoadingWorkouts } =
		useServerAction(getWorkoutsForTrackAction)
	const {
		execute: getWorkoutsNotInTracks,
		isPending: isLoadingStandaloneWorkouts,
	} = useServerAction(getWorkoutsNotInTracksAction)
	const { execute: scheduleWorkout, isPending: isScheduling } = useServerAction(
		scheduleWorkoutAction,
	)
	const {
		execute: scheduleStandaloneWorkout,
		isPending: isSchedulingStandalone,
	} = useServerAction(scheduleStandaloneWorkoutAction)
	const { execute: getScheduledWorkouts, isPending: isLoadingScheduled } =
		useServerAction(getScheduledWorkoutsAction)
	const { execute: updateScheduledWorkout, isPending: isUpdatingScheduled } =
		useServerAction(updateScheduledWorkoutAction)
	const { execute: deleteScheduledWorkout, isPending: isDeletingScheduled } =
		useServerAction(deleteScheduledWorkoutAction)
	const { execute: getWorkoutById, isPending: isLoadingWorkoutDetails } =
		useServerAction(getWorkoutByIdAction)
	const { execute: getAllMovements, isPending: isLoadingAllMovements } =
		useServerAction(getAllMovementsAction)
	const { execute: getAllTags, isPending: isLoadingAllTags } =
		useServerAction(getAllTagsAction)
	const { execute: updateWorkout } = useServerAction(updateWorkoutAction)

	// Load data when modal opens
	useEffect(() => {
		if (isOpen && teamId) {
			loadTeamTracks()
			loadScheduledWorkouts()
		}
	}, [isOpen, teamId])

	// Load workouts when track is selected
	useEffect(() => {
		if (selectedTrack) {
			if (selectedTrack.id === STANDALONE_TRACK_ID) {
				loadStandaloneWorkouts()
			} else {
				loadTrackWorkouts(selectedTrack.id)
			}
		}
	}, [selectedTrack])

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

	// Scheduling handlers
	const handleScheduleWorkout = async () => {
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
			const [result] = await scheduleStandaloneWorkout({
				teamId,
				workoutId: selectedStandaloneWorkout.id,
				scheduledDate: selectedDate.toISOString(),
				teamSpecificNotes: teamNotes || undefined,
				scalingGuidanceForDay: scalingGuidance || undefined,
				classTimes: classTimes || undefined,
			})

			if (result?.success) {
				console.log(
					`INFO: [WorkoutScheduling] Workflow completed: selected standalone workout '${
						selectedStandaloneWorkout.id
					}' scheduled for '${selectedDate.toISOString().split("T")[0]}' with ${
						classTimes ? "1" : "0"
					} class time`,
				)
				toast.success("Standalone workout scheduled successfully!")
				onWorkoutScheduledAction()
				handleClose()
			} else {
				toast.error("Failed to schedule standalone workout")
			}
			return
		}

		// Handle track workouts
		if (selectedWorkout) {
			const [result] = await scheduleWorkout({
				teamId,
				trackWorkoutId: selectedWorkout.id,
				scheduledDate: selectedDate.toISOString(),
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
				handleClose()
			} else {
				toast.error("Failed to schedule workout")
			}
		}
	}

	// Scheduled workout management handlers
	const handleEditScheduled = async (
		scheduled: ScheduledWorkoutWithDetails,
	) => {
		setEditingScheduled(scheduled.id)
		setTeamNotes(scheduled.teamSpecificNotes || "")
		setScalingGuidance(scheduled.scalingGuidanceForDay || "")
		setClassTimes(scheduled.classTimes || "")

		if (!scheduled.trackWorkout || !scheduled) {
			toast.error("No workout details available for this scheduled workout.")
			return
		}

		const workoutId = scheduled.trackWorkout?.workout?.id || scheduled.id

		if (workoutId) {
			const [workoutResult, movementsResult, tagsResult] = await Promise.all([
				getWorkoutById({ id: workoutId }),
				allMovements.length === 0
					? getAllMovements()
					: Promise.resolve([null, null]),
				allTags.length === 0 ? getAllTags() : Promise.resolve([null, null]),
			])

			const [workoutData, workoutError] = workoutResult
			if (workoutError || !workoutData?.success) {
				toast.error("Failed to load workout details.")
				setEditingScheduled(null)
				return
			}
			setEditingWorkout(workoutData.data)

			const [movementsData, movementsError] = movementsResult
			if (movementsData) {
				if (movementsError || !movementsData.success) {
					toast.error("Failed to load movements.")
				} else {
					setAllMovements(movementsData.data)
				}
			}

			const [tagsData, tagsError] = tagsResult
			if (tagsData) {
				if (tagsError || !tagsData.success) {
					toast.error("Failed to load tags.")
				} else {
					setAllTags(tagsData.data)
				}
			}
		}
	}

	const handleUpdateScheduled = async (instanceId: string) => {
		const [result] = await updateScheduledWorkout({
			instanceId,
			teamSpecificNotes: teamNotes || undefined,
			scalingGuidanceForDay: scalingGuidance || undefined,
			classTimes: classTimes || undefined,
		})

		if (result?.success) {
			toast.success("Scheduled workout updated successfully!")
			setEditingScheduled(null)
			loadScheduledWorkouts() // Reload the list
			onWorkoutScheduledAction() // Refresh the calendar
		} else {
			toast.error("Failed to update scheduled workout")
		}
	}

	const handleUpdateWorkout = async (data: {
		id: string
		workout: WorkoutUpdate
		tagIds: string[]
		movementIds: string[]
	}) => {
		const [result, error] = await updateWorkout(data)

		if (error || !result?.success) {
			toast.error("Failed to update workout.")
		} else {
			toast.success("Workout updated successfully!")
			await loadScheduledWorkouts()
			setEditingScheduled(null)
			setEditingWorkout(null)
		}
	}

	const handleDeleteScheduled = async (instanceId: string) => {
		const [result] = await deleteScheduledWorkout({
			instanceId,
			teamId,
		})

		if (result?.success) {
			toast.success("Scheduled workout removed successfully!")
			loadScheduledWorkouts() // Reload the list
			onWorkoutScheduledAction() // Refresh the calendar
		} else {
			toast.error("Failed to remove scheduled workout")
		}
	}

	const handleCancelEdit = () => {
		setEditingScheduled(null)
		setEditingWorkout(null)
		// Reset form fields
		setClassTimes("")
		setTeamNotes("")
		setScalingGuidance("")
	}

	// Modal handlers
	const handleClose = () => {
		// Reset all state
		setSelectedTrack(null)
		setSelectedWorkout(null)
		setSelectedStandaloneWorkout(null)
		setTrackWorkouts([])
		setStandaloneWorkouts([])
		setScheduledWorkouts([])
		setEditingScheduled(null)
		setClassTimes("")
		setTeamNotes("")
		setScalingGuidance("")
		onClose()
	}

	const handleCancel = () => {
		handleClose()
	}

	const trackWorkoutForScheduling = selectedWorkout

	const standaloneWorkoutForScheduling = selectedStandaloneWorkout

	const scheduledWorkoutToEdit = editingScheduled
		? scheduledWorkouts.find((w) => w.id === editingScheduled)
		: null

	return (
		<Drawer open={isOpen} onOpenChange={handleClose}>
			<DrawerContent className="max-h-[85vh]">
				<DrawerHeader>
					<DrawerTitle>Schedule Workout</DrawerTitle>
					<DrawerDescription>
						Select a workout from your team's programming tracks for{" "}
						{selectedDate?.toDateString()}
					</DrawerDescription>
				</DrawerHeader>

				<div className="overflow-y-auto px-4">
					<div
						key={editingScheduled ? "editing" : "viewing"}
						className="animate-in fade-in-0 duration-300"
					>
						{editingScheduled && editingWorkout && scheduledWorkoutToEdit ? (
							<div className="flex gap-6">
								<div className="w-1/2">
									<ScheduledWorkouts
										scheduledWorkouts={[scheduledWorkoutToEdit]}
										selectedDate={selectedDate}
										editingScheduled={editingScheduled}
										onEdit={handleEditScheduled}
										onUpdate={handleUpdateScheduled}
										onDelete={handleDeleteScheduled}
										isUpdating={isUpdatingScheduled}
										isDeleting={isDeletingScheduled}
										isLoading={isLoadingScheduled}
										classTimes={classTimes}
										teamNotes={teamNotes}
										scalingGuidance={scalingGuidance}
										onClassTimesChange={setClassTimes}
										onTeamNotesChange={setTeamNotes}
										onScalingGuidanceChange={setScalingGuidance}
										onCancelEdit={handleCancelEdit}
									/>
								</div>
								<div className="w-1/2">
									{isLoadingWorkoutDetails ||
									isLoadingAllMovements ||
									isLoadingAllTags ? (
										<p>Loading workout editor...</p>
									) : (
										<EditWorkoutClientCompact
											workout={editingWorkout}
											movements={allMovements}
											tags={allTags}
											workoutId={editingWorkout.id}
											updateWorkoutAction={handleUpdateWorkout}
											onCancel={handleCancelEdit}
										/>
									)}
								</div>
							</div>
						) : (
							<div>
								{/* Scheduled Workouts Section */}
								<ScheduledWorkouts
									scheduledWorkouts={scheduledWorkouts}
									selectedDate={selectedDate}
									editingScheduled={editingScheduled}
									onEdit={handleEditScheduled}
									onUpdate={handleUpdateScheduled}
									onDelete={handleDeleteScheduled}
									isUpdating={isUpdatingScheduled}
									isDeleting={isDeletingScheduled}
									isLoading={isLoadingScheduled}
									classTimes={classTimes}
									teamNotes={teamNotes}
									scalingGuidance={scalingGuidance}
									onClassTimesChange={setClassTimes}
									onTeamNotesChange={setTeamNotes}
									onScalingGuidanceChange={setScalingGuidance}
									onCancelEdit={handleCancelEdit}
								/>

								<div className="flex gap-6 min-h-[456px]">
									{/* Track Selection */}
									<TrackSelection
										tracks={tracks}
										selectedTrack={selectedTrack}
										onTrackSelect={handleTrackSelect}
										isLoading={isLoadingTracks}
									/>

									{/* Workout Selection */}
									<WorkoutSelection
										selectedTrack={selectedTrack}
										selectedWorkout={selectedWorkout}
										selectedStandaloneWorkout={selectedStandaloneWorkout}
										trackWorkouts={trackWorkouts}
										standaloneWorkouts={standaloneWorkouts}
										onWorkoutSelect={handleWorkoutSelect}
										onStandaloneWorkoutSelect={handleStandaloneWorkoutSelect}
										isLoadingWorkouts={isLoadingWorkouts}
										isLoadingStandaloneWorkouts={isLoadingStandaloneWorkouts}
									/>

									{/* Scheduling Details */}
									<SchedulingDetails
										selectedWorkout={trackWorkoutForScheduling}
										selectedStandaloneWorkout={standaloneWorkoutForScheduling}
										selectedTrack={selectedTrack}
										classTimes={classTimes}
										teamNotes={teamNotes}
										scalingGuidance={scalingGuidance}
										onClassTimesChange={setClassTimes}
										onTeamNotesChange={setTeamNotes}
										onScalingGuidanceChange={setScalingGuidance}
										onSchedule={handleScheduleWorkout}
										onCancel={handleCancel}
										isScheduling={isScheduling}
										isSchedulingStandalone={isSchedulingStandalone}
									/>
								</div>
							</div>
						)}
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	)
}
