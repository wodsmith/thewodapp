"use client"
import {
	addWorkoutToTrackAction,
	getTrackWorkoutsWithDetailsAction,
	updateTrackWorkoutDayNumbersAction, // Import the new action
	updateTrackWorkoutOrderAction, // This was for the old way, might be removed or kept for other uses
} from "@/app/actions/trackActions"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { WorkoutCard } from "@/components/workouts/WorkoutCard"
import type { Workout } from "@/db/schema"
import type { TrackWorkoutWithDetails } from "@/server/programming-tracks"
import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from "@dnd-kit/core"
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import React, { useState, useEffect, type FormEvent } from "react"
import { flushSync } from "react-dom" // Added import for flushSync
import AddWorkoutToTrackModal from "./AddWorkoutToTrackModal"

interface Props {
	trackId: string
	suggestedWorkouts?: Workout[]
}

interface TrackWorkoutFormState {
	dayNumber: string
	weekNumber: string
	notes: string
}

// SortableItem component to wrap WorkoutCard
// This version of WorkoutCard is for display within the sortable list
// and will show dayNumber, weekNumber, notes.
// It does not need onAddToTrackAction if it's already in the track.
function SortableWorkoutItem({ item }: { item: TrackWorkoutWithDetails }) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: item.id })

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
		zIndex: isDragging ? 10 : "auto",
		// Static styles moved to className
	}

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className="mb-2 rounded border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800"
		>
			<h4 className="font-semibold text-gray-900 dark:text-gray-100">
				{item.workout.name}
			</h4>
			<p className="text-sm text-gray-600 dark:text-gray-400">
				Day: {item.dayNumber}
				{item.weekNumber ? `, Week: ${item.weekNumber}` : ""}
			</p>
			{item.notes && (
				<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Notes: {item.notes}
				</p>
			)}
			{/* You might want to display more workout details from item.workout here */}
		</div>
	)
}

export function TrackWorkoutManager({ trackId, suggestedWorkouts }: Props) {
	const [trackWorkouts, setTrackWorkouts] = useState<TrackWorkoutWithDetails[]>(
		[],
	)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [selectedWorkoutForTrack, setSelectedWorkoutForTrack] =
		useState<Workout | null>(null)
	const [formState, setFormState] = useState<TrackWorkoutFormState>({
		dayNumber: "1",
		weekNumber: "",
		notes: "",
	})
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [formError, setFormError] = useState<string | null>(null)

	// Define a memoized fetch function to avoid re-creating it on every render
	const fetchTrackWorkouts = React.useCallback(async () => {
		setIsLoading(true)
		setError(null)
		const [data, fetchError] = await getTrackWorkoutsWithDetailsAction({
			trackId,
		})

		if (fetchError) {
			setError(fetchError.message || "Failed to load workouts for this track.")
			setTrackWorkouts([])
			console.error(
				"[TrackWorkoutManager] Error fetching track workouts:",
				fetchError,
			)
		} else if (data) {
			// Ensure data is an array and filter out any potential null/undefined items
			setTrackWorkouts(
				Array.isArray(data)
					? (data.filter(Boolean) as TrackWorkoutWithDetails[])
					: [],
			)
		} else {
			setTrackWorkouts([])
		}
		setIsLoading(false)
	}, [trackId])

	useEffect(() => {
		fetchTrackWorkouts()
	}, [fetchTrackWorkouts])

	// Reset form when selected workout changes
	useEffect(() => {
		if (selectedWorkoutForTrack) {
			const existingDayNumbers = trackWorkouts
				.filter(Boolean) // Ensure we only map valid items
				.map((tw) => tw.dayNumber)
			let nextDay = 1
			while (existingDayNumbers.includes(nextDay)) {
				nextDay++
			}
			setFormState({
				dayNumber: nextDay.toString(),
				weekNumber: "", // Reset week number or carry over if needed
				notes: "", // Reset notes
			})
		} else {
			// Reset form if no workout is selected
			setFormState({ dayNumber: "1", weekNumber: "", notes: "" })
		}
	}, [selectedWorkoutForTrack, trackWorkouts])

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		const { name, value } = e.target
		setFormState((prev) => ({ ...prev, [name]: value }))
	}

	const handleSubmitSelectedWorkout = async (e: FormEvent) => {
		e.preventDefault()
		if (!selectedWorkoutForTrack) return

		setIsSubmitting(true)
		setFormError(null)

		try {
			const dayNumberInt = Number.parseInt(formState.dayNumber, 10)
			const weekNumberInt = formState.weekNumber
				? Number.parseInt(formState.weekNumber, 10)
				: null

			if (!dayNumberInt || dayNumberInt < 1) {
				setFormError("Day Number must be a positive integer.")
				setIsSubmitting(false)
				return
			}
			if (formState.weekNumber) {
				// If formState.weekNumber is truthy, weekNumberInt is the result of parseInt,
				// so it's either a valid number or NaN. It's not null here.
				if (!weekNumberInt || (weekNumberInt !== null && weekNumberInt < 1)) {
					setFormError("Week Number must be a positive integer if provided.")
					setIsSubmitting(false)
					return
				}
			}

			const [addedWorkout, addError] = await addWorkoutToTrackAction({
				trackId,
				workoutId: selectedWorkoutForTrack.id,
				dayNumber: dayNumberInt,
				weekNumber: weekNumberInt,
				notes: formState.notes,
			})

			if (addError) {
				throw new Error(addError.message || "Failed to add workout to track.")
			}

			setSelectedWorkoutForTrack(null) // Clear selection
			await fetchTrackWorkouts() // Refetch workouts
		} catch (error) {
			console.error(
				"[TrackWorkoutManager] Error adding workout to track:",
				error,
			)
			setFormError(
				error instanceof Error ? error.message : "An unknown error occurred.",
			)
		}
		setIsSubmitting(false)
	}

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	)

	async function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event

		if (over && active.id !== over.id) {
			const oldIndex = displayableTrackWorkouts.findIndex(
				(item) => item.id === active.id,
			)
			const newIndex = displayableTrackWorkouts.findIndex(
				(item) => item.id === over.id,
			)

			if (oldIndex === -1 || newIndex === -1) {
				console.error(
					"[TrackWorkoutManager] DragEnd: Item not found. Current items:",
					displayableTrackWorkouts,
					"Active ID:",
					active.id,
					"Over ID:",
					over.id,
				)
				setError(
					"An error occurred while reordering. The list might be out of sync. Please refresh.",
				)
				await fetchTrackWorkouts()
				return
			}

			const newOrder = arrayMove(displayableTrackWorkouts, oldIndex, newIndex)
			const updatedTrackWorkoutsWithDayNumbers = newOrder.map(
				(item, index) => ({
					...item,
					dayNumber: index + 1, // Day numbers are 1-based
				}),
			)

			flushSync(() => {
				setTrackWorkouts(updatedTrackWorkoutsWithDayNumbers)
			})

			const updatesForServer = updatedTrackWorkoutsWithDayNumbers.map(
				(item) => ({
					trackWorkoutId: item.id,
					dayNumber: item.dayNumber,
				}),
			)

			try {
				console.log(
					"[TrackWorkoutManager] Calling updateTrackWorkoutDayNumbersAction with trackId:",
					trackId,
					"updates:",
					updatesForServer,
				)

				const [actionPrimaryResult, actionErrorResult] =
					await updateTrackWorkoutDayNumbersAction({
						trackId: trackId,
						updates: updatesForServer,
					})

				console.log(
					"[TrackWorkoutManager] updateTrackWorkoutDayNumbersAction response - Result:",
					actionPrimaryResult,
					"Error:",
					actionErrorResult,
				)

				if (actionErrorResult) {
					// Error caught by serverActionHandler or unhandled exception in action
					console.error(
						"[TrackWorkoutManager] Server action failed:",
						actionErrorResult.message,
					)
					throw new Error(actionErrorResult.message || "Server action failed.")
				}

				// If actionErrorResult is null, actionPrimaryResult should contain the action's return value.
				// For this action, it's { success: boolean, message?: string }.
				// It should not be null if the action guarantees a return object on success path.
				if (!actionPrimaryResult) {
					console.error(
						"[TrackWorkoutManager] Server action returned no result despite no error. This is unexpected.",
					)
					throw new Error(
						"Server action completed without error but returned no result.",
					)
				}

				// Now, actionPrimaryResult is the { success: boolean, message?: string } object.
				if (!actionPrimaryResult.success) {
					console.error(
						"[TrackWorkoutManager] Action executed but reported failure:",
						actionPrimaryResult.message,
					)
					throw new Error(
						actionPrimaryResult.message ||
							"Update failed as per server action response.",
					)
				}

				console.log(
					"[TrackWorkoutManager] Server update successful. UI already updated optimistically.",
				)
				// await fetchTrackWorkouts() // Removed: Explicitly refetching track workouts to ensure UI consistency.
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "An unknown error occurred."
				console.error(
					"[TrackWorkoutManager] Error in handleDragEnd during/after server update:",
					errorMessage,
					err,
				)
				setError(errorMessage)
				console.log(
					"[TrackWorkoutManager] Error occurred, refetching to revert to server state.",
				)
				await fetchTrackWorkouts()
			}
		}
	}

	const displayableTrackWorkouts = React.useMemo(
		() => trackWorkouts.filter(Boolean) as TrackWorkoutWithDetails[],
		[trackWorkouts],
	)

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-semibold mb-2">Workouts in Track</h3>
				{isLoading && <p>Loading workouts...</p>}
				{!isLoading && !error && displayableTrackWorkouts.length === 0 && (
					<p>No workouts have been added to this track yet.</p>
				)}
				{!isLoading && displayableTrackWorkouts.length > 0 && (
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						<SortableContext
							items={displayableTrackWorkouts.map((item) => item.id)}
							strategy={verticalListSortingStrategy}
						>
							<div className="space-y-2">
								{displayableTrackWorkouts.map((trackWorkoutItem) => (
									<SortableWorkoutItem
										key={trackWorkoutItem.id}
										item={trackWorkoutItem}
									/>
								))}
							</div>
						</SortableContext>
					</DndContext>
				)}
				<div className="mt-4">
					{/* 
            The AddWorkoutToTrackModal seems to be self-contained for creating NEW workouts directly.
            If it needs to notify the parent to refresh, it should have a prop like onWorkoutAdded.
            However, the current structure of AddWorkoutToTrackModal (from provided context)
            doesn't show such a prop. It handles its own state and submission.
            If the intention is for THIS TrackWorkoutManager to handle adding *new* (not suggested) workouts
            via that modal, then the modal needs to be adapted or this manager needs a different way
            to trigger new workout creation that then calls fetchTrackWorkouts.

            For now, assuming AddWorkoutToTrackModal is for creating entirely new workouts not listed
            in `suggestedWorkouts`, and that a page refresh or other mechanism updates the list,
            or it should be enhanced with a callback.
            If `AddWorkoutToTrackModal` is meant to add *existing* workouts (like a search/select), 
            its current implementation (taking direct input for day/week/notes) doesn't align with that.

            Given the current `AddWorkoutToTrackModal` structure, it doesn't take an `onWorkoutAdded` prop.
            If it's modified to take one, it can be added back.
            If it successfully adds a workout and we need to refresh, the simplest way without modifying the modal
            is if the modal itself causes a revalidation/redirect that triggers a data refresh, or
            we add a button here that, after the modal is used, the user clicks to refresh.

            Let's assume for now that `AddWorkoutToTrackModal` is independent or will be modified
            separately to include a callback if needed. The current error is about the prop not existing.
           */}
					<AddWorkoutToTrackModal trackId={trackId} />
				</div>
			</div>

			{suggestedWorkouts && suggestedWorkouts.length > 0 && (
				<div>
					<h3 className="text-lg font-semibold mb-2">
						Suggested Workouts from Team
					</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
						{suggestedWorkouts.map((workout) => (
							<WorkoutCard
								key={workout.id}
								workout={workout}
								onAddToTrackAction={() => setSelectedWorkoutForTrack(workout)} // This prop is expected by the WorkoutCard from src/components/workouts/WorkoutCard.tsx
							/>
						))}
					</div>
				</div>
			)}

			{selectedWorkoutForTrack && (
				<div className="mt-6 p-6 border rounded-lg shadow-md bg-card">
					<h4 className="text-xl font-semibold mb-4">
						Add "{selectedWorkoutForTrack.name}" to Track
					</h4>
					<form onSubmit={handleSubmitSelectedWorkout} className="space-y-4">
						<div>
							<Label htmlFor="dayNumber">Day Number</Label>
							<Input
								id="dayNumber"
								name="dayNumber"
								type="number"
								value={formState.dayNumber}
								onChange={handleInputChange}
								min="1"
								required
								className="mt-1"
							/>
						</div>
						<div>
							<Label htmlFor="weekNumber">Week Number (Optional)</Label>
							<Input
								id="weekNumber"
								name="weekNumber"
								type="number"
								value={formState.weekNumber}
								onChange={handleInputChange}
								min="1"
								className="mt-1"
							/>
						</div>
						<div>
							<Label htmlFor="notes">Notes (Optional)</Label>
							<Textarea
								id="notes"
								name="notes"
								value={formState.notes}
								onChange={handleInputChange}
								rows={3}
								className="mt-1"
							/>
						</div>
						{formError && <p className="text-sm text-red-600">{formError}</p>}
						<div className="flex space-x-2 pt-2">
							<Button
								type="submit"
								disabled={isSubmitting || !formState.dayNumber}
							>
								{isSubmitting ? "Adding..." : "Add Workout to Track"}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => setSelectedWorkoutForTrack(null)}
								disabled={isSubmitting}
							>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			)}

			{error && (
				<AlertDialog open={!!error} onOpenChange={() => setError(null)}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Error</AlertDialogTitle>
							<AlertDialogDescription>{error}</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogAction onClick={() => setError(null)}>
								OK
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</div>
	)
}
