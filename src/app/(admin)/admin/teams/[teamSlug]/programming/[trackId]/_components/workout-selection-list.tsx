"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Workout } from "@/db/schema"
import { Search } from "lucide-react"
import { useEffect, useState } from "react"

interface WorkoutSelectionListProps {
	teamId: string
	onWorkoutSelectAction: (workout: Workout) => void
}

export function WorkoutSelectionList({
	teamId,
	onWorkoutSelectAction,
}: WorkoutSelectionListProps) {
	const [workouts, setWorkouts] = useState<Workout[]>([])
	const [filteredWorkouts, setFilteredWorkouts] = useState<Workout[]>([])
	const [searchTerm, setSearchTerm] = useState("")
	const [isLoading, setIsLoading] = useState(true)

	// TODO: Replace with actual API call to get available workouts
	useEffect(() => {
		const loadWorkouts = async () => {
			setIsLoading(true)
			try {
				// Mock data for now - should be replaced with actual API call
				const mockWorkouts: Workout[] = [
					{
						id: "wkt_001",
						name: "Fran",
						description: "21-15-9 Thrusters (95/65) + Pull-ups",
						scope: "public",
						scheme: "time",
						repsPerRound: null,
						roundsToScore: 1,
						userId: "user_001",
						sugarId: null,
						tiebreakScheme: null,
						secondaryScheme: null,
						sourceTrackId: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						updateCounter: 1,
					},
					{
						id: "wkt_002",
						name: "Helen",
						description:
							"3 rounds: 400m Run + 21 KB Swings (53/35) + 12 Pull-ups",
						scope: "public",
						scheme: "time",
						repsPerRound: null,
						roundsToScore: 1,
						userId: "user_001",
						sugarId: null,
						tiebreakScheme: null,
						secondaryScheme: null,
						sourceTrackId: null,
						createdAt: new Date(),
						updatedAt: new Date(),
						updateCounter: 1,
					},
				]
				setWorkouts(mockWorkouts)
				setFilteredWorkouts(mockWorkouts)
			} catch (error) {
				console.error("Failed to load workouts:", error)
			} finally {
				setIsLoading(false)
			}
		}

		loadWorkouts()
	}, [])

	// Filter workouts based on search term
	useEffect(() => {
		if (!searchTerm) {
			setFilteredWorkouts(workouts)
		} else {
			const filtered = workouts.filter(
				(workout) =>
					workout.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					workout.description?.toLowerCase().includes(searchTerm.toLowerCase()),
			)
			setFilteredWorkouts(filtered)
		}
	}, [searchTerm, workouts])

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="animate-pulse space-y-4">
					{Array.from({ length: 3 }, (_, i) => (
						<Card
							key={`loading-${i + 1}`}
							className="border-2 border-primary rounded-none"
						>
							<CardContent className="pt-6">
								<div className="h-4 bg-muted rounded w-1/3 mb-2" />
								<div className="h-3 bg-muted rounded w-2/3" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		)
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

			{/* Workout List */}
			<div className="max-h-96 overflow-y-auto space-y-2">
				{filteredWorkouts.length === 0 ? (
					<Card className="border-2 border-primary rounded-none">
						<CardContent className="pt-6">
							<p className="text-center text-muted-foreground font-mono">
								{searchTerm
									? "No workouts found matching your search."
									: "No workouts available."}
							</p>
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
						</Card>
					))
				)}
			</div>
		</div>
	)
}
