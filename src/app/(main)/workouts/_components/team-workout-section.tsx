"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup } from "@/components/ui/toggle-group"
import { WorkoutDateGroup } from "./workout-date-group"
import { EmptyWorkouts } from "./empty-workouts"
import { getLocalDateKey } from "@/utils/date-utils"
import type { TrackWorkout, Workout } from "@/db/schema"

type ViewMode = "daily" | "weekly"
type ScheduledWorkoutInstanceWithDetails = any

interface Team {
	id: string
	name: string
	isPersonalTeam?: number | boolean
}

interface TeamWorkoutSectionProps {
	team: Team
	viewMode: ViewMode
	teamWorkouts: ScheduledWorkoutInstanceWithDetails[]
	isLoading: boolean
	onViewModeChange: (teamId: string, mode: ViewMode) => void
	onRefresh: (
		teamId: string,
		mode: ViewMode,
		forceRefresh?: boolean,
	) => Promise<void>
}

export function TeamWorkoutSection({
	team,
	viewMode,
	teamWorkouts,
	isLoading,
	onViewModeChange,
	onRefresh,
}: TeamWorkoutSectionProps) {
	const handleRefresh = useCallback(() => {
		onRefresh(team.id, viewMode, true)
	}, [team.id, viewMode, onRefresh])

	const handleViewChange = useCallback(
		(mode: string) => {
			onViewModeChange(team.id, mode as ViewMode)
		},
		[team.id, onViewModeChange],
	)

	// Group workouts by date
	const workoutsByDate = teamWorkouts.reduce(
		(acc, scheduledWorkout) => {
			const instance = scheduledWorkout
			const workout = scheduledWorkout.trackWorkout?.workout

			if (!instance || !workout) {
				console.log(
					"[TeamWorkoutSection] Skipping workout - missing instance or workout data",
					{ scheduledWorkout, workout },
				)
				return acc
			}

			// Use local timezone for date grouping
			const dateKey = getLocalDateKey(instance.scheduledDate)
			if (!acc[dateKey]) {
				acc[dateKey] = []
			}
			acc[dateKey].push({
				instance,
				workout,
				trackWorkout: scheduledWorkout.trackWorkout,
			})
			return acc
		},
		{} as Record<
			string,
			Array<{
				instance: any
				workout: Workout
				trackWorkout?: TrackWorkout | null
			}>
		>,
	)

	return (
		<div className="card p-6">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
				<h3 className="font-semibold text-lg mb-2 sm:mb-0">{team.name}</h3>

				<div className="flex items-center gap-2">
					<ToggleGroup
						value={viewMode}
						onValueChange={handleViewChange}
						options={[
							{ value: "daily", label: "Today" },
							{ value: "weekly", label: "This Week" },
						]}
					/>
					<Button
						size="sm"
						variant="ghost"
						onClick={handleRefresh}
						className="h-8 w-8 p-0"
						title="Refresh"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.5}
							stroke="currentColor"
							className="h-4 w-4"
							role="img"
							aria-label="Refresh workouts"
						>
							<title>Refresh workouts</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
							/>
						</svg>
					</Button>
				</div>
			</div>

			<div className="min-h-[200px]">
				{isLoading ? (
					<div className="space-y-3 py-12">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-3/4" />
					</div>
				) : teamWorkouts.length > 0 ? (
					<div className="space-y-6">
						{Object.entries(workoutsByDate)
							.sort(([a], [b]) => a.localeCompare(b))
							.map(([dateKey, workouts]) => (
								<WorkoutDateGroup
									key={dateKey}
									dateKey={dateKey}
									workouts={workouts}
									viewMode={viewMode}
								/>
							))}
					</div>
				) : (
					<EmptyWorkouts viewMode={viewMode} />
				)}
			</div>
		</div>
	)
}
