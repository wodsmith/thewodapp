"use client"

import { CalendarIcon, ClockIcon } from "@heroicons/react/24/outline"
import { format } from "date-fns"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useServerAction } from "zsa-react"
import { getScheduledTeamWorkoutsAction } from "@/actions/workout-actions"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup } from "@/components/ui/toggle-group"
import type {
	ScheduledWorkoutInstance,
	TrackWorkout,
	Workout,
} from "@/db/schema"

type ViewMode = "daily" | "weekly"

interface Team {
	id: string
	name: string
	isPersonalTeam?: number | boolean
}

// Type that matches what the server returns
type ScheduledWorkoutInstanceWithDetails = ScheduledWorkoutInstance & {
	trackWorkout?: (TrackWorkout & { workout?: Workout }) | null
}

interface TeamWorkoutDisplayProps {
	className?: string
	teams: Team[]
	initialScheduledWorkouts: Record<
		string,
		ScheduledWorkoutInstanceWithDetails[]
	>
}

// Session storage key prefix for caching
const CACHE_KEY_PREFIX = "team-workouts-"
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const IS_DEVELOPMENT = process.env.NODE_ENV === "development"

interface CachedWorkoutData {
	data: ScheduledWorkoutInstanceWithDetails[]
	timestamp: number
	viewMode: ViewMode
}

export function TeamWorkoutsDisplay({
	className,
	teams,
	initialScheduledWorkouts,
}: TeamWorkoutDisplayProps) {
	const [teamViewModes, setTeamViewModes] = useState<Record<string, ViewMode>>(
		() => {
			// Initialize all teams with daily view mode
			const initial: Record<string, ViewMode> = {}
			for (const team of teams) {
				initial[team.id] = "daily"
			}
			return initial
		},
	)

	const [scheduledWorkouts, setScheduledWorkouts] = useState<
		Record<string, ScheduledWorkoutInstanceWithDetails[]>
	>(initialScheduledWorkouts)

	const [teamLoadingStates, setTeamLoadingStates] = useState<
		Record<string, boolean>
	>({})

	// Fetch scheduled workouts
	const { execute: fetchScheduledWorkouts } = useServerAction(
		getScheduledTeamWorkoutsAction,
	)

	// Get cached data from session storage
	const getCachedData = useCallback(
		(
			teamId: string,
			mode: ViewMode,
		): ScheduledWorkoutInstanceWithDetails[] | null => {
			// Disable cache in development
			if (IS_DEVELOPMENT) return null

			if (typeof window === "undefined") return null

			try {
				const key = `${CACHE_KEY_PREFIX}${teamId}-${mode}`
				const cached = sessionStorage.getItem(key)
				if (!cached) return null

				const parsedCache: CachedWorkoutData = JSON.parse(cached)
				const now = Date.now()

				// Check if cache is still valid
				if (now - parsedCache.timestamp > CACHE_DURATION) {
					sessionStorage.removeItem(key)
					return null
				}

				return parsedCache.data
			} catch (error) {
				console.error("Error reading cache:", error)
				return null
			}
		},
		[],
	)

	// Save data to session storage
	const setCachedData = useCallback(
		(
			teamId: string,
			mode: ViewMode,
			data: ScheduledWorkoutInstanceWithDetails[],
		) => {
			// Disable cache in development
			if (IS_DEVELOPMENT) return

			if (typeof window === "undefined") return

			try {
				const key = `${CACHE_KEY_PREFIX}${teamId}-${mode}`
				const cacheData: CachedWorkoutData = {
					data,
					timestamp: Date.now(),
					viewMode: mode,
				}
				sessionStorage.setItem(key, JSON.stringify(cacheData))
			} catch (error) {
				console.error("Error writing cache:", error)
			}
		},
		[],
	)

	// Get date ranges for daily/weekly views
	const getDateRange = useCallback((mode: ViewMode) => {
		const now = new Date()
		if (mode === "daily") {
			const start = new Date(now)
			start.setHours(0, 0, 0, 0)
			const end = new Date(start)
			end.setDate(start.getDate() + 1)
			end.setMilliseconds(end.getMilliseconds() - 1) // Make end exclusive
			return { start, end }
		} else {
			// Weekly view - get current week
			const start = new Date(now)
			start.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
			start.setHours(0, 0, 0, 0)
			const end = new Date(start)
			end.setDate(start.getDate() + 7) // End of week
			end.setMilliseconds(end.getMilliseconds() - 1) // Make end exclusive
			return { start, end }
		}
	}, [])

	// Fetch scheduled workouts for a team
	const fetchTeamWorkouts = useCallback(
		async (teamId: string, mode: ViewMode, forceRefresh = false) => {
			// Check cache first unless force refresh
			if (!forceRefresh) {
				const cached = getCachedData(teamId, mode)
				if (cached !== null) {
					setScheduledWorkouts((prev) => ({
						...prev,
						[teamId]: cached,
					}))
					return // Use cached data, no loading state needed
				}
			}

			const { start, end } = getDateRange(mode)

			// Set loading state for this team
			setTeamLoadingStates((prev) => ({
				...prev,
				[teamId]: true,
			}))

			try {
				const result = await fetchScheduledWorkouts({
					teamId,
					startDate: start.toISOString(),
					endDate: end.toISOString(),
				})

				const [serverResult, serverError] = result

				if (serverResult?.success && !serverError) {
					const data = serverResult.data
					setScheduledWorkouts((prev) => ({
						...prev,
						[teamId]: data,
					}))
					// Cache the successful result
					setCachedData(teamId, mode, data)
				} else {
					setScheduledWorkouts((prev) => ({
						...prev,
						[teamId]: [],
					}))
					// Cache empty result too
					setCachedData(teamId, mode, [])
				}
			} catch (error) {
				console.error("Failed to fetch team workouts:", error)
				setScheduledWorkouts((prev) => ({
					...prev,
					[teamId]: [],
				}))
			} finally {
				// Clear loading state for this team
				setTeamLoadingStates((prev) => ({
					...prev,
					[teamId]: false,
				}))
			}
		},
		[fetchScheduledWorkouts, getDateRange, getCachedData, setCachedData],
	)

	// Handle view mode change for a team
	const handleViewModeChange = useCallback(
		(teamId: string, mode: ViewMode) => {
			setTeamViewModes((prev) => ({
				...prev,
				[teamId]: mode,
			}))
			fetchTeamWorkouts(teamId, mode)
		},
		[fetchTeamWorkouts],
	)

	// Initialize cache with initial data on mount
	useEffect(() => {
		if (typeof window !== "undefined") {
			for (const team of teams) {
				const teamWorkouts = initialScheduledWorkouts[team.id]
				if (teamWorkouts && teamWorkouts.length > 0) {
					// Cache initial data for daily view (default)
					setCachedData(team.id, "daily", teamWorkouts)
				}
			}
		}
	}, [teams, initialScheduledWorkouts, setCachedData]) // Run when dependencies change

	// Include all teams (personal and non-personal) for scheduled workouts
	const allTeams = useMemo(() => {
		return teams.filter((team) => team)
	}, [teams])

	if (allTeams.length === 0) {
		return null // Don't show anything if no teams
	}

	return (
		<div className={className}>
			<h2 className="mb-6 border-b pb-2 text-center font-bold text-2xl sm:text-left">
				Scheduled Workouts
			</h2>

			<div className="space-y-8">
				{allTeams.map((team) => {
					if (!team) return null

					const viewMode = teamViewModes[team.id] || "daily"
					const teamWorkouts = scheduledWorkouts[team.id] || []
					const isLoading = teamLoadingStates[team.id] || false

					return (
						<div key={team.id} className="card p-6">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
								<h3 className="font-semibold text-lg mb-2 sm:mb-0">
									{team.name}
								</h3>

								<div className="flex items-center gap-2">
									<ToggleGroup
										value={viewMode}
										onValueChange={(mode) =>
											handleViewModeChange(team.id, mode as ViewMode)
										}
										options={[
											{ value: "daily", label: "Today" },
											{ value: "weekly", label: "This Week" },
										]}
									/>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => fetchTeamWorkouts(team.id, viewMode, true)}
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
									<div className="space-y-4">
										{teamWorkouts.map((scheduledWorkout, index) => {
											// The server returns objects with instance properties spread at root level,
											// plus a trackWorkout property that contains the workout
											const instance = scheduledWorkout
											const workout = scheduledWorkout.trackWorkout?.workout

											if (!instance || !workout) {
												console.log(
													"[TeamWorkoutsDisplay] Skipping workout - missing instance or workout data",
													{ scheduledWorkout, workout },
												)
												return null
											}

											return (
												<div
													key={instance.id || index}
													className={`${
														viewMode === "daily"
															? "border-2 border-black dark:border-dark-border p-6 rounded-lg bg-card"
															: "border-l-4 border-primary pl-4"
													}`}
												>
													<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
														<div className="flex-1">
															<Link href={`/workouts/${workout.id}`}>
																<h4
																	className={`font-bold hover:underline mb-2 ${
																		viewMode === "daily"
																			? "text-xl"
																			: "text-lg font-medium"
																	}`}
																>
																	{workout.name}
																</h4>
															</Link>

															<div
																className={`flex items-center gap-4 text-muted-foreground ${
																	viewMode === "daily"
																		? "mb-4 text-base"
																		: "mb-2 text-sm"
																}`}
															>
																<span className="flex items-center gap-1">
																	<CalendarIcon className="h-4 w-4" />
																	{format(
																		new Date(instance.scheduledDate),
																		"MMM d, yyyy",
																	)}
																</span>

																{instance.classTimes && (
																	<span className="flex items-center gap-1">
																		<ClockIcon className="h-4 w-4" />
																		{instance.classTimes}
																	</span>
																)}
															</div>

															{/* Scheme Display - Only for Today view */}
															{viewMode === "daily" && workout.scheme && (
																<div className="mb-3">
																	<div className="inline-block border-2 border-black dark:border-dark-border px-3 py-1">
																		<p className="font-bold text-sm uppercase">
																			{workout.scheme}
																		</p>
																	</div>
																</div>
															)}

															{workout.description && (
																<p
																	className={`text-muted-foreground mb-3 ${viewMode === "daily" ? "text-base whitespace-pre-wrap" : "text-sm line-clamp-2"}`}
																>
																	{workout.description}
																</p>
															)}

															{/* Movements Display - Enhanced for Today view */}
															{viewMode === "daily" &&
																workout.movements &&
																workout.movements.length > 0 && (
																	<div className="mb-3">
																		<p className="text-sm font-semibold mb-2">
																			Movements:
																		</p>
																		<div className="flex flex-wrap gap-2">
																			{workout.movements.map(
																				(movement: any) => (
																					<span
																						key={movement.id}
																						className="inline-block border border-muted-foreground/30 px-2 py-1 text-sm"
																					>
																						{movement.name}
																					</span>
																				),
																			)}
																		</div>
																	</div>
																)}

															{instance.teamSpecificNotes && (
																<div
																	className={`bg-muted rounded ${viewMode === "daily" ? "p-3 mb-3" : "p-2 mb-2"}`}
																>
																	<p
																		className={`${viewMode === "daily" ? "text-base" : "text-sm"}`}
																	>
																		<strong>Team Notes:</strong>{" "}
																		{instance.teamSpecificNotes}
																	</p>
																</div>
															)}

															{instance.scalingGuidanceForDay && (
																<div
																	className={`bg-muted rounded ${viewMode === "daily" ? "p-3 mb-3" : "p-2 mb-2"}`}
																>
																	<p
																		className={`${viewMode === "daily" ? "text-base" : "text-sm"}`}
																	>
																		<strong>Scaling:</strong>{" "}
																		{instance.scalingGuidanceForDay}
																	</p>
																</div>
															)}
														</div>

														<div
															className={
																viewMode === "daily"
																	? "mt-4 sm:mt-0 sm:ml-6"
																	: "mt-2 sm:mt-0"
															}
														>
															<Button
																asChild
																variant={
																	viewMode === "daily" ? "default" : "secondary"
																}
																size={viewMode === "daily" ? "default" : "sm"}
																className={
																	viewMode === "daily" ? "w-full sm:w-auto" : ""
																}
															>
																<Link
																	href={{
																		pathname: "/log/new",
																		query: {
																			workoutId: workout.id,
																			scheduledInstanceId: instance.id,
																			redirectUrl: "/workouts",
																		},
																	}}
																>
																	Log Result
																</Link>
															</Button>
														</div>
													</div>
												</div>
											)
										})}
									</div>
								) : (
									<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
										<CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
										<h4 className="text-base font-medium text-foreground mb-2">
											{viewMode === "daily"
												? "No workouts scheduled for today"
												: "No workouts scheduled this week"}
										</h4>
										<p className="text-sm text-muted-foreground max-w-sm">
											{viewMode === "daily"
												? "Check back tomorrow or switch to the weekly view to see upcoming workouts."
												: "New workouts will appear here when they're scheduled for your team."}
										</p>
									</div>
								)}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}
