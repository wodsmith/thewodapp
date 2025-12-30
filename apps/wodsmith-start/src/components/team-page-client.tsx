import { useCallback, useEffect, useState } from "react"
import {
	getScheduledWorkoutsWithResultsFn,
	type ScheduledWorkoutWithResult,
} from "@/server-fns/workout-fns"
import {
	endOfLocalDay,
	endOfLocalWeek,
	getLocalDateKey,
	startOfLocalDay,
	startOfLocalWeek,
} from "@/utils/date-utils"
import { TeamControls } from "./team-controls"

type ViewMode = "daily" | "weekly"

interface Team {
	id: string
	name: string
}

interface TeamPageClientProps {
	team: Team
	userId: string
}

export function TeamPageClient({ team, userId }: TeamPageClientProps) {
	const [viewMode, setViewMode] = useState<ViewMode>("daily")
	const [workoutsWithResults, setWorkoutsWithResults] = useState<
		ScheduledWorkoutWithResult[]
	>([])
	const [isLoading, setIsLoading] = useState(true)

	const fetchWorkouts = useCallback(async () => {
		setIsLoading(true)

		// Calculate date range based on view mode
		const today = new Date()
		let startDate: Date
		let endDate: Date

		if (viewMode === "daily") {
			startDate = startOfLocalDay(today)
			endDate = endOfLocalDay(today)
		} else {
			startDate = startOfLocalWeek(today)
			endDate = endOfLocalWeek(today)
		}

		try {
			const result = await getScheduledWorkoutsWithResultsFn({
				data: {
					teamId: team.id,
					startDate: startDate.toISOString(),
					endDate: endDate.toISOString(),
					userId,
				},
			})

			setWorkoutsWithResults(result.scheduledWorkoutsWithResults || [])
		} catch (error) {
			console.error("Failed to fetch team workouts:", error)
		} finally {
			setIsLoading(false)
		}
	}, [viewMode, team.id, userId])

	// Fetch workouts on mount and when view mode changes
	useEffect(() => {
		fetchWorkouts()
	}, [fetchWorkouts])

	// Group workouts by date for weekly view
	const workoutsByDate = workoutsWithResults.reduce(
		(acc, workout) => {
			const dateKey = getLocalDateKey(workout.scheduledDate)
			if (!acc[dateKey]) {
				acc[dateKey] = []
			}
			acc[dateKey].push(workout)
			return acc
		},
		{} as Record<string, ScheduledWorkoutWithResult[]>,
	)

	const sortedDates = Object.keys(workoutsByDate).sort()

	return (
		<div className="container mx-auto py-8 space-y-8">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold mb-2">{team.name}</h1>
					<p className="text-muted-foreground">Team Dashboard</p>
				</div>
				<div className="flex items-center gap-3">
					<a
						href="/settings/programming"
						className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
					>
						Manage Team
					</a>
				</div>
			</div>

			<TeamControls
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				onRefresh={fetchWorkouts}
			/>

			{isLoading ? (
				<div className="space-y-6">
					<div className="h-48 w-full bg-muted rounded animate-pulse" />
					<div className="h-48 w-full bg-muted rounded animate-pulse" />
				</div>
			) : workoutsWithResults.length > 0 ? (
				<section>
					<h2 className="text-2xl font-bold mb-6 pb-3 border-b-2 border-primary/20">
						{viewMode === "daily" ? "Today's" : "This Week's"} Workouts
					</h2>
					{viewMode === "daily" ? (
						<div className="space-y-6">
							{workoutsWithResults.map((workout) => {
								const workoutData = workout.workout
								if (!workoutData) return null

								return (
									<div key={workout.id} className="space-y-4">
										<div className="border-2 border-black dark:border-white p-6 bg-background/10 dark:bg-white/10 flex flex-col items-start rounded">
											<div className="flex flex-col w-full h-full items-start">
												<div className="flex-1 text-left w-full">
													<h3 className="font-bold text-2xl mb-3 leading-tight">
														{workoutData.name}
													</h3>

													{workoutData.scheme && (
														<div className="mb-4 flex justify-start rounded">
															<div className="inline-block bg-black dark:bg-primary text-primary-foreground px-3 py-2">
																<p className="font-bold text-sm uppercase tracking-wide">
																	{workoutData.scheme}
																</p>
															</div>
														</div>
													)}

													{workoutData.description && (
														<p className="text-muted-foreground mb-3 text-left text-base whitespace-pre-wrap">
															{workoutData.description}
														</p>
													)}

													{workout.result && (
														<div className="mt-4 pt-4 border-t border-muted">
															<p className="text-sm font-semibold mb-2 text-green-600 dark:text-green-400">
																✓ Completed
															</p>
															{workout.result.scoreValue !== null && (
																<p className="text-lg font-bold">
																	Score: {workout.result.displayScore}
																</p>
															)}
														</div>
													)}
												</div>
											</div>
										</div>
									</div>
								)
							})}
						</div>
					) : (
						<div className="space-y-8">
							{sortedDates.map((dateKey) => {
								const dayWorkouts = workoutsByDate[dateKey]
								const date = new Date(dateKey)

								return (
									<div key={dateKey}>
										<h3 className="text-lg font-semibold mb-4">
											{date.toLocaleDateString("en-US", {
												weekday: "long",
												month: "long",
												day: "numeric",
											})}
										</h3>
										<div className="space-y-4">
											{dayWorkouts?.map((workout) => {
												const workoutData = workout.workout
												if (!workoutData) return null

												return (
													<div
														key={workout.id}
														className="border-2 border-black dark:border-white p-6 bg-background/10 dark:bg-white/10 flex flex-col items-start rounded"
													>
														<div className="flex flex-col w-full h-full items-start">
															<div className="flex-1 text-left w-full">
																<h4 className="font-bold text-xl mb-2 leading-tight">
																	{workoutData.name}
																</h4>

																{workoutData.scheme && (
																	<div className="mb-3 flex justify-start rounded">
																		<div className="inline-block bg-black dark:bg-primary text-primary-foreground px-2 py-1">
																			<p className="font-bold text-xs uppercase tracking-wide">
																				{workoutData.scheme}
																			</p>
																		</div>
																	</div>
																)}

																{workout.result && (
																	<div className="mt-3 pt-3 border-t border-muted">
																		<p className="text-sm font-semibold mb-1 text-green-600 dark:text-green-400">
																			✓ Completed
																		</p>
																		{workout.result.scoreValue !== null && (
																			<p className="text-base font-bold">
																				Score: {workout.result.displayScore}
																			</p>
																		)}
																	</div>
																)}
															</div>
														</div>
													</div>
												)
											})}
										</div>
									</div>
								)
							})}
						</div>
					)}
				</section>
			) : (
				<section>
					<h2 className="text-2xl font-bold mb-6 pb-3 border-b-2 border-primary/20">
						{viewMode === "daily" ? "Today's" : "This Week's"} Workouts
					</h2>
					<p className="text-muted-foreground">
						No workouts scheduled for this{" "}
						{viewMode === "daily" ? "day" : "week"}.
					</p>
				</section>
			)}
		</div>
	)
}
