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
import { Textarea } from "@/components/ui/textarea"
import type { Movement, Tag, Workout } from "@/db/schema"
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
	userWorkouts: (Workout & {
		tags: { id: string; name: string }[]
		movements: { id: string; name: string }[]
		resultsToday: { id: string }[]
	})[]
	movements: Movement[]
	tags: Tag[]
	userId: string
}

export function AddWorkoutToTrackDialog({
	open,
	onCloseAction,
	onAddWorkoutAction,
	teamId,
	trackId,
	existingDays,
	userWorkouts,
	movements,
	tags,
	userId,
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
			<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto border-4 border-primary shadow-[8px_8px_0px_0px] shadow-primary rounded-none">
				<DialogHeader>
					<DialogTitle className="font-mono text-xl tracking-tight">
						Add Workout to Track
					</DialogTitle>
					<DialogDescription className="font-mono">
						{showWorkoutSelection
							? "Select a workout to add to this programming track."
							: `Configure details for "${selectedWorkout?.name}"`}
					</DialogDescription>
				</DialogHeader>

				{showWorkoutSelection ? (
					<WorkoutSelectionList
						teamId={teamId}
						trackId={trackId}
						onWorkoutSelectAction={handleWorkoutSelect}
						userWorkouts={userWorkouts}
						movements={movements}
						tags={tags}
						userId={userId}
					/>
				) : (
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="space-y-4"
						>
							{/* Selected Workout Display */}
							<div className="border-2 border-primary rounded-none p-4 bg-surface">
								<div className="flex justify-between items-start">
									<div>
										<h4 className="font-semibold font-mono">
											{selectedWorkout?.name}
										</h4>
										{selectedWorkout?.description && (
											<p className="text-sm text-muted-foreground mt-1 font-mono">
												{selectedWorkout.description}
											</p>
										)}
									</div>
									<Button
										type="button"
										onClick={handleBackToSelection}
										className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-black text-primary hover:bg-surface rounded-none"
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
										<FormLabel className="font-mono font-semibold">
											Day Number
										</FormLabel>
										<FormControl>
											<Input
												type="number"
												min="1"
												{...field}
												onChange={(e) =>
													field.onChange(Number.parseInt(e.target.value))
												}
												className="border-2 border-primary rounded-none font-mono"
											/>
										</FormControl>
										<FormDescription className="font-mono text-xs">
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
										<FormLabel className="font-mono font-semibold">
											Week Number (Optional)
										</FormLabel>
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
												className="border-2 border-primary rounded-none font-mono"
											/>
										</FormControl>
										<FormDescription className="font-mono text-xs">
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
										<FormLabel className="font-mono font-semibold">
											Notes (Optional)
										</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Add any specific notes for this workout in the track..."
												{...field}
												className="border-2 border-primary rounded-none font-mono"
											/>
										</FormControl>
										<FormDescription className="font-mono text-xs">
											Optional notes or modifications for this workout
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<DialogFooter>
								<Button
									type="button"
									onClick={onCloseAction}
									className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono bg-black text-primary hover:bg-surface rounded-none"
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={isSubmitting}
									className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono rounded-none"
								>
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
