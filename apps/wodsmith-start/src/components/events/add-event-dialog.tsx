"use client"

import { Loader2, Search } from "lucide-react"
import { useEffect, useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ScoreType, WorkoutScheme } from "@/db/schemas/workouts"
import { getWorkoutsFn } from "@/server-fns/workout-fns"

interface WorkoutWithMovements {
	id: string
	name: string
	description: string | null
	scheme: WorkoutScheme
	scoreType: ScoreType | null
	movements?: Array<{ id: string; name: string; type: string }>
}

interface AddEventDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onAddWorkout: (workout: WorkoutWithMovements) => void
	isAdding?: boolean
	teamId: string
	existingWorkoutIds: Set<string>
}

export function AddEventDialog({
	open,
	onOpenChange,
	onAddWorkout,
	isAdding,
	teamId,
	existingWorkoutIds,
}: AddEventDialogProps) {
	const [search, setSearch] = useState("")
	const [workouts, setWorkouts] = useState<WorkoutWithMovements[]>([])
	const [isLoading, setIsLoading] = useState(false)

	// Fetch workouts when dialog opens or search changes
	useEffect(() => {
		if (!open) return

		const fetchWorkouts = async () => {
			setIsLoading(true)
			try {
				const result = await getWorkoutsFn({
					data: {
						teamId,
						search: search.trim() || undefined,
						page: 1,
						pageSize: 50,
					},
				})

				// Transform workouts to match expected interface
				const transformedWorkouts: WorkoutWithMovements[] = result.workouts.map(
					(w) => ({
						id: w.id,
						name: w.name,
						description: w.description,
						scheme: w.scheme,
						scoreType: null, // Not included in getWorkoutsFn response
						movements: [], // Not included in getWorkoutsFn response
					}),
				)

				setWorkouts(transformedWorkouts)
			} catch (error) {
				console.error("Failed to fetch workouts:", error)
				setWorkouts([])
			} finally {
				setIsLoading(false)
			}
		}

		const timeoutId = setTimeout(fetchWorkouts, 300) // Debounce
		return () => clearTimeout(timeoutId)
	}, [open, search, teamId])

	const handleSelect = (workout: WorkoutWithMovements) => {
		if (isAdding) return
		onAddWorkout(workout)
		setSearch("")
	}

	// Filter workouts in render to avoid dependency issues
	const filteredWorkouts = workouts.filter((w) => !existingWorkoutIds.has(w.id))

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
							autoFocus
						/>
					</div>

					{/* Workout List */}
					<ScrollArea className="h-[400px]">
						{isLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : filteredWorkouts.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">
								{search
									? "No workouts match your search."
									: "Start typing to search workouts..."}
							</div>
						) : (
							<div className="space-y-2 pr-4">
								{filteredWorkouts.map((workout) => (
									<button
										key={workout.id}
										type="button"
										onClick={() => handleSelect(workout)}
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
