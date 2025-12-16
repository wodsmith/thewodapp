"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useServerAction } from "@repo/zsa-react"
import {
	getScheduledTeamWorkoutsWithResultsAction,
	getTeamLeaderboardsAction,
} from "@/actions/workout-actions"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Score } from "@/db/schema"
import { SYSTEM_ROLES_ENUM } from "@/db/schemas/teams"
import type { LeaderboardEntry } from "@/server/leaderboard"
import type { ScheduledWorkoutInstanceWithDetails } from "@/server/scheduling-service"
import {
	endOfLocalDay,
	endOfLocalWeek,
	getLocalDateKey,
	startOfLocalDay,
	startOfLocalWeek,
} from "@/utils/date-utils"
import { TeamControls } from "./team-controls"
import { WorkoutWithLeaderboard } from "./workout-with-leaderboard"

type ViewMode = "daily" | "weekly"

interface Team {
	id: string
	name: string
	slug: string
	isPersonalTeam: boolean
	role: {
		id: string
		name: string
		isSystemRole: boolean
	}
	permissions: string[]
}

interface TeamPageClientProps {
	team: Team
	userId: string
}

export function TeamPageClient({ team, userId }: TeamPageClientProps) {
	const [viewMode, setViewMode] = useState<ViewMode>("daily")
	const [selectedDate, setSelectedDate] = useState(new Date())
	const [workoutsWithResults, setWorkoutsWithResults] = useState<
		Array<ScheduledWorkoutInstanceWithDetails & { result?: Score | null }>
	>([])
	const [leaderboards, setLeaderboards] = useState<
		Record<string, LeaderboardEntry[]>
	>({})
	const [isLoading, setIsLoading] = useState(true)

	const { execute: fetchWorkouts } = useServerAction(
		getScheduledTeamWorkoutsWithResultsAction,
	)
	const { execute: fetchLeaderboards } = useServerAction(
		getTeamLeaderboardsAction,
	)

	useEffect(() => {
		const fetchData = async () => {
			setIsLoading(true)

			// Calculate date range based on view mode
			let startDate: Date
			let endDate: Date

			if (viewMode === "daily") {
				startDate = startOfLocalDay(selectedDate)
				endDate = endOfLocalDay(selectedDate)
			} else {
				startDate = startOfLocalWeek(selectedDate)
				endDate = endOfLocalWeek(selectedDate)
			}

			try {
				// Fetch workouts with results
				const [workoutsResult, workoutsError] = await fetchWorkouts({
					teamId: team.id,
					startDate: startDate.toISOString(),
					endDate: endDate.toISOString(),
					userId,
				})

				if (workoutsResult?.success && !workoutsError) {
					setWorkoutsWithResults(workoutsResult.data || [])

					// Fetch leaderboards for each workout
					const instanceIds = workoutsResult.data.map(
						(w: ScheduledWorkoutInstanceWithDetails) => w.id,
					)
					if (instanceIds.length > 0) {
						const [leaderboardsResult, leaderboardsError] =
							await fetchLeaderboards({
								scheduledWorkoutInstanceIds: instanceIds,
								teamId: team.id,
							})

						if (leaderboardsResult?.success && !leaderboardsError) {
							setLeaderboards(leaderboardsResult.data || {})
						}
					}
				}
			} catch (error) {
				console.error("Failed to fetch team data:", error)
			} finally {
				setIsLoading(false)
			}
		}

		fetchData()
	}, [
		viewMode,
		selectedDate,
		team.id,
		userId,
		fetchWorkouts,
		fetchLeaderboards,
	])

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
		{} as Record<
			string,
			Array<ScheduledWorkoutInstanceWithDetails & { result?: Score | null }>
		>,
	)

	const sortedDates = Object.keys(workoutsByDate).sort()

	const canManageTeam =
		team.role.isSystemRole &&
		(team.role.id === SYSTEM_ROLES_ENUM.OWNER ||
			team.role.id === SYSTEM_ROLES_ENUM.ADMIN)

	return (
		<div className="container mx-auto py-8 space-y-8">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold mb-2">{team.name}</h1>
					<p className="text-muted-foreground">Team Dashboard</p>
				</div>
				<div className="flex items-center gap-3">
					{canManageTeam && (
						<Button asChild variant="outline">
							<Link href="/admin/teams">Manage Team</Link>
						</Button>
					)}
				</div>
			</div>

			<TeamControls
				viewMode={viewMode}
				selectedDate={selectedDate}
				onViewModeChange={setViewMode}
				onDateChange={setSelectedDate}
			/>

			{isLoading ? (
				<div className="space-y-6">
					<Skeleton className="h-48 w-full" />
					<Skeleton className="h-48 w-full" />
				</div>
			) : workoutsWithResults.length > 0 ? (
				<>
					{/* Workouts Section */}
					<section>
						<h2 className="text-2xl font-bold mb-6 pb-3 border-b-2 border-primary/20">
							{viewMode === "daily" ? "Today's" : "This Week's"} Workouts
						</h2>
						{viewMode === "daily" ? (
							<div className="space-y-6">
								{workoutsWithResults.map((workout) => {
									const workoutData =
										workout.trackWorkout?.workout || workout.workout
									if (!workoutData) return null

									return (
										<div key={workout.id} className="space-y-4">
											<div className="border-2 border-black dark:border-dark-border p-6 bg-background/10 dark:bg-white/10 flex flex-col items-start rounded">
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
																		Score: {workout.result.scoreValue}
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
													const workoutData =
														workout.trackWorkout?.workout || workout.workout
													if (!workoutData) return null

													return (
														<div
															key={workout.id}
															className="border-2 border-black dark:border-dark-border p-6 bg-background/10 dark:bg-white/10 flex flex-col items-start rounded"
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
																					Score: {workout.result.scoreValue}
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

					{/* Leaderboards Section - only show for daily view */}
					{viewMode === "daily" && (
						<section>
							<h2 className="text-2xl font-bold mb-6 pb-3 border-b-2 border-primary/20">
								Leaderboards
							</h2>
							<div className="space-y-8">
								{workoutsWithResults.map((workout) => {
									const workoutData =
										workout.trackWorkout?.workout || workout.workout
									const leaderboard = leaderboards[workout.id] || []

									if (!workoutData || leaderboard.length === 0) return null

									return (
										<div key={`leaderboard-${workout.id}`}>
											<h3 className="text-lg font-semibold mb-3">
												{workoutData.name}
											</h3>
											<WorkoutWithLeaderboard leaderboard={leaderboard} />
										</div>
									)
								})}
							</div>
						</section>
					)}
				</>
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
