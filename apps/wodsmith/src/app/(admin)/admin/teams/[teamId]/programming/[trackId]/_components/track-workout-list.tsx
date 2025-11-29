"use client"

import { Edit2, GripVertical, Save, Trash2, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { TrackWorkout } from "@/db/schema"

interface TrackWorkoutListProps {
	trackWorkouts: (TrackWorkout & {
		isScheduled?: boolean
		lastScheduledAt?: Date | null
		workoutDetails?: {
			name: string
			description: string
			scheme: string
		}
	})[]
	onRemoveWorkoutAction: (trackWorkoutId: string) => Promise<void>
	onUpdateWorkoutAction: (
		trackWorkoutId: string,
		updates: {
			trackOrder?: number
			notes?: string
			pointsMultiplier?: number
		},
	) => Promise<void>
}

export function TrackWorkoutList({
	trackWorkouts,
	onRemoveWorkoutAction,
	onUpdateWorkoutAction,
}: TrackWorkoutListProps) {
	const [editingWorkout, setEditingWorkout] = useState<string | null>(null)
	const [editForm, setEditForm] = useState<{
		trackOrder: number
		notes?: string
	}>({
		trackOrder: 1,
		notes: "",
	})

	// Sort workouts by track order
	const sortedWorkouts = [...trackWorkouts].sort(
		(a, b) => a.trackOrder - b.trackOrder,
	)

	const handleStartEdit = (workout: TrackWorkout) => {
		setEditingWorkout(workout.id)
		setEditForm({
			trackOrder: workout.trackOrder,
			notes: workout.notes || "",
		})
	}

	const handleCancelEdit = () => {
		setEditingWorkout(null)
		setEditForm({
			trackOrder: 1,
			notes: "",
		})
	}

	const handleSaveEdit = async (workoutId: string) => {
		try {
			await onUpdateWorkoutAction(workoutId, editForm)
			setEditingWorkout(null)
		} catch (error) {
			console.error("Failed to update workout:", error)
		}
	}

	const handleRemove = async (workoutId: string) => {
		if (
			confirm("Are you sure you want to remove this workout from the track?")
		) {
			try {
				await onRemoveWorkoutAction(workoutId)
			} catch (error) {
				console.error("Failed to remove workout:", error)
			}
		}
	}

	if (sortedWorkouts.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground font-mono">
				No workouts in this track yet.
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{sortedWorkouts.map((workout) => (
				<Card
					key={workout.id}
					className="relative border-2 border-primary shadow-primary bg-surface rounded-none"
				>
					{editingWorkout === workout.id ? (
						<CardContent className="pt-6">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div>
									<Label
										htmlFor={`order-${workout.id}`}
										className="font-mono font-semibold"
									>
										Order
									</Label>
									<Input
										id={`order-${workout.id}`}
										type="number"
										min="1"
										value={editForm.trackOrder}
										onChange={(e) =>
											setEditForm((prev) => ({
												...prev,
												trackOrder: Number.parseInt(e.target.value),
											}))
										}
										className="border-2 border-primary rounded-none font-mono"
									/>
								</div>
								<div className="md:col-span-2">
									<Label
										htmlFor={`notes-${workout.id}`}
										className="font-mono font-semibold"
									>
										Notes
									</Label>
									<Textarea
										id={`notes-${workout.id}`}
										value={editForm.notes || ""}
										onChange={(e) =>
											setEditForm((prev) => ({
												...prev,
												notes: e.target.value,
											}))
										}
										placeholder="Optional workout notes..."
										rows={3}
										className="border-2 border-primary rounded-none font-mono"
									/>
								</div>
							</div>
							<div className="flex gap-2 mt-4">
								<Button
									onClick={() => handleSaveEdit(workout.id)}
									className="border-2 border-transparent hover:border-green-500 transition-all font-mono bg-green-500 text-white hover:bg-green-600 rounded-none"
								>
									<Save className="h-4 w-4 mr-2" />
									Save
								</Button>
								<Button
									onClick={handleCancelEdit}
									className="border-2 border-transparent hover:border-primary transition-all font-mono bg-white text-primary hover:bg-surface rounded-none"
								>
									<X className="h-4 w-4 mr-2" />
									Cancel
								</Button>
							</div>
						</CardContent>
					) : (
						<>
							<CardHeader className="pb-2">
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-2">
										<GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
										<div>
											<CardTitle className="text-base font-mono tracking-tight">
												#{workout.trackOrder}
											</CardTitle>
											<div className="flex gap-4 text-xs text-muted-foreground mt-1 font-mono">
												<span>Workout ID: {workout.workoutId}</span>
												{workout.isScheduled && (
													<span className="text-green-600">● Scheduled</span>
												)}
											</div>
										</div>
									</div>
									<div className="flex gap-1">
										<Button
											onClick={() => handleStartEdit(workout)}
											className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-white text-primary hover:bg-surface rounded-none"
										>
											<Edit2 className="h-4 w-4" />
										</Button>
										<Button
											onClick={() => handleRemove(workout.id)}
											className="border-2 border-red-500 shadow-[4px_4px_0px_0px] shadow-red-500 hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-white text-red-500 hover:bg-red-50 rounded-none"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</CardHeader>
							{workout.notes && (
								<CardContent className="pt-0">
									<div className="bg-surface border-2 border-primary rounded-none p-3">
										<p className="text-sm font-mono">{workout.notes}</p>
									</div>
								</CardContent>
							)}
							{workout.workoutDetails && (
								<CardContent className="pt-0">
									<div className="bg-surface border-2 border-primary rounded-none p-3">
										<p className="text-sm font-mono font-semibold">
											{workout.workoutDetails.name}
										</p>
										<p className="text-sm font-mono text-muted-foreground">
											{workout.workoutDetails.description}
										</p>
										<p className="text-sm font-mono text-muted-foreground">
											Scheme: {workout.workoutDetails.scheme}
										</p>
									</div>
								</CardContent>
							)}
						</>
					)}
				</Card>
			))}
		</div>
	)
}
