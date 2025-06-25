"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Movement, Tag, Workout } from "@/db/schema"
import { Plus, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import { addWorkoutToTrackAction } from "../../../_actions/programming-track-actions"
import { CreateWorkoutModal } from "./create-workout-modal"

interface WorkoutSelectionListProps {
	teamId: string
	trackId: string
	onWorkoutSelectAction: (workout: Workout) => void
	userWorkouts: (Workout & {
		tags: { id: string; name: string }[]
		movements: { id: string; name: string }[]
		lastScheduledAt?: Date | null
	})[]
	movements: Movement[]
	tags: Tag[]
	userId: string
}

export function WorkoutSelectionList({
	teamId,
	trackId,
	onWorkoutSelectAction,
	userWorkouts,
	movements,
	tags,
	userId,
}: WorkoutSelectionListProps) {
	const [filteredWorkouts, setFilteredWorkouts] = useState(
		userWorkouts.sort((a, b) => {
			// Sort by last scheduled date - workouts scheduled more recently come first
			// Unscheduled workouts come last
			if (a.lastScheduledAt && !b.lastScheduledAt) return -1
			if (!a.lastScheduledAt && b.lastScheduledAt) return 1
			if (a.lastScheduledAt && b.lastScheduledAt) {
				return b.lastScheduledAt.getTime() - a.lastScheduledAt.getTime()
			}
			return 0
		}),
	)
	const [searchTerm, setSearchTerm] = useState("")
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

	// Server action to add workout to track
	const { execute: addWorkoutToTrack, isPending: isAddingToTrack } =
		useServerAction(addWorkoutToTrackAction)

	// Handle successful workout creation and addition to track
	const handleWorkoutCreated = async (workout: Workout) => {
		try {
			// Add the workout to the current track
			const [result, error] = await addWorkoutToTrack({
				teamId,
				trackId,
				workoutId: workout.id,
				dayNumber: 1, // Add to day 1 by default
				notes: "Created via workout creation modal",
			})

			if (error || !result) {
				toast.error("Workout created but failed to add to track")
				return
			}

			toast.success("Workout created and added to track successfully!")

			// Close the modal
			setIsCreateModalOpen(false)

			// Refresh the page to show the updated workout list
			window.location.reload()
		} catch (error) {
			console.error("Failed to add workout to track:", error)
			toast.error("Workout created but failed to add to track")
		}
	}

	// Filter workouts based on search term
	useEffect(() => {
		if (!searchTerm) {
			setFilteredWorkouts(userWorkouts)
		} else {
			const filtered = userWorkouts.filter(
				(workout) =>
					workout.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					workout.description?.toLowerCase().includes(searchTerm.toLowerCase()),
			)
			setFilteredWorkouts(filtered)
		}
	}, [searchTerm, userWorkouts])

	return (
		<div className="space-y-4">
			{/* Search */}
			<div className="space-y-2">
				<Label htmlFor="workout-search" className="font-mono font-semibold">
					Search Workouts
				</Label>
				<div className="relative">
					<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						id="workout-search"
						placeholder="Search by name, description, or tags..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-8 border-2 border-primary rounded-none font-mono"
					/>
				</div>
			</div>

			{/* Create Workout Button */}
			<div className="flex justify-end">
				<Button
					onClick={() => setIsCreateModalOpen(true)}
					disabled={isAddingToTrack}
					className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono rounded-none"
				>
					<Plus className="h-4 w-4 mr-2" />
					Create Workout
				</Button>
			</div>

			{/* Workout List */}
			<div className="max-h-96 overflow-y-auto space-y-2">
				{filteredWorkouts.length === 0 ? (
					<Card className="border-2 border-primary rounded-none">
						<CardContent className="pt-6">
							<div className="text-center space-y-4">
								<p className="text-muted-foreground font-mono">
									{searchTerm
										? "No workouts found matching your search."
										: "No workouts available."}
								</p>
								{!searchTerm && userWorkouts.length === 0 && (
									<Button
										onClick={() => setIsCreateModalOpen(true)}
										disabled={isAddingToTrack}
										className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono rounded-none"
									>
										<Plus className="h-4 w-4 mr-2" />
										Create Workout
									</Button>
								)}
							</div>
						</CardContent>
					</Card>
				) : (
					filteredWorkouts.map((workout) => (
						<Card
							key={workout.id}
							className="cursor-pointer hover:bg-muted/50 border-2 border-primary rounded-none shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all"
						>
							<CardHeader className="pb-2">
								<div className="flex justify-between items-start">
									<div className="flex-1">
										<CardTitle className="text-base font-mono tracking-tight">
											{workout.name}
										</CardTitle>
										{workout.description && (
											<p className="text-sm text-muted-foreground mt-1 font-mono">
												{workout.description}
											</p>
										)}
										<div className="flex gap-4 text-xs text-muted-foreground mt-2 font-mono">
											<span>Scheme: {workout.scheme}</span>
											<span>Scope: {workout.scope}</span>
										</div>
									</div>
									<Button
										onClick={() => onWorkoutSelectAction(workout)}
										className="border-2 border-primary shadow-[4px_4px_0px_0px] shadow-primary hover:shadow-[2px_2px_0px_0px] transition-all font-mono rounded-none"
									>
										Select
									</Button>
								</div>
							</CardHeader>
							{workout.lastScheduledAt && (
								<div className="px-4 py-2 border-t border-muted">
									<p className="text-sm text-muted-foreground font-mono">
										Last scheduled:{" "}
										{workout.lastScheduledAt.toLocaleDateString()}
									</p>
								</div>
							)}
						</Card>
					))
				)}
			</div>

			{/* Create Workout Modal */}
			<CreateWorkoutModal
				open={isCreateModalOpen}
				onCloseAction={() => setIsCreateModalOpen(false)}
				onWorkoutCreatedAction={handleWorkoutCreated}
				teamId={teamId}
				trackId={trackId}
				movements={movements}
				tags={tags}
			/>
		</div>
	)
}
