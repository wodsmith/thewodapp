"use client"

import { Search } from "lucide-react"
import { useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AddEventDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	availableWorkouts: Array<{
		id: string
		name: string
		description: string | null
		scheme: string
		scoreType: string | null
		tags: Array<{ id: string; name: string }>
		movements: Array<{ id: string; name: string; type: string }>
	}>
	onAddWorkout: (workoutId: string) => void
	isAdding?: boolean
}

export function AddEventDialog({
	open,
	onOpenChange,
	availableWorkouts,
	onAddWorkout,
	isAdding,
}: AddEventDialogProps) {
	const [search, setSearch] = useState("")

	const filteredWorkouts = availableWorkouts.filter((workout) => {
		const searchLower = search.toLowerCase()
		return (
			workout.name.toLowerCase().includes(searchLower) ||
			workout.description?.toLowerCase().includes(searchLower) ||
			workout.tags.some((t) => t.name.toLowerCase().includes(searchLower)) ||
			workout.movements.some((m) => m.name.toLowerCase().includes(searchLower))
		)
	})

	const handleSelect = (workoutId: string) => {
		if (isAdding) return
		onAddWorkout(workoutId)
		setSearch("")
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Add Event to Competition</DialogTitle>
					<DialogDescription>
						Select a workout to add as a competition event.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Search Input */}
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search workouts..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9"
						/>
					</div>

					{/* Workout List */}
					<ScrollArea className="h-[400px]">
						{filteredWorkouts.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">
								{availableWorkouts.length === 0
									? "No workouts available. Create workouts first."
									: "No workouts match your search."}
							</div>
						) : (
							<div className="space-y-2 pr-4">
								{filteredWorkouts.map((workout) => (
									<button
										key={workout.id}
										type="button"
										onClick={() => handleSelect(workout.id)}
										disabled={isAdding}
										className="w-full text-left p-4 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<div className="font-medium">{workout.name}</div>
										{workout.description && (
											<p className="text-sm text-muted-foreground line-clamp-2 mt-1">
												{workout.description}
											</p>
										)}
										<div className="flex items-center gap-2 mt-2">
											<span className="text-xs bg-muted px-2 py-0.5 rounded">
												{workout.scheme}
											</span>
											{workout.tags.slice(0, 3).map((tag) => (
												<span
													key={tag.id}
													className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
												>
													{tag.name}
												</span>
											))}
										</div>
									</button>
								))}
							</div>
						)}
					</ScrollArea>
				</div>
			</DialogContent>
		</Dialog>
	)
}
