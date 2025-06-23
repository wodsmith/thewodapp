"use client"

import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Workout } from "@/db/schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { WorkoutSelectionList } from "./workout-selection-list"

const addWorkoutFormSchema = z.object({
	workoutId: z.string().min(1, "Please select a workout"),
	dayNumber: z.number().min(1, "Day number must be at least 1"),
	weekNumber: z.number().min(1).optional(),
	notes: z.string().max(1000, "Notes are too long").optional(),
})

type AddWorkoutFormData = z.infer<typeof addWorkoutFormSchema>

interface AddWorkoutToTrackDialogProps {
	open: boolean
	onCloseAction: () => void
	onAddWorkoutAction: (data: {
		workoutId: string
		dayNumber: number
		weekNumber?: number
		notes?: string
	}) => Promise<void>
	teamId: string
	trackId: string
	existingDays: number[]
}

export function AddWorkoutToTrackDialog({
	open,
	onCloseAction,
	onAddWorkoutAction,
	teamId,
	trackId,
	existingDays,
}: AddWorkoutToTrackDialogProps) {
	const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
	const [showWorkoutSelection, setShowWorkoutSelection] = useState(true)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const form = useForm<AddWorkoutFormData>({
		resolver: zodResolver(addWorkoutFormSchema),
		defaultValues: {
			dayNumber: Math.max(...existingDays, 0) + 1, // Next available day
			weekNumber: undefined,
			notes: "",
		},
	})

	// Reset form when dialog opens/closes
	useEffect(() => {
		if (open) {
			form.reset({
				dayNumber: Math.max(...existingDays, 0) + 1,
				weekNumber: undefined,
				notes: "",
			})
			setSelectedWorkout(null)
			setShowWorkoutSelection(true)
		}
	}, [open, existingDays, form])

	const handleWorkoutSelect = (workout: Workout) => {
		setSelectedWorkout(workout)
		form.setValue("workoutId", workout.id)
		setShowWorkoutSelection(false)
	}

	const handleBackToSelection = () => {
		setSelectedWorkout(null)
		setShowWorkoutSelection(true)
		form.setValue("workoutId", "")
	}

	const handleSubmit = async (data: AddWorkoutFormData) => {
		if (!selectedWorkout) return

		setIsSubmitting(true)
		try {
			await onAddWorkoutAction({
				workoutId: data.workoutId,
				dayNumber: data.dayNumber,
				weekNumber: data.weekNumber,
				notes: data.notes,
			})
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={(open) => !open && onCloseAction()}>
			<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Add Workout to Track</DialogTitle>
					<DialogDescription>
						{showWorkoutSelection
							? "Select a workout to add to this programming track."
							: `Configure details for "${selectedWorkout?.name}"`}
					</DialogDescription>
				</DialogHeader>

				{showWorkoutSelection ? (
					<WorkoutSelectionList
						teamId={teamId}
						onWorkoutSelectAction={handleWorkoutSelect}
					/>
				) : (
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="space-y-4"
						>
							{/* Selected Workout Display */}
							<div className="border rounded-lg p-4 bg-muted/50">
								<div className="flex justify-between items-start">
									<div>
										<h4 className="font-semibold">{selectedWorkout?.name}</h4>
										{selectedWorkout?.description && (
											<p className="text-sm text-muted-foreground mt-1">
												{selectedWorkout.description}
											</p>
										)}
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleBackToSelection}
									>
										Change Workout
									</Button>
								</div>
							</div>

							{/* Day Number */}
							<FormField
								control={form.control}
								name="dayNumber"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Day Number</FormLabel>
										<FormControl>
											<Input
												type="number"
												min="1"
												{...field}
												onChange={(e) =>
													field.onChange(Number.parseInt(e.target.value))
												}
											/>
										</FormControl>
										<FormDescription>
											The day number in the track (e.g., Day 1, Day 2, etc.)
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Week Number */}
							<FormField
								control={form.control}
								name="weekNumber"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Week Number (Optional)</FormLabel>
										<FormControl>
											<Input
												type="number"
												min="1"
												{...field}
												onChange={(e) =>
													field.onChange(
														e.target.value
															? Number.parseInt(e.target.value)
															: undefined,
													)
												}
											/>
										</FormControl>
										<FormDescription>
											The week number in the track (leave empty if not
											applicable)
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Notes */}
							<FormField
								control={form.control}
								name="notes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Notes (Optional)</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Add any specific notes for this workout in the track..."
												{...field}
											/>
										</FormControl>
										<FormDescription>
											Optional notes or modifications for this workout
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<DialogFooter>
								<Button type="button" variant="outline" onClick={onCloseAction}>
									Cancel
								</Button>
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Adding..." : "Add Workout"}
								</Button>
							</DialogFooter>
						</form>
					</Form>
				)}
			</DialogContent>
		</Dialog>
	)
}
