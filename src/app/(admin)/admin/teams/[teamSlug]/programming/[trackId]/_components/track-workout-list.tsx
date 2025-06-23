"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { TrackWorkout } from "@/db/schema"
import { Edit2, GripVertical, Save, Trash2, X } from "lucide-react"
import { useState } from "react"

interface TrackWorkoutListProps {
	trackWorkouts: (TrackWorkout & {
		isScheduled?: boolean
		lastScheduledAt?: Date | null
	})[]
	onRemoveWorkoutAction: (trackWorkoutId: string) => Promise<void>
	onUpdateWorkoutAction: (
		trackWorkoutId: string,
		updates: {
			dayNumber?: number
			weekNumber?: number
			notes?: string
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
		dayNumber: number
		weekNumber?: number
		notes?: string
	}>({
		dayNumber: 1,
		weekNumber: undefined,
		notes: "",
	})

	// Sort workouts by day number
	const sortedWorkouts = [...trackWorkouts].sort(
		(a, b) => a.dayNumber - b.dayNumber,
	)

	const handleStartEdit = (workout: TrackWorkout) => {
		setEditingWorkout(workout.id)
		setEditForm({
			dayNumber: workout.dayNumber,
			weekNumber: workout.weekNumber || undefined,
			notes: workout.notes || "",
		})
	}

	const handleCancelEdit = () => {
		setEditingWorkout(null)
		setEditForm({
			dayNumber: 1,
			weekNumber: undefined,
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
			<div className="text-center py-8 text-muted-foreground">
				No workouts in this track yet.
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{sortedWorkouts.map((workout) => (
				<Card key={workout.id} className="relative">
					{editingWorkout === workout.id ? (
						<CardContent className="pt-6">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div>
									<Label htmlFor={`day-${workout.id}`}>Day Number</Label>
									<Input
										id={`day-${workout.id}`}
										type="number"
										min="1"
										value={editForm.dayNumber}
										onChange={(e) =>
											setEditForm((prev) => ({
												...prev,
												dayNumber: Number.parseInt(e.target.value),
											}))
										}
									/>
								</div>
								<div>
									<Label htmlFor={`week-${workout.id}`}>Week Number</Label>
									<Input
										id={`week-${workout.id}`}
										type="number"
										min="1"
										value={editForm.weekNumber || ""}
										onChange={(e) =>
											setEditForm((prev) => ({
												...prev,
												weekNumber: e.target.value
													? Number.parseInt(e.target.value)
													: undefined,
											}))
										}
										placeholder="Optional"
									/>
								</div>
								<div className="md:col-span-3">
									<Label htmlFor={`notes-${workout.id}`}>Notes</Label>
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
									/>
								</div>
							</div>
							<div className="flex gap-2 mt-4">
								<Button size="sm" onClick={() => handleSaveEdit(workout.id)}>
									<Save className="h-4 w-4 mr-2" />
									Save
								</Button>
								<Button size="sm" variant="outline" onClick={handleCancelEdit}>
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
											<CardTitle className="text-base">
												Day {workout.dayNumber}
												{workout.weekNumber && ` (Week ${workout.weekNumber})`}
											</CardTitle>
											<div className="flex gap-4 text-xs text-muted-foreground mt-1">
												<span>Workout ID: {workout.workoutId}</span>
												{workout.isScheduled && (
													<span className="text-green-600">● Scheduled</span>
												)}
											</div>
										</div>
									</div>
									<div className="flex gap-1">
										<Button
											size="sm"
											variant="outline"
											onClick={() => handleStartEdit(workout)}
										>
											<Edit2 className="h-4 w-4" />
										</Button>
										<Button
											size="sm"
											variant="outline"
											onClick={() => handleRemove(workout.id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</CardHeader>
							{workout.notes && (
								<CardContent className="pt-0">
									<div className="bg-muted/50 rounded p-3">
										<p className="text-sm">{workout.notes}</p>
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
