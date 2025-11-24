"use client"

import { CalendarIcon } from "@heroicons/react/24/outline"
import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup } from "@/components/ui/toggle-group"
import type {
	ScheduledWorkoutInstance,
	TrackWorkout,
	Workout,
} from "@/db/schema"
import { getLocalDateKey } from "@/utils/date-utils"
import { EmptyWorkouts } from "./empty-workouts"
import { WorkoutDateGroup } from "./workout-date-group"

type ViewMode = "daily" | "weekly"
type ScheduledWorkoutInstanceWithDetails = ScheduledWorkoutInstance & {
	trackWorkout?: (TrackWorkout & { workout?: Workout }) | null
	workout?: Workout // Direct workout for standalone scheduled instances
	result?: {
		id: string
		wodScore?: string
		scale?: string
		notes?: string
	} | null
}

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
	error?: string | null
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
	error,
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
			// Get workout from either track workout or standalone workout
			const workout =
				scheduledWorkout.trackWorkout?.workout || scheduledWorkout.workout

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
				instance: ScheduledWorkoutInstance
				workout: Workout
				trackWorkout?: TrackWorkout | null
			}>
		>,
	)

	return (
		<div className="card p-6">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-end mb-4 gap-2">
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

			<div>
				<div className="min-h-[200px]">
					{isLoading ? (
						viewMode === "daily" ? (
							// Daily view skeleton - matches actual workout cards
							<div className="space-y-6">
								<div className="space-y-4">
									{/* Date header */}
									<div className="flex items-center gap-2">
										<Skeleton className="h-5 w-5 rounded" />
										<Skeleton className="h-7 w-64" />
									</div>

									{/* Workout cards */}
									<div className="ml-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
										{["skeleton-card-1", "skeleton-card-2"].map(
											(skeletonId) => (
												<div
													key={skeletonId}
													className="border-2 border-black dark:border-dark-border p-6 bg-background/10 dark:bg-white/10 flex flex-col"
												>
													<div className="flex flex-col h-full">
														<div className="flex-1">
															{/* Title */}
															<Skeleton className="h-9 w-3/4 mb-3" />

															{/* Clock icon + time */}
															<div className="flex items-center gap-2 mb-4">
																<Skeleton className="h-4 w-4 rounded" />
																<Skeleton className="h-4 w-20" />
															</div>

															{/* Scheme badge */}
															<div className="mb-4">
																<div className="inline-block">
																	<Skeleton className="h-10 w-32" />
																</div>
															</div>

															{/* Description */}
															<div className="mb-3 space-y-1">
																<Skeleton className="h-4 w-full" />
																<Skeleton className="h-4 w-5/6" />
																<Skeleton className="h-4 w-2/3" />
															</div>

															{/* Movements */}
															<div className="mb-4">
																<Skeleton className="h-4 w-24 mb-3" />
																<div className="flex flex-wrap gap-2">
																	<Skeleton className="h-7 w-24" />
																	<Skeleton className="h-7 w-32" />
																	<Skeleton className="h-7 w-28" />
																	<Skeleton className="h-7 w-20" />
																</div>
															</div>
														</div>

														{/* Log Result button */}
														<div className="mt-6 pt-4 border-t border-black/10 dark:border-white/10">
															<Skeleton className="h-10 w-full" />
														</div>
													</div>
												</div>
											),
										)}
									</div>
								</div>
							</div>
						) : (
							// Weekly view skeleton - compact list
							<div className="space-y-6">
								{["day-1", "day-2", "day-3"].map((dayId) => (
									<div key={dayId} className="space-y-4">
										{/* Date header */}
										<div className="flex items-center gap-2">
											<Skeleton className="h-4 w-4 rounded" />
											<Skeleton className="h-6 w-56" />
										</div>

										{/* Workout items */}
										<div className="flex flex-col gap-4">
											{["workout-1", "workout-2"].map((workoutId) => (
												<div
													key={`${dayId}-${workoutId}`}
													className="border-l-4 border-primary pl-4 ml-2"
												>
													<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
														<div className="flex-1">
															<Skeleton className="h-5 w-48 mb-2" />
															<div className="space-y-1 mb-3">
																<Skeleton className="h-3 w-full max-w-md" />
																<Skeleton className="h-3 w-3/4 max-w-sm" />
															</div>
														</div>
														<div className="flex items-center gap-2">
															<Skeleton className="h-9 w-20" />
														</div>
													</div>
												</div>
											))}
										</div>
									</div>
								))}
							</div>
						)
					) : error ? (
						<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
							<CalendarIcon className="h-12 w-12 text-destructive/50 mb-4" />
							<h4 className="text-base font-medium text-foreground mb-2">
								{error}
							</h4>
							<Button size="sm" variant="secondary" onClick={handleRefresh}>
								Retry
							</Button>
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
		</div>
	)
}
