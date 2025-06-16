import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import React from "react"
import type { ScheduledWorkoutWithDetails } from "./types"

interface ScheduledWorkoutsProps {
	scheduledWorkouts: ScheduledWorkoutWithDetails[]
	selectedDate: Date | null
	editingScheduled: string | null
	onEdit: (scheduled: ScheduledWorkoutWithDetails) => void
	onUpdate: (instanceId: string) => void
	onDelete: (instanceId: string) => void
	isUpdating: boolean
	isDeleting: boolean
	isLoading: boolean
	// Form state props
	classTimes: string
	teamNotes: string
	scalingGuidance: string
	onClassTimesChange: (value: string) => void
	onTeamNotesChange: (value: string) => void
	onScalingGuidanceChange: (value: string) => void
	onCancelEdit: () => void
}

export function ScheduledWorkouts({
	scheduledWorkouts,
	selectedDate,
	editingScheduled,
	onEdit,
	onUpdate,
	onDelete,
	isUpdating,
	isDeleting,
	isLoading,
	classTimes,
	teamNotes,
	scalingGuidance,
	onClassTimesChange,
	onTeamNotesChange,
	onScalingGuidanceChange,
	onCancelEdit,
}: ScheduledWorkoutsProps) {
	const handleEdit = (scheduled: ScheduledWorkoutWithDetails) => {
		if (process.env.LOG_LEVEL === "info") {
			console.log(
				`INFO: [ScheduledWorkouts] Editing scheduled workout ${scheduled.id}`,
			)
		}
		onEdit(scheduled)
	}

	const handleUpdate = (instanceId: string) => {
		if (process.env.LOG_LEVEL === "info") {
			console.log(
				`INFO: [ScheduledWorkouts] Updating scheduled workout ${instanceId}`,
			)
		}
		onUpdate(instanceId)
	}

	const handleDelete = (instanceId: string) => {
		if (!confirm("Are you sure you want to remove this scheduled workout?")) {
			return
		}
		onDelete(instanceId)
	}

	if (scheduledWorkouts.length === 0) {
		return null
	}

	return (
		<div className="space-y-4 border-b pb-6 mb-6">
			<h3 className="text-lg font-semibold">
				Scheduled Workouts for {selectedDate?.toDateString()}
			</h3>
			{isLoading ? (
				<div className="text-center text-muted-foreground">
					Loading scheduled workouts...
				</div>
			) : (
				<div className="space-y-3">
					{scheduledWorkouts.map((scheduled) => (
						<Card
							key={scheduled.id}
							className="p-4"
							data-testid="scheduled-workout-card"
						>
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<h4 className="font-medium text-sm mb-1">
										{scheduled.trackWorkout?.workout?.name || "Unknown Workout"}
									</h4>
									<p className="text-xs text-muted-foreground mb-2">
										{scheduled.trackWorkout?.dayNumber &&
											`Day ${scheduled.trackWorkout.dayNumber}`}
										{scheduled.trackWorkout?.weekNumber &&
											` - Week ${scheduled.trackWorkout.weekNumber}`}
									</p>
									{scheduled.teamSpecificNotes && (
										<p className="text-xs text-muted-foreground mb-1">
											<strong>Notes:</strong> {scheduled.teamSpecificNotes}
										</p>
									)}
									{scheduled.scalingGuidanceForDay && (
										<p className="text-xs text-muted-foreground mb-1">
											<strong>Scaling:</strong>{" "}
											{scheduled.scalingGuidanceForDay}
										</p>
									)}
									{scheduled.classTimes && (
										<p className="text-xs text-muted-foreground">
											<strong>Class Times:</strong> {scheduled.classTimes}
										</p>
									)}
								</div>
								<div className="flex gap-2 ml-4">
									<Button
										size="sm"
										variant="outline"
										onClick={() => handleEdit(scheduled)}
										disabled={isUpdating || isDeleting}
									>
										Edit
									</Button>
									<Button
										size="sm"
										variant="destructive"
										onClick={() => handleDelete(scheduled.id)}
										disabled={isUpdating || isDeleting}
									>
										Remove
									</Button>
								</div>
							</div>

							{/* Edit form for this scheduled workout */}
							{editingScheduled === scheduled.id && (
								<div
									className="mt-4 pt-4 border-t space-y-3"
									data-testid="edit-form"
								>
									<div className="space-y-2">
										<Label htmlFor={`edit-classTimes-${scheduled.id}`}>
											Class Times (optional)
										</Label>
										<Input
											id={`edit-classTimes-${scheduled.id}`}
											placeholder="e.g., 6:00 AM, 12:00 PM, 6:00 PM"
											value={classTimes}
											onChange={(e) => onClassTimesChange(e.target.value)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor={`edit-teamNotes-${scheduled.id}`}>
											Staff Notes (optional)
										</Label>
										<Textarea
											id={`edit-teamNotes-${scheduled.id}`}
											placeholder="Any team-specific notes..."
											value={teamNotes}
											onChange={(e) => onTeamNotesChange(e.target.value)}
											rows={2}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor={`edit-scalingGuidance-${scheduled.id}`}>
											Scaling Guidance (optional)
										</Label>
										<Textarea
											id={`edit-scalingGuidance-${scheduled.id}`}
											placeholder="Scaling options and modifications..."
											value={scalingGuidance}
											onChange={(e) => onScalingGuidanceChange(e.target.value)}
											rows={2}
										/>
									</div>
									<div className="flex gap-2">
										<Button
											size="sm"
											onClick={() => handleUpdate(scheduled.id)}
											disabled={isUpdating}
										>
											{isUpdating ? "Updating..." : "Update"}
										</Button>
										<Button
											size="sm"
											variant="outline"
											onClick={onCancelEdit}
											disabled={isUpdating}
										>
											Cancel
										</Button>
									</div>
								</div>
							)}
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
