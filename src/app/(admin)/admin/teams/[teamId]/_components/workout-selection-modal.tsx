"use client"

import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer"
import type { WorkoutUpdate } from "@/types"
import {
	useModalState,
	useWorkoutData,
	useWorkoutEditing,
	useWorkoutScheduling,
	useWorkoutSelection,
} from "../_utils"
import EditWorkoutClientCompact from "./edit-workout-client-compact"
import {
	ScheduledWorkouts,
	SchedulingDetails,
	TrackSelection,
	WorkoutSelection,
} from "./workout-selection"
import { useEffect } from "react"

interface WorkoutSelectionModalProps {
	isOpen: boolean
	onCloseAction: () => void
	selectedDate: Date | null
	teamId: string
	onWorkoutScheduledAction: () => void
}

export function WorkoutSelectionModal({
	isOpen,
	onCloseAction,
	selectedDate,
	teamId,
	onWorkoutScheduledAction,
}: WorkoutSelectionModalProps) {
	// Custom hooks for different concerns
	const {
		selectedTrack,
		selectedWorkout,
		selectedStandaloneWorkout,
		handleTrackSelect,
		handleWorkoutSelect,
		handleStandaloneWorkoutSelect,
		resetSelection,
	} = useWorkoutSelection()

	const {
		tracks,
		trackWorkouts,
		standaloneWorkouts,
		scheduledWorkouts,
		isLoadingTracks,
		isLoadingWorkouts,
		isLoadingStandaloneWorkouts,
		isLoadingScheduled,
		loadScheduledWorkouts,
		resetData,
	} = useWorkoutData({
		isOpen,
		teamId,
		selectedDate,
		selectedTrack,
	})

	useEffect(() => {
		console.log({ trackWorkouts })
	}, [trackWorkouts])

	const {
		classTimes,
		teamNotes,
		scalingGuidance,
		setClassTimes,
		setTeamNotes,
		setScalingGuidance,
		resetFormData,
		setFormData,
		getFormData,
	} = useModalState()

	const {
		handleScheduleWorkout,
		handleUpdateScheduled,
		handleDeleteScheduled,
		isScheduling,
		isSchedulingStandalone,
		isUpdatingScheduled,
		isDeletingScheduled,
	} = useWorkoutScheduling({
		teamId,
		selectedDate,
		selectedTrack,
		selectedWorkout,
		selectedStandaloneWorkout,
		onWorkoutScheduledAction,
		onCloseAction,
		loadScheduledWorkouts,
	})

	const {
		editingScheduled,
		editingWorkout,
		allMovements,
		allTags,
		scheduledWorkoutToEdit,
		isLoadingWorkoutDetails,
		isLoadingAllMovements,
		isLoadingAllTags,
		handleEditScheduled,
		handleUpdateWorkout,
		handleCancelEdit,
	} = useWorkoutEditing({
		scheduledWorkouts,
		loadScheduledWorkouts,
	})

	// Modal handlers
	const handleClose = () => {
		// Reset all state
		resetSelection()
		resetData()
		resetFormData()
		handleCancelEdit()
		onCloseAction()
	}

	const handleCancel = () => {
		handleClose()
	}

	// Wrapped handlers that include form data
	const wrappedScheduleWorkout = () => {
		handleScheduleWorkout(getFormData())
	}

	const wrappedUpdateScheduled = (instanceId: string) => {
		return handleUpdateScheduled(instanceId, getFormData()).then(
			(success: boolean) => {
				if (success) {
					handleCancelEdit()
				}
				return success
			},
		)
	}

	const wrappedEditScheduled = (
		scheduled: Parameters<typeof handleEditScheduled>[0],
	) => {
		handleEditScheduled(scheduled, setFormData)
	}

	const wrappedUpdateWorkout = async (data: {
		id: string
		workout: WorkoutUpdate
		tagIds: string[]
		movementIds: string[]
	}) => {
		const success = await handleUpdateWorkout(data)
		if (success) {
			handleCancelEdit()
			// Refresh the main calendar after workout update/remix
			onWorkoutScheduledAction()
		}
	}

	const wrappedCancelEdit = () => {
		handleCancelEdit()
		resetFormData()
	}

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
										onEdit={wrappedEditScheduled}
										onUpdate={wrappedUpdateScheduled}
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
										onCancelEdit={wrappedCancelEdit}
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
											teamId={teamId}
											updateWorkoutAction={wrappedUpdateWorkout}
											onCancel={wrappedCancelEdit}
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
									onEdit={wrappedEditScheduled}
									onUpdate={wrappedUpdateScheduled}
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
									onCancelEdit={wrappedCancelEdit}
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
										selectedWorkout={selectedWorkout}
										selectedStandaloneWorkout={selectedStandaloneWorkout}
										selectedTrack={selectedTrack}
										classTimes={classTimes}
										teamNotes={teamNotes}
										scalingGuidance={scalingGuidance}
										onClassTimesChange={setClassTimes}
										onTeamNotesChange={setTeamNotes}
										onScalingGuidanceChange={setScalingGuidance}
										onSchedule={wrappedScheduleWorkout}
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
