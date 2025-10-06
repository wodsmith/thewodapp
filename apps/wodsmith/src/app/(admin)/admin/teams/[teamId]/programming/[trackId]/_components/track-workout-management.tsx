"use client"

import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder"
import {
	type Edge,
	extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index"
import { Plus } from "lucide-react"
import {
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useOptimistic,
	useState,
} from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlignScalingDialog } from "@/components/scaling/align-scaling-dialog"
import { ScalingMigrationDialog } from "@/components/scaling/scaling-migration-dialog"
import type { DescriptionMapping } from "@/components/scaling/scaling-migration-mapper"
import type { ScalingLevel, WorkoutScalingDescription } from "@/db/schema"
import type {
	Movement,
	ProgrammingTrack,
	Tag,
	TrackWorkout,
	Workout,
} from "@/db/schema"
import {
	addWorkoutToTrackAction,
	reorderTrackWorkoutsAction,
	updateTrackWorkoutAction,
} from "../../../_actions/programming-track-actions"
import {
	enhancedAlignWorkoutScalingWithTrackAction,
	completeWorkoutRemixWithScalingMigrationAction,
} from "@/actions/workout-actions"
import { AddWorkoutToTrackDialog } from "./add-workout-to-track-dialog"
import { TrackWorkoutRow } from "./track-workout-row"

interface TrackWorkoutManagementProps {
	teamId: string
	trackId: string
	_track: ProgrammingTrack
	initialTrackWorkouts: (TrackWorkout & {
		isScheduled?: boolean
		lastScheduledAt?: Date | null
	})[]
	userWorkouts: (Workout & {
		tags: { id: string; name: string }[]
		movements: { id: string; name: string }[]
		lastScheduledAt?: Date | null
	})[]
	movements: Movement[]
	tags: Tag[]
	userId: string
	isOwner: boolean
}

export function TrackWorkoutManagement({
	teamId,
	trackId,
	_track,
	initialTrackWorkouts,
	userWorkouts,
	movements,
	tags,
	userId,
	isOwner,
}: TrackWorkoutManagementProps) {
	const [showAddDialog, setShowAddDialog] = useState(false)
	const [alignDialogState, setAlignDialogState] = useState<{
		open: boolean
		workout: Workout | null
	}>({ open: false, workout: null })

	const [migrationDialogState, setMigrationDialogState] = useState<{
		open: boolean
		data: {
			workout: Workout
			track: ProgrammingTrack
			existingDescriptions: Array<
				WorkoutScalingDescription & { scalingLevel: ScalingLevel }
			>
			newScalingLevels: Array<ScalingLevel>
		} | null
	}>({ open: false, data: null })

	// Optimistic updates for track workouts
	const [optimisticTrackWorkouts, setOptimisticTrackWorkouts] = useOptimistic(
		initialTrackWorkouts,
		(
			state,
			action:
				| { type: "add"; workout: TrackWorkout }
				| { type: "remove"; trackWorkoutId: string }
				| {
						type: "update"
						trackWorkoutId: string
						updates: Partial<TrackWorkout>
				  }
				| { type: "reorder"; sourceIndex: number; destinationIndex: number },
		) => {
			console.log(
				"DEBUG: [OptimisticState] Processing action:",
				action.type,
				action,
			)

			switch (action.type) {
				case "add":
					console.log(
						"DEBUG: [OptimisticState] Adding workout:",
						action.workout.id,
					)
					return [...state, { ...action.workout, isScheduled: false }]
				case "remove":
					console.log(
						"DEBUG: [OptimisticState] Removing workout:",
						action.trackWorkoutId,
					)
					return state.filter((tw) => tw.id !== action.trackWorkoutId)
				case "update":
					console.log(
						"DEBUG: [OptimisticState] Updating workout:",
						action.trackWorkoutId,
						action.updates,
					)
					return state.map((tw) =>
						tw.id === action.trackWorkoutId ? { ...tw, ...action.updates } : tw,
					)
				case "reorder": {
					console.log("DEBUG: [OptimisticState] Reordering:", {
						sourceIndex: action.sourceIndex,
						destinationIndex: action.destinationIndex,
						beforeReorder: state.map((tw, i) => ({
							index: i,
							id: tw.id,
							dayNumber: tw.dayNumber,
						})),
					})

					const reorderedState = reorder({
						list: state,
						startIndex: action.sourceIndex,
						finishIndex: action.destinationIndex,
					})

					console.log(
						"DEBUG: [OptimisticState] After reorder:",
						reorderedState.map((tw, i) => ({
							index: i,
							id: tw.id,
							dayNumber: tw.dayNumber,
						})),
					)

					return reorderedState
				}
				default:
					return state
			}
		},
	)

	// Instance ID for isolating drag and drop
	const [instanceId] = useState(() => Symbol("track-workout-instance"))

	// Get the sorted list of workouts for consistent indexing
	const sortedTrackWorkouts = useMemo(
		() => optimisticTrackWorkouts.sort((a, b) => b.dayNumber - a.dayNumber),
		[optimisticTrackWorkouts],
	)

	const reorderTrackWorkout = useCallback(
		async ({
			startIndex,
			indexOfTarget,
			closestEdgeOfTarget,
		}: {
			startIndex: number
			indexOfTarget: number
			closestEdgeOfTarget: Edge | null
		}) => {
			console.log("DEBUG: [Reorder] Starting reorder operation:", {
				startIndex,
				indexOfTarget,
				closestEdgeOfTarget,
				currentWorkouts: sortedTrackWorkouts.map((tw, i) => ({
					index: i,
					id: tw.id,
					dayNumber: tw.dayNumber,
				})),
			})

			const finishIndex = getReorderDestinationIndex({
				startIndex,
				closestEdgeOfTarget,
				indexOfTarget,
				axis: "vertical",
			})

			console.log("DEBUG: [Reorder] Calculated finish index:", finishIndex)

			if (finishIndex === startIndex) {
				console.log("DEBUG: [Reorder] No reorder needed - same position")
				return
			}

			// Optimistic update first - use the sorted list for reordering
			console.log("DEBUG: [Reorder] Applying optimistic update")
			startTransition(() => {
				setOptimisticTrackWorkouts({
					type: "reorder",
					sourceIndex: startIndex,
					destinationIndex: finishIndex,
				})
			})

			try {
				// Calculate the new order using the sorted list
				const reorderedList = reorder({
					list: sortedTrackWorkouts,
					startIndex,
					finishIndex,
				})

				console.log(
					"DEBUG: [Reorder] Reordered list:",
					reorderedList.map((tw, i) => ({
						index: i,
						id: tw.id,
						oldDayNumber: tw.dayNumber,
						newDayNumber: reorderedList.length - i,
					})),
				)

				// Create updates array with trackWorkoutId and new dayNumber
				// Since we're sorting by dayNumber descending, we need to reverse the logic
				const updates = reorderedList.map((trackWorkout, index) => ({
					trackWorkoutId: trackWorkout.id,
					dayNumber: reorderedList.length - index, // Reverse order for descending sort
				}))

				console.log("DEBUG: [Reorder] Prepared updates array:", updates)

				// Validate each update object
				const validUpdates = updates.filter((update) => {
					const isValid =
						update.trackWorkoutId &&
						typeof update.trackWorkoutId === "string" &&
						update.trackWorkoutId.length > 0 &&
						typeof update.dayNumber === "number" &&
						update.dayNumber >= 1

					if (!isValid) {
						console.error("DEBUG: [Reorder] Invalid update object:", update)
					}

					return isValid
				})

				console.log("DEBUG: [Reorder] Valid updates:", validUpdates)

				if (validUpdates.length === 0) {
					console.error("ERROR: [Reorder] No valid updates to process")
					throw new Error("No valid updates to process")
				}

				console.log(
					"DEBUG: [Reorder] Calling reorderTrackWorkoutsAction with:",
					{ teamId, trackId, updates: validUpdates },
				)

				const [result, error] = await reorderTrackWorkoutsAction({
					teamId,
					trackId,
					updates: validUpdates,
				})

				console.log("DEBUG: [Reorder] Action response:", { result, error })

				if (error || !result?.success) {
					console.error("ERROR: [Reorder] Action failed:", { error, result })
					console.error("ERROR: [Reorder] Error details:", error)
					throw new Error(error?.message || "Failed to reorder track workouts")
				}

				console.log(
					`SUCCESS: [Reorder] Successfully reordered ${result.updateCount} track workouts`,
				)
			} catch (error) {
				console.error(
					"ERROR: [Reorder] Failed to reorder track workouts:",
					error,
				)
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to reorder track workouts",
				)
				// The optimistic update will be reverted automatically
			}
		},
		[setOptimisticTrackWorkouts, sortedTrackWorkouts, teamId, trackId],
	)

	useEffect(() => {
		console.log(
			"DEBUG: [DnD] Setting up drag and drop monitor with instanceId:",
			instanceId,
		)

		return monitorForElements({
			canMonitor({ source }) {
				console.log(
					"DEBUG: [DnD] CanMonitor called with source.data:",
					source.data,
				)

				// Simplified check - just check if any data exists
				const hasData = source.data && typeof source.data === "object"
				console.log("DEBUG: [DnD] Has data:", hasData)

				if (hasData) {
					// Check if it has the properties we expect
					const hasTrackWorkoutId = "trackWorkoutId" in source.data
					const hasIndex = "index" in source.data
					const hasInstanceId = "instanceId" in source.data

					console.log("DEBUG: [DnD] Data properties:", {
						hasTrackWorkoutId,
						hasIndex,
						hasInstanceId,
						sourceInstanceId: source.data.instanceId,
						expectedInstanceId: instanceId,
						instanceMatch: source.data.instanceId === instanceId,
					})

					return (
						hasTrackWorkoutId &&
						hasIndex &&
						hasInstanceId &&
						source.data.instanceId === instanceId
					)
				}

				return false
			},
			onDragStart({ source }) {
				console.log("DEBUG: [DnD] Drag started with data:", source.data)
			},
			onDrop({ location, source }) {
				console.log("DEBUG: [DnD] Drop event triggered")

				const target = location.current.dropTargets[0]
				if (!target) {
					console.log("DEBUG: [DnD] No target found for drop")
					return
				}

				const sourceData = source.data
				const targetData = target.data

				console.log("DEBUG: [DnD] Drop data:", {
					source: sourceData,
					target: targetData,
				})

				// Check if both source and target have the required properties
				if (
					!sourceData ||
					!targetData ||
					!("trackWorkoutId" in sourceData) ||
					!("trackWorkoutId" in targetData) ||
					!("index" in sourceData) ||
					!("index" in targetData)
				) {
					console.log("DEBUG: [DnD] Invalid source or target data")
					return
				}

				const indexOfTarget = sortedTrackWorkouts.findIndex(
					(tw) => tw.id === targetData.trackWorkoutId,
				)
				if (indexOfTarget < 0) {
					console.log("DEBUG: [DnD] Target index not found in sorted workouts")
					return
				}

				const closestEdgeOfTarget = extractClosestEdge(targetData)

				console.log("DEBUG: [DnD] Reorder parameters:", {
					startIndex: sourceData.index,
					indexOfTarget,
					closestEdgeOfTarget,
					sortedWorkoutsLength: sortedTrackWorkouts.length,
				})

				// Call the async reorderTrackWorkout function
				reorderTrackWorkout({
					startIndex: sourceData.index as number,
					indexOfTarget,
					closestEdgeOfTarget,
				}).catch((error) => {
					console.error("ERROR: [DnD] Error in drag and drop reorder:", error)
				})
			},
		})
	}, [instanceId, sortedTrackWorkouts, reorderTrackWorkout])

	const handleAddWorkouts = async (workoutIds: string[]) => {
		console.log(
			"DEBUG: [UI] Adding workouts to track:",
			JSON.stringify({ workoutIds, trackId }),
		)

		try {
			const startingDayNumber =
				Math.max(...optimisticTrackWorkouts.map((tw) => tw.dayNumber), 0) + 1

			// Add workouts sequentially with auto-incrementing day numbers
			for (let i = 0; i < workoutIds.length; i++) {
				const workoutId = workoutIds[i]
				const dayNumber = startingDayNumber + i

				// Optimistic update wrapped in startTransition
				startTransition(() => {
					const tempTrackWorkout: TrackWorkout = {
						id: `temp_${Date.now()}_${i}`,
						trackId,
						workoutId,
						dayNumber,
						weekNumber: null,
						notes: null,
						updateCounter: null,
						createdAt: new Date(), // Temporary UI object
						updatedAt: new Date(), // Temporary UI object
					}
					setOptimisticTrackWorkouts({
						type: "add",
						workout: tempTrackWorkout,
					})
				})

				const [result, error] = await addWorkoutToTrackAction({
					teamId,
					trackId,
					workoutId,
					dayNumber,
				})

				if (error || !result?.success) {
					console.error("Failed to add workout to track:", error)
					throw new Error(
						error?.message || `Failed to add workout ${workoutId} to track`,
					)
				}

				console.log(
					`INFO: [UI] Successfully added workout ${workoutId} to track at day ${dayNumber}`,
				)
			}

			// Close dialog after successful addition
			setShowAddDialog(false)
			toast.success(
				`Successfully added ${workoutIds.length} workout${
					workoutIds.length === 1 ? "" : "s"
				} to track`,
			)
		} catch (error) {
			console.error("Failed to add workouts to track:", error)
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to add workouts to track",
			)
		}
	}

	const _handleUpdateWorkout = async (
		trackWorkoutId: string,
		updates: {
			dayNumber?: number
			weekNumber?: number
			notes?: string
		},
	) => {
		console.log(
			`DEBUG: [UI] Updating track workout: ${trackWorkoutId} with updates:`,
			JSON.stringify(updates),
		)

		try {
			// Optimistic update wrapped in startTransition
			startTransition(() => {
				setOptimisticTrackWorkouts({
					type: "update",
					trackWorkoutId,
					updates: { ...updates, updatedAt: new Date() },
				})
			})

			const [result, error] = await updateTrackWorkoutAction({
				teamId,
				trackId,
				trackWorkoutId,
				...updates,
			})

			if (error || !result?.success) {
				throw new Error(error?.message || "Failed to update track workout")
			}
		} catch (error) {
			console.error("Error updating track workout:", error)
			// The optimistic update will be reverted automatically
		}
	}

	return (
		<div className="space-y-6">
			{/* Header with Add Workout Button */}
			<div className="flex justify-between items-center">
				<div>
					<h3 className="text-lg font-semibold font-mono tracking-tight">
						Track Workouts
					</h3>
					<p className="text-sm text-muted-foreground font-mono">
						{optimisticTrackWorkouts.length} workout
						{optimisticTrackWorkouts.length !== 1 ? "s" : ""} in this track
					</p>
				</div>
				{isOwner && (
					<Button
						onClick={() => setShowAddDialog(true)}
						className="border-4 border-transparent hover:border-primary transition-all font-mono rounded-none"
					>
						<Plus className="h-4 w-4 mr-2" />
						Add Workout
					</Button>
				)}
			</div>

			{/* Track Workouts */}
			{optimisticTrackWorkouts.length === 0 ? (
				<Card className="border-4 border-primary shadow-[6px_6px_0px_0px] shadow-primary bg-surface rounded-none">
					<CardContent className="pt-6">
						<div className="text-center py-8">
							<p className="text-muted-foreground mb-4 font-mono">
								No workouts added to this track yet.
							</p>
							{isOwner && (
								<Button
									onClick={() => setShowAddDialog(true)}
									className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono rounded-none"
								>
									<Plus className="h-4 w-4 mr-2" />
									Add First Workout
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					<div className="track-workout-management">
						{sortedTrackWorkouts.map((trackWorkout, index) => {
							const workoutDetails = userWorkouts.find(
								(workout) => workout.id === trackWorkout.workoutId,
							)
							return (
								<TrackWorkoutRow
									key={trackWorkout.id}
									_teamId={teamId}
									_trackId={trackId}
									trackWorkout={trackWorkout}
									workoutDetails={workoutDetails}
									track={_track}
									index={index}
									instanceId={instanceId}
									canEdit={isOwner}
									onAlignScaling={async () => {
										// Show confirmation dialog
										if (workoutDetails && isOwner) {
											setAlignDialogState({
												open: true,
												workout: workoutDetails,
											})
										}
									}}
								/>
							)
						})}
					</div>
				</div>
			)}

			{/* Align Scaling Confirmation Dialog */}
			{isOwner && alignDialogState.workout && (
				<AlignScalingDialog
					open={alignDialogState.open}
					onOpenChange={(open) =>
						setAlignDialogState((prev) => ({ ...prev, open }))
					}
					workout={alignDialogState.workout}
					track={_track}
					onConfirm={async () => {
						if (!alignDialogState.workout) return

						try {
							// Use enhanced action to check for migration needs
							const [result, error] =
								await enhancedAlignWorkoutScalingWithTrackAction({
									workoutId: alignDialogState.workout.id,
									trackId,
									teamId,
								})

							if (error) {
								toast.error(error.message || "Failed to align workout scaling")
								return
							}

							if (
								result &&
								!Array.isArray(result) &&
								result.success &&
								"action" in result
							) {
								if (result.action === "already_aligned") {
									toast.info(result.message || "Workout is already aligned")
									setAlignDialogState({ open: false, workout: null })
								} else if (result.action === "requires_migration") {
									// Show migration dialog
									setMigrationDialogState({
										open: true,
										data: result.data as unknown as {
											workout: Workout
											track: ProgrammingTrack
											existingDescriptions: Array<
												WorkoutScalingDescription & {
													scalingLevel: ScalingLevel
												}
											>
											newScalingLevels: Array<ScalingLevel>
										},
									})
									setAlignDialogState({ open: false, workout: null })
								} else {
									toast.success("Workout scaling aligned with track")

									// Trigger a refresh of the track workouts to show updated scaling
									window.location.reload()
								}
							}
						} catch (error) {
							console.error("Failed to align workout scaling:", error)
							toast.error("Failed to align workout scaling with track")
						}
					}}
				/>
			)}

			{/* Scaling Migration Dialog */}
			{isOwner && migrationDialogState.data && (
				<ScalingMigrationDialog
					open={migrationDialogState.open}
					onOpenChange={(open) =>
						setMigrationDialogState((prev) => ({ ...prev, open }))
					}
					originalWorkout={migrationDialogState.data.workout}
					originalDescriptions={migrationDialogState.data.existingDescriptions}
					newScalingLevels={migrationDialogState.data.newScalingLevels}
					onMigrate={async (mappings: DescriptionMapping[]) => {
						if (!migrationDialogState.data) return

						try {
							const [result, error] =
								await completeWorkoutRemixWithScalingMigrationAction({
									workoutId: migrationDialogState.data.workout.id,
									trackId,
									teamId,
									mappings,
								})

							if (error) {
								toast.error(
									error.message || "Failed to complete scaling migration",
								)
								return
							}

							if (result?.success) {
								toast.success(
									result.message ||
										"Workout scaling aligned with descriptions migrated",
								)

								// Trigger a refresh of the track workouts
								window.location.reload()
							}
						} catch (error) {
							console.error("Failed to complete scaling migration:", error)
							toast.error("Failed to complete scaling migration")
						}
					}}
					onSkip={async () => {
						if (!migrationDialogState.data) return

						try {
							// Complete remix without migration
							const [result, error] =
								await completeWorkoutRemixWithScalingMigrationAction({
									workoutId: migrationDialogState.data.workout.id,
									trackId,
									teamId,
								})

							if (error) {
								toast.error(error.message || "Failed to align workout scaling")
								return
							}

							if (result?.success) {
								toast.success(
									result.message || "Workout scaling aligned with track",
								)

								// Trigger a refresh of the track workouts
								window.location.reload()
							}
						} catch (error) {
							console.error("Failed to align workout scaling:", error)
							toast.error("Failed to align workout scaling with track")
						}
					}}
				/>
			)}

			{/* Add Workout Dialog */}
			{isOwner && (
				<AddWorkoutToTrackDialog
					open={showAddDialog}
					onCloseAction={() => setShowAddDialog(false)}
					onAddWorkoutsAction={handleAddWorkouts}
					teamId={teamId}
					trackId={trackId}
					existingDays={optimisticTrackWorkouts.map((tw) => tw.dayNumber)}
					existingWorkoutIds={optimisticTrackWorkouts.map((tw) => tw.workoutId)}
					userWorkouts={userWorkouts}
					movements={movements}
					tags={tags}
					userId={userId}
				/>
			)}
		</div>
	)
}
