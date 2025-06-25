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
import { Plus } from "lucide-react"
import { startTransition, useOptimistic, useState } from "react"
import {
	addWorkoutToTrackAction,
	removeWorkoutFromTrackAction,
	updateTrackWorkoutAction,
} from "../../../_actions/programming-track-actions"
import { AddWorkoutToTrackDialog } from "./add-workout-to-track-dialog"
import { TrackWorkoutList } from "./track-workout-list"

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
				  },
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
				default:
					return state
			}
		},
	)

	const handleAddWorkout = async (data: {
		workoutId: string
		dayNumber: number
		weekNumber?: number
		notes?: string
	}) => {
		console.log(
			"DEBUG: [UI] Adding workout to track with data:",
			JSON.stringify(data),
		)

		try {
			// Optimistic update wrapped in startTransition
			startTransition(() => {
				const tempTrackWorkout: TrackWorkout = {
					id: `temp_${Date.now()}`,
					trackId,
					workoutId: data.workoutId,
					dayNumber: data.dayNumber,
					weekNumber: data.weekNumber || null,
					notes: data.notes || null,
					updateCounter: null,
					createdAt: new Date(),
					updatedAt: new Date(),
				}
				setOptimisticTrackWorkouts({ type: "add", workout: tempTrackWorkout })
			})

			const [result, error] = await addWorkoutToTrackAction({
				teamId,
				trackId,
				workoutId: data.workoutId,
				dayNumber: data.dayNumber,
				weekNumber: data.weekNumber,
				notes: data.notes,
			})

			if (error || !result?.success) {
				throw new Error(error?.message || "Failed to add workout to track")
			}

			setShowAddDialog(false)
		} catch (error) {
			console.error("Error adding workout to track:", error)
			// The optimistic update will be reverted automatically
		}
	}

	const handleRemoveWorkout = async (trackWorkoutId: string) => {
		console.log(`DEBUG: [UI] Removing workout from track: ${trackWorkoutId}`)

		try {
			// Optimistic update wrapped in startTransition
			startTransition(() => {
				setOptimisticTrackWorkouts({ type: "remove", trackWorkoutId })
			})

			const [result, error] = await removeWorkoutFromTrackAction({
				teamId,
				trackId,
				trackWorkoutId,
			})

			if (error || !result?.success) {
				throw new Error(error?.message || "Failed to remove workout from track")
			}
		} catch (error) {
			console.error("Error removing workout from track:", error)
			// The optimistic update will be reverted automatically
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
					className="border-4 border-primary shadow-[6px_6px_0px_0px] shadow-primary hover:shadow-[4px_4px_0px_0px] transition-all font-mono rounded-none"
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
					{optimisticTrackWorkouts.map((trackWorkout, index) => {
						const workoutDetails = userWorkouts.find(
							(workout) => workout.id === trackWorkout.workoutId,
						)
						return (
							<div
								key={trackWorkout.id}
								className="border border-primary p-4 rounded-md shadow-md w-fit"
							>
								<div className="flex items-center justify-between">
									<span className="text-sm font-bold">
										{index + 1}
										{trackWorkout.isScheduled && (
											<span className="ml-2 text-green-400 text-sm">
												● Scheduled
											</span>
										)}
									</span>
									<button
										type="button"
										onClick={() => handleRemoveWorkout(trackWorkout.id)}
										className="text-red-500 hover:text-red-700"
									>
										Remove
									</button>
								</div>
								{workoutDetails && (
									<div className="mt-2">
										<h4 className="text-xl font-semibold">
											{workoutDetails.name}
										</h4>
										<p className="text-sm text-gray-600">
											Scheme: {workoutDetails.scheme}
										</p>
										<p className="text-xl">{workoutDetails.description}</p>
									</div>
								)}
							</div>
						)
					})}
				</div>
			)}

			{/* Add Workout Dialog */}
			<AddWorkoutToTrackDialog
				open={showAddDialog}
				onCloseAction={() => setShowAddDialog(false)}
				onAddWorkoutAction={handleAddWorkout}
				teamId={teamId}
				trackId={trackId}
				existingDays={optimisticTrackWorkouts.map((tw) => tw.dayNumber)}
				userWorkouts={userWorkouts}
				movements={movements}
				tags={tags}
				userId={userId}
			/>
		</div>
	)
}
