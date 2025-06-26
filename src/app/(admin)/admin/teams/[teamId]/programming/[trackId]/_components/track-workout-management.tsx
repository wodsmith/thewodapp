"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
	Movement,
	ProgrammingTrack,
	Tag,
	TrackWorkout,
	Workout,
} from "@/db/schema"
import {
	type Edge,
	extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index"
import { DragHandleButton } from "@atlaskit/pragmatic-drag-and-drop-react-accessibility/drag-handle-button"
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box"
import {
	type ElementDropTargetEventBasePayload,
	dropTargetForElements,
	monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder"
import { Plus } from "lucide-react"
import {
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useOptimistic,
	useRef,
	useState,
} from "react"
import { toast } from "sonner"
import {
	addWorkoutToTrackAction,
	removeWorkoutFromTrackAction,
	updateTrackWorkoutAction,
} from "../../../_actions/programming-track-actions"
import { AddWorkoutToTrackDialog } from "./add-workout-to-track-dialog"
import { TrackWorkoutRow } from "./track-workout-row"

// Type definitions for drag and drop
const trackWorkoutKey = Symbol("track-workout")
type TrackWorkoutData = {
	[trackWorkoutKey]: true
	trackWorkout: TrackWorkout & {
		isScheduled?: boolean
		lastScheduledAt?: Date | null
	}
	index: number
	instanceId: symbol
}

function getTrackWorkoutData({
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

function isTrackWorkoutData(
	data: Record<string | symbol, unknown>,
): data is TrackWorkoutData {
	return data[trackWorkoutKey] === true
}

interface TrackWorkoutManagementProps {
	teamId: string
	trackId: string
	track: ProgrammingTrack
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
}

export function TrackWorkoutManagement({
	teamId,
	trackId,
	track,
	initialTrackWorkouts,
	userWorkouts,
	movements,
	tags,
	userId,
}: TrackWorkoutManagementProps) {
	const [showAddDialog, setShowAddDialog] = useState(false)

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
			switch (action.type) {
				case "add":
					return [...state, { ...action.workout, isScheduled: false }]
				case "remove":
					return state.filter((tw) => tw.id !== action.trackWorkoutId)
				case "update":
					return state.map((tw) =>
						tw.id === action.trackWorkoutId ? { ...tw, ...action.updates } : tw,
					)
				case "reorder": {
					return reorder({
						list: state,
						startIndex: action.sourceIndex,
						finishIndex: action.destinationIndex,
					})
				}
				default:
					return state
			}
		},
	)

	// Instance ID for isolating drag and drop
	const [instanceId] = useState(() => Symbol("track-workout-instance"))

	const reorderTrackWorkout = useCallback(
		({
			startIndex,
			indexOfTarget,
			closestEdgeOfTarget,
		}: {
			startIndex: number
			indexOfTarget: number
			closestEdgeOfTarget: Edge | null
		}) => {
			const finishIndex = getReorderDestinationIndex({
				startIndex,
				closestEdgeOfTarget,
				indexOfTarget,
				axis: "vertical",
			})

			if (finishIndex === startIndex) {
				return
			}

			startTransition(() => {
				setOptimisticTrackWorkouts({
					type: "reorder",
					sourceIndex: startIndex,
					destinationIndex: finishIndex,
				})
			})
		},
		[setOptimisticTrackWorkouts],
	)

	useEffect(() => {
		return monitorForElements({
			canMonitor({ source }) {
				return (
					isTrackWorkoutData(source.data) &&
					source.data.instanceId === instanceId
				)
			},
			onDrop({ location, source }) {
				const target = location.current.dropTargets[0]
				if (!target) {
					return
				}

				const sourceData = source.data
				const targetData = target.data
				if (
					!isTrackWorkoutData(sourceData) ||
					!isTrackWorkoutData(targetData)
				) {
					return
				}

				const indexOfTarget = optimisticTrackWorkouts.findIndex(
					(tw) => tw.id === targetData.trackWorkout.id,
				)
				if (indexOfTarget < 0) {
					return
				}

				const closestEdgeOfTarget = extractClosestEdge(targetData)

				reorderTrackWorkout({
					startIndex: sourceData.index,
					indexOfTarget,
					closestEdgeOfTarget,
				})
			},
		})
	}, [instanceId, optimisticTrackWorkouts, reorderTrackWorkout])

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
						createdAt: new Date(),
						updatedAt: new Date(),
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

	const handleUpdateWorkout = async (
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
				<Button
					onClick={() => setShowAddDialog(true)}
					className="border-4 border-transparent hover:border-primary transition-all font-mono rounded-none"
				>
					<Plus className="h-4 w-4 mr-2" />
					Add Workout
				</Button>
			</div>

			{/* Track Workouts */}
			{optimisticTrackWorkouts.length === 0 ? (
				<Card className="border-4 border-primary shadow-[6px_6px_0px_0px] shadow-primary bg-surface rounded-none">
					<CardContent className="pt-6">
						<div className="text-center py-8">
							<p className="text-muted-foreground mb-4 font-mono">
								No workouts added to this track yet.
							</p>
							<Button
								onClick={() => setShowAddDialog(true)}
								className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono rounded-none"
							>
								<Plus className="h-4 w-4 mr-2" />
								Add First Workout
							</Button>
						</div>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					<div className="track-workout-management">
						{optimisticTrackWorkouts
							.sort((a, b) => b.dayNumber - a.dayNumber)
							.map((trackWorkout, index) => {
								const workoutDetails = userWorkouts.find(
									(workout) => workout.id === trackWorkout.workoutId,
								)
								return (
									<TrackWorkoutRow
										key={trackWorkout.id}
										teamId={teamId}
										trackId={trackId}
										trackWorkout={trackWorkout}
										workoutDetails={workoutDetails}
										index={index}
										instanceId={instanceId}
									/>
								)
							})}
					</div>
				</div>
			)}

			{/* Add Workout Dialog */}
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
		</div>
	)
}
