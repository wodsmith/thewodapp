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
import type { WorkoutScheme, ScoreType } from "@/db/schemas/workouts"

interface Workout {
	id: string
	name: string
	description: string | null
	scheme: WorkoutScheme
	scoreType: ScoreType | null
	movements: Array<{ id: string; name: string; type: string }>
}

interface AddEventDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onAddWorkout: (workout: Workout) => void
	isAdding?: boolean
	teamId: string
	existingWorkoutIds: Set<string>
}

export function AddEventDialog({
	open,
	onOpenChange,
	onAddWorkout,
	isAdding,
	teamId: _teamId,
	existingWorkoutIds,
}: AddEventDialogProps) {
	const [search, setSearch] = useState("")
	const [workouts, setWorkouts] = useState<Workout[]>([])
	const [isLoading, setIsLoading] = useState(false)

	// Fetch workouts when dialog opens or search changes
	useEffect(() => {
		if (!open) return

		const fetchWorkouts = async () => {
			setIsLoading(true)
			try {
				const params = new URLSearchParams({
					q: search,
				})
				const response = await fetch(`/api/workouts/search?${params}`)
				if (!response.ok) {
					throw new Error(`Search failed: ${response.status}`)
				}
				const data: { workouts?: Workout[] | null } = await response.json()

				setWorkouts(data.workouts || [])
			} catch (error) {
				console.error("Failed to fetch workouts:", error)
				setWorkouts([])
			} finally {
				setIsLoading(false)
			}
		}

		const timeoutId = setTimeout(fetchWorkouts, 300) // Debounce
		return () => clearTimeout(timeoutId)
	}, [open, search])

	const handleSelect = (workout: Workout) => {
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
