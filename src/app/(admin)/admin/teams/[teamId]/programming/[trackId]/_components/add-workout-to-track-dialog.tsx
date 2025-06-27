"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import type { Movement, Tag, Workout } from "@/db/schema"
import { WorkoutSelectionList } from "./workout-selection-list"

interface AddWorkoutToTrackDialogProps {
	open: boolean
	onCloseAction: () => void
	onAddWorkoutsAction: (workoutIds: string[]) => Promise<void>
	teamId: string
	trackId: string
	existingDays: number[]
	existingWorkoutIds: string[]
	userWorkouts: (Workout & {
		tags: { id: string; name: string }[]
		movements: { id: string; name: string }[]
		lastScheduledAt?: Date | null
	})[]
	movements: Movement[]
	tags: Tag[]
	userId: string
}

export function AddWorkoutToTrackDialog({
	open,
	onCloseAction,
	onAddWorkoutsAction,
	teamId,
	trackId,
	existingDays,
	existingWorkoutIds,
	userWorkouts,
	movements,
	tags,
	userId,
}: AddWorkoutToTrackDialogProps) {
	const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<string[]>([])
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Reset selection when dialog opens/closes
	useEffect(() => {
		if (open) {
			setSelectedWorkoutIds([])
		}
	}, [open])

	const handleWorkoutToggle = (workoutId: string) => {
		setSelectedWorkoutIds((prev) =>
			prev.includes(workoutId)
				? prev.filter((id) => id !== workoutId)
				: [...prev, workoutId],
		)
	}

	const handleSubmit = async () => {
		if (selectedWorkoutIds.length === 0) return

		setIsSubmitting(true)
		try {
			await onAddWorkoutsAction(selectedWorkoutIds)
		} finally {
			setIsSubmitting(false)
		}
	}

	const getNextDayNumber = () => {
		return Math.max(...existingDays, 0) + 1
	}

	return (
		<Dialog open={open} onOpenChange={(open) => !open && onCloseAction()}>
			<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto border-4 border-primary shadow-[8px_8px_0px_0px] shadow-primary rounded-none">
				<DialogHeader>
					<DialogTitle className="font-mono text-xl tracking-tight">
						Add Workouts to Track
					</DialogTitle>
					<DialogDescription className="font-mono">
						Select one or more workouts to add to this programming track. Each
						workout will be assigned an auto-incrementing day number starting
						from day {getNextDayNumber()}.
						{selectedWorkoutIds.length > 0 ? (
							<span className="block mt-2 font-semibold text-primary">
								{selectedWorkoutIds.length} workout
								{selectedWorkoutIds.length === 1 ? "" : "s"} selected
							</span>
						) : (
							<div className="h-[20px] block mt-2" />
						)}
					</DialogDescription>
				</DialogHeader>

				<WorkoutSelectionList
					teamId={teamId}
					trackId={trackId}
					onWorkoutToggleAction={handleWorkoutToggle}
					selectedWorkoutIds={selectedWorkoutIds}
					existingWorkoutIds={existingWorkoutIds}
					userWorkouts={userWorkouts}
					movements={movements}
					tags={tags}
					userId={userId}
					multiSelect={true}
				/>

				<DialogFooter>
					<Button
						type="button"
						onClick={onCloseAction}
						className="border-2 border-transparent hover:border-primary transition-all font-mono bg-black text-primary hover:bg-surface rounded-none"
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={handleSubmit}
						disabled={isSubmitting || selectedWorkoutIds.length === 0}
						className="border-2 border-transparent hover:border-primary transition-all font-mono rounded-none"
					>
						{isSubmitting
							? "Adding..."
							: `Add ${selectedWorkoutIds.length} Workout${
									selectedWorkoutIds.length === 1 ? "" : "s"
								}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
