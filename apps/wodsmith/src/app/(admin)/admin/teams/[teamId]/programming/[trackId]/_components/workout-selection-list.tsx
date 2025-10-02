"use client"

import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Movement, Tag, Workout } from "@/db/schema"
import { addWorkoutToTrackAction } from "../../../_actions/programming-track-actions"
import { CreateWorkoutModal } from "./create-workout-modal"

interface WorkoutSelectionListProps {
	teamId: string
	trackId: string
	onWorkoutSelectAction?: (workout: Workout) => void
	onWorkoutToggleAction?: (workoutId: string) => void
	selectedWorkoutIds?: string[]
	existingWorkoutIds?: string[]
	userWorkouts: (Workout & {
		tags: { id: string; name: string }[]
		movements: { id: string; name: string }[]
		lastScheduledAt?: Date | null
	})[]
	movements: Movement[]
	tags: Tag[]
	_userId: string
	multiSelect?: boolean
}

export function WorkoutSelectionList({
	teamId,
	trackId,
	onWorkoutSelectAction,
	onWorkoutToggleAction,
	selectedWorkoutIds = [],
	existingWorkoutIds = [],
	userWorkouts,
	movements,
	tags,
	_userId,
	multiSelect = false,
}: WorkoutSelectionListProps) {
	const router = useRouter()
	const [searchTerm, setSearchTerm] = useState("")
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
	const [isAvailableWorkoutsOpen, setIsAvailableWorkoutsOpen] = useState(true)
	const [isExistingWorkoutsOpen, setIsExistingWorkoutsOpen] = useState(false)

	// Group workouts into available and existing
	const groupedWorkouts = {
		available: userWorkouts
			.filter((workout) => !existingWorkoutIds.includes(workout.id))
			.sort((a, b) => {
				// Sort by creation date (newest first)
				// Handle null/undefined createdAt values
				const aTime = a.createdAt?.getTime() ?? 0
				const bTime = b.createdAt?.getTime() ?? 0
				return bTime - aTime
			}),
		existing: userWorkouts
			.filter((workout) => existingWorkoutIds.includes(workout.id))
			.sort((a, b) => {
				// Sort by creation date (newest first)
				// Handle null/undefined createdAt values
				const aTime = a.createdAt?.getTime() ?? 0
				const bTime = b.createdAt?.getTime() ?? 0
				return bTime - aTime
			}),
	}

	// Filter workouts based on search term
	const filteredGroupedWorkouts = {
		available: searchTerm
			? groupedWorkouts.available.filter(
					(workout) =>
						workout.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
						workout.description
							?.toLowerCase()
							.includes(searchTerm.toLowerCase()),
				)
			: groupedWorkouts.available,
		existing: searchTerm
			? groupedWorkouts.existing.filter(
					(workout) =>
						workout.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
						workout.description
							?.toLowerCase()
							.includes(searchTerm.toLowerCase()),
				)
			: groupedWorkouts.existing,
	}

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
			router.refresh()
		} catch (error) {
			console.error("Failed to add workout to track:", error)
			toast.error("Workout created but failed to add to track")
		}
	}

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
					className="border-2 hover:border-primary transition-all font-mono rounded-none"
				>
					<Plus className="h-4 w-4 mr-2" />
					Create Workout
				</Button>
			</div>

			{/* Workout List */}
			<div className="max-h-96 overflow-y-auto space-y-3">
				{filteredGroupedWorkouts.available.length === 0 &&
				filteredGroupedWorkouts.existing.length === 0 ? (
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
										className="border-2 hover:border-primary border-transparent transition-all font-mono rounded-none"
									>
										<Plus className="h-4 w-4 mr-2" />
										Create Workout
									</Button>
								)}
							</div>
						</CardContent>
					</Card>
				) : (
					<div className="space-y-3">
						{/* Available Workouts Section */}
						{filteredGroupedWorkouts.available.length > 0 && (
							<Collapsible
								open={isAvailableWorkoutsOpen}
								onOpenChange={setIsAvailableWorkoutsOpen}
							>
								<CollapsibleTrigger asChild>
									<Button
										variant="ghost"
										className="flex items-center justify-between w-full p-0 h-auto font-mono font-semibold text-left hover:bg-transparent"
									>
										<span>
											Available Workouts (
											{filteredGroupedWorkouts.available.length})
										</span>
										{isAvailableWorkoutsOpen ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</Button>
								</CollapsibleTrigger>
								<CollapsibleContent className="space-y-1 mt-2">
									{filteredGroupedWorkouts.available.map((workout, index) => (
										<div
											key={workout.id}
											className={`flex items-center justify-between p-2 border-2 hover:border-primary border-transparent shadow-primary transition-all ${
												index % 2 === 0 ? "bg-white/10" : ""
											} ${
												multiSelect && selectedWorkoutIds.includes(workout.id)
													? "border-primary bg-primary/10"
													: ""
											}`}
										>
											{multiSelect && (
												<Checkbox
													checked={selectedWorkoutIds.includes(workout.id)}
													onCheckedChange={() =>
														onWorkoutToggleAction?.(workout.id)
													}
													className="mr-3"
												/>
											)}
											<div className="flex-1">
												<p className="text-sm font-mono font-semibold truncate">
													{workout.name}
												</p>
												{workout.description && (
													<p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap line-clamp-2 max-w-[75ch]">
														{workout.description}
													</p>
												)}
											</div>
											<p className="text-xs text-muted-foreground font-mono ml-4">
												{workout.lastScheduledAt
													? workout.lastScheduledAt.toLocaleDateString()
													: "Never"}
											</p>
											{!multiSelect && (
												<Button
													onClick={() => onWorkoutSelectAction?.(workout)}
													className="ml-4 border-2 border-transparent hover:shadow-primary transition-all font-mono rounded-none"
												>
													Select
												</Button>
											)}
										</div>
									))}
								</CollapsibleContent>
							</Collapsible>
						)}

						{/* Already in Track Section */}
						{filteredGroupedWorkouts.existing.length > 0 && (
							<Collapsible
								open={isExistingWorkoutsOpen}
								onOpenChange={setIsExistingWorkoutsOpen}
							>
								<CollapsibleTrigger asChild>
									<Button
										variant="ghost"
										className="flex items-center justify-between w-full p-0 h-auto font-mono font-semibold text-left hover:bg-transparent text-muted-foreground"
									>
										<span>
											Already in Track (
											{filteredGroupedWorkouts.existing.length})
										</span>
										{isExistingWorkoutsOpen ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</Button>
								</CollapsibleTrigger>
								<CollapsibleContent className="space-y-1 mt-2">
									{filteredGroupedWorkouts.existing.map((workout, index) => (
										<div
											key={workout.id}
											className={`flex items-center justify-between p-2 border-2 border-muted-foreground/20 opacity-60 transition-all ${
												index % 2 === 0 ? "bg-white/5" : ""
											}`}
										>
											{multiSelect && (
												<Checkbox
													checked={false}
													disabled={true}
													className="mr-3"
												/>
											)}
											<div className="flex-1">
												<p className="text-sm font-mono font-semibold truncate">
													{workout.name}
												</p>
												{workout.description && (
													<p className="text-xs text-muted-foreground font-mono truncate">
														{workout.description}
													</p>
												)}
											</div>
											<p className="text-xs text-muted-foreground font-mono ml-4">
												{workout.lastScheduledAt
													? workout.lastScheduledAt.toLocaleDateString()
													: "Never"}
											</p>
											{!multiSelect && (
												<Button
													disabled={true}
													className="ml-4 border-2 border-transparent font-mono rounded-none opacity-50"
												>
													In Track
												</Button>
											)}
										</div>
									))}
								</CollapsibleContent>
							</Collapsible>
						)}
					</div>
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
