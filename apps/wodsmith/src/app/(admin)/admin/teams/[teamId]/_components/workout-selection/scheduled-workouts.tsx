import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
		<div className="border-b pb-6 mb-6">
			<h3 className="text-lg font-semibold mb-4">
				Scheduled Workouts for {selectedDate?.toDateString()}
			</h3>

			<div className="flex gap-6">
				{/* Scheduled Workout Selection */}
				<section className="max-w-sm">
					<h4 className="font-medium mb-2">Select Scheduled Workout to Edit</h4>
					{isLoading ? (
						<div className="text-center text-muted-foreground">
							Loading scheduled workouts...
						</div>
					) : (
						<div className="space-y-2">
							{scheduledWorkouts.map((scheduled) => (
								<Card
									key={scheduled.id}
									className={`cursor-pointer transition-colors p-3 ${
										editingScheduled === scheduled.id
											? "border-primary bg-primary/10"
											: "hover:bg-muted/50"
									}`}
									onClick={() => handleEdit(scheduled)}
									data-testid="scheduled-workout-card"
								>
									<div className="flex items-start justify-between">
										<div className="flex-1 min-w-0">
											<h5 className="font-medium text-sm truncate">
												{scheduled.trackWorkout?.workout?.name ||
													scheduled.workout?.name ||
													"Unknown Workout"}
											</h5>
											<p className="text-xs text-muted-foreground">
												{scheduled.trackWorkout ? (
													<>
														{scheduled.trackWorkout.dayNumber &&
															`Day ${scheduled.trackWorkout.dayNumber}`}
														{scheduled.trackWorkout.weekNumber &&
															` - Week ${scheduled.trackWorkout.weekNumber}`}
													</>
												) : (
													"Standalone Workout"
												)}
											</p>
										</div>
										<Button
											size="sm"
											variant="destructive"
											onClick={(e) => {
												e.stopPropagation()
												handleDelete(scheduled.id)
											}}
											disabled={isUpdating || isDeleting}
											className="ml-2 flex-shrink-0"
										>
											Remove
										</Button>
									</div>
								</Card>
							))}
						</div>
					)}
				</section>

				{/* Edit Form */}
				{editingScheduled &&
					scheduledWorkouts.some((sw) => sw.id === editingScheduled) && (
						<section className="flex-1 space-y-4 pl-6 border-l ">
							<h4 className="font-medium">Edit Scheduled Workout Notes</h4>
							<div className="space-y-3" data-testid="edit-form">
								<div className="space-y-2">
									<Label htmlFor="edit-classTimes">
										Class Times (optional)
									</Label>
									<Input
										id="edit-classTimes"
										placeholder="e.g., 6:00 AM, 12:00 PM, 6:00 PM"
										value={classTimes}
										onChange={(e) => onClassTimesChange(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-teamNotes">Staff Notes (optional)</Label>
									<Textarea
										id="edit-teamNotes"
										placeholder="Any team-specific notes..."
										value={teamNotes}
										onChange={(e) => onTeamNotesChange(e.target.value)}
										rows={2}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-scalingGuidance">
										Scaling Guidance (optional)
									</Label>
									<Textarea
										id="edit-scalingGuidance"
										placeholder="Scaling options and modifications..."
										value={scalingGuidance}
										onChange={(e) => onScalingGuidanceChange(e.target.value)}
										rows={2}
									/>
								</div>
								<div className="flex gap-2">
									<Button
										size="sm"
										onClick={() => handleUpdate(editingScheduled)}
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
						</section>
					)}

				{/* Placeholder when no workout is selected for editing */}
				{(!editingScheduled ||
					!scheduledWorkouts.some((sw) => sw.id === editingScheduled)) && (
					<section className="flex-1 pl-6 border-l min-h-[405px]">
						<div className="text-center text-muted-foreground py-8">
							Select a scheduled workout to edit
						</div>
					</section>
				)}
			</div>
		</div>
	)
}
