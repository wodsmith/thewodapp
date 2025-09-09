"use client"

import { use, useState, useCallback, Suspense, useTransition } from "react"
import { useServerAction } from "zsa-react"
import { Skeleton } from "@/components/ui/skeleton"
import { TeamWorkoutSection } from "./team-workout-section"
import { getScheduledTeamWorkoutsWithResultsAction } from "@/actions/workout-actions"
import { useSessionStore } from "@/state/session"
import {
	startOfLocalDay,
	endOfLocalDay,
	startOfLocalWeek,
	endOfLocalWeek,
} from "@/utils/date-utils"
import type { TeamWorkoutsData } from "./team-workouts-server"

type ViewMode = "daily" | "weekly"

interface Team {
	id: string
	name: string
	isPersonalTeam?: number | boolean
}

interface TeamWorkoutSuspenseProps {
	team: Team
	workoutsPromise: Promise<unknown[]>
	viewMode: ViewMode
	onViewModeChange: (teamId: string, mode: ViewMode) => void
	onRefresh: (teamId: string, mode: ViewMode) => Promise<void>
}

function TeamWorkoutSuspense({
	team,
	workoutsPromise,
	viewMode,
	onViewModeChange,
	onRefresh,
}: TeamWorkoutSuspenseProps) {
	const workouts = use(workoutsPromise)

	return (
		<TeamWorkoutSection
			team={team}
			viewMode={viewMode}
			teamWorkouts={workouts}
			isLoading={false}
			onViewModeChange={onViewModeChange}
			onRefresh={onRefresh}
		/>
	)
}

interface TeamWorkoutsClientProps {
	teams: Team[]
	initialWorkoutsData: TeamWorkoutsData[]
}

export function TeamWorkoutsClient({
	teams,
	initialWorkoutsData,
}: TeamWorkoutsClientProps) {
	const [teamViewModes, setTeamViewModes] = useState<Record<string, ViewMode>>(
		() => {
			const initial: Record<string, ViewMode> = {}
			for (const team of teams) {
				initial[team.id] = "daily"
			}
			return initial
		},
	)

	const [workoutsData, setWorkoutsData] = useState<
		Record<string, Promise<unknown[]>>
	>(() => {
		const initial: Record<string, Promise<unknown[]>> = {}
		for (const data of initialWorkoutsData) {
			initial[data.teamId] = data.workoutsPromise
		}
		return initial
	})

	const session = useSessionStore((state) => state.session)
	const userId = session?.id
	const { execute: fetchWorkouts } = useServerAction(
		getScheduledTeamWorkoutsWithResultsAction,
	)
	const [, startTransition] = useTransition()

	const getDateRange = useCallback((mode: ViewMode) => {
		if (mode === "daily") {
			return { start: startOfLocalDay(), end: endOfLocalDay() }
		} else {
			return { start: startOfLocalWeek(), end: endOfLocalWeek() }
		}
	}, [])

	const fetchTeamWorkouts = useCallback(
		async (teamId: string, mode: ViewMode) => {
			if (!userId) return []

			const { start, end } = getDateRange(mode)
			const result = await fetchWorkouts({
				teamId,
				startDate: start.toISOString(),
				endDate: end.toISOString(),
				userId,
			})

			const [serverResult, serverError] = result
			if (serverResult?.success && !serverError) {
				return serverResult.data
			}
			return []
		},
		[userId, fetchWorkouts, getDateRange],
	)

	const handleViewModeChange = useCallback(
		(teamId: string, mode: ViewMode) => {
			startTransition(() => {
				setTeamViewModes((prev) => ({
					...prev,
					[teamId]: mode,
				}))

				// Create a new promise for the data fetch
				const newDataPromise = fetchTeamWorkouts(teamId, mode)
				setWorkoutsData((prev) => ({
					...prev,
					[teamId]: newDataPromise,
				}))
			})
		},
		[fetchTeamWorkouts],
	)

	const handleRefresh = useCallback(
		async (teamId: string, mode: ViewMode) => {
			startTransition(() => {
				const newDataPromise = fetchTeamWorkouts(teamId, mode)
				setWorkoutsData((prev) => ({
					...prev,
					[teamId]: newDataPromise,
				}))
			})
		},
		[fetchTeamWorkouts],
	)

	return (
		<div>
			<h2 className="text-2xl font-bold mb-6 pb-3 border-b-2 border-primary/20 text-center sm:text-left">
				Scheduled Workouts
			</h2>

			<div className="space-y-8">
				{teams.map((team) => {
					const viewMode = teamViewModes[team.id] || "daily"
					const workoutsPromise = workoutsData[team.id]

					if (!workoutsPromise) return null

					return (
						<Suspense
							key={`${team.id}-${viewMode}`}
							fallback={
								<div className="card p-6">
									<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
										<h3 className="font-semibold text-lg mb-2 sm:mb-0">
											{team.name}
										</h3>
										<div className="flex items-center gap-2">
											<Skeleton className="h-8 w-[140px]" />
											<Skeleton className="h-8 w-8" />
											<Skeleton className="h-8 w-8" />
											<Skeleton className="h-8 w-8" />
											<Skeleton className="h-8 w-8" />
											<Skeleton className="h-8 w-8" />
											<Skeleton className="h-8 w-8" />
											<Skeleton className="h-8 w-8" />
										</div>
									</div>
									<div>
										{viewMode === "daily" ? (
											// Daily view skeleton - exact heights to prevent layout shift
											<div className="space-y-6">
												<div className="space-y-4">
													{/* Date header - matches WorkoutDateGroup */}
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
																			{/* Title - large for daily view */}
																			<Skeleton className="h-9 w-3/4 mb-3" />

																			{/* Clock icon + time (if present) */}
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

																			{/* Description - multiline */}
																			<div className="mb-3 space-y-1">
																				<Skeleton className="h-4 w-full" />
																				<Skeleton className="h-4 w-5/6" />
																				<Skeleton className="h-4 w-2/3" />
																			</div>

																			{/* Movements section */}
																			<div className="mb-4">
																				<Skeleton className="h-4 w-24 mb-3" />
																				<div className="flex flex-wrap gap-2">
																					<Skeleton className="h-7 w-24" />
																					<Skeleton className="h-7 w-32" />
																					<Skeleton className="h-7 w-28" />
																					<Skeleton className="h-7 w-20" />
																				</div>
																			</div>

																			{/* Team Notes (optional) */}
																			{skeletonId === "skeleton-card-1" && (
																				<div className="border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20 pl-4 py-3 mb-4">
																					<Skeleton className="h-4 w-20 mb-1" />
																					<Skeleton className="h-4 w-full" />
																				</div>
																			)}
																		</div>

																		{/* Log Result button area */}
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
											// Weekly view skeleton - compact list layout
											<div className="space-y-6">
												{/* Multiple date groups for weekly view */}
												{["day-1", "day-2", "day-3"].map((dayId) => (
													<div key={dayId} className="space-y-4">
														{/* Date header */}
														<div className="flex items-center gap-2">
															<Skeleton className="h-4 w-4 rounded" />
															<Skeleton className="h-6 w-56" />
														</div>

														{/* Workout items for this date */}
														<div className="flex flex-col gap-4">
															{["workout-1", "workout-2"].map((workoutId) => (
																<div
																	key={`${dayId}-${workoutId}`}
																	className="border-l-4 border-primary pl-4 ml-2"
																>
																	<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
																		<div className="flex-1">
																			{/* Title */}
																			<Skeleton className="h-5 w-48 mb-2" />
																			{/* Description - line clamp 2 */}
																			<div className="space-y-1 mb-3">
																				<Skeleton className="h-3 w-full max-w-md" />
																				<Skeleton className="h-3 w-3/4 max-w-sm" />
																			</div>
																		</div>
																		{/* Result button or result display */}
																		<div className="flex items-center gap-2">
																			<Skeleton className="h-9 w-20" />
																			<Skeleton className="h-9 w-9 rounded" />
																		</div>
																	</div>
																</div>
															))}
														</div>
													</div>
												))}
											</div>
										)}
									</div>
								</div>
							}
						>
							<TeamWorkoutSuspense
								team={team}
								workoutsPromise={workoutsPromise}
								viewMode={viewMode}
								onViewModeChange={handleViewModeChange}
								onRefresh={handleRefresh}
							/>
						</Suspense>
					)
				})}
			</div>
		</div>
	)
}
