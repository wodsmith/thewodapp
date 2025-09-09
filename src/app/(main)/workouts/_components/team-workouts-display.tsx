"use client"

import {
	CalendarIcon,
	ClockIcon,
	PencilIcon,
} from "@heroicons/react/24/outline"
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
import {
	toLocalDate,
	startOfLocalDay,
	endOfLocalDay,
	getLocalDateKey,
	startOfLocalWeek,
	endOfLocalWeek,
} from "@/utils/date-utils"

type ViewMode = "daily" | "weekly"

interface Team {
	id: string
	name: string
	isPersonalTeam?: number | boolean
}

// Type that matches what the server returns
type ScheduledWorkoutInstanceWithDetails = ScheduledWorkoutInstance & {
	trackWorkout?: (TrackWorkout & { workout?: Workout }) | null
	result?: any | null
}

interface TeamWorkoutDisplayProps {
	className?: string
	teams: Team[]
	initialScheduledWorkouts: Record<
		string,
		ScheduledWorkoutInstanceWithDetails[]
	>
	workoutResults?: Record<string, any>
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
	>(() => {
		// Filter initial data to only show today's workouts for daily view
		const filtered: Record<string, ScheduledWorkoutInstanceWithDetails[]> = {}
		const todayKey = getLocalDateKey(new Date())

		for (const teamId in initialScheduledWorkouts) {
			const teamWorkouts = initialScheduledWorkouts[teamId]
			// Filter to only include today's workouts initially
			filtered[teamId] = teamWorkouts.filter((workout) => {
				const workoutDateKey = getLocalDateKey(workout.scheduledDate)
				return workoutDateKey === todayKey
			})
		}

		return filtered
	})

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

	// Get date ranges for daily/weekly views in user's local timezone
	const getDateRange = useCallback((mode: ViewMode) => {
		if (mode === "daily") {
			const start = startOfLocalDay()
			const end = endOfLocalDay()
			return { start, end }
		} else {
			// Weekly view - get current week in local timezone
			const start = startOfLocalWeek()
			const end = endOfLocalWeek()
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
					// Filter initial data to only include today's workouts for daily view
					const todayKey = getLocalDateKey(new Date())
					const todaysWorkouts = teamWorkouts.filter((workout) => {
						const workoutDateKey = getLocalDateKey(workout.scheduledDate)
						return workoutDateKey === todayKey
					})
					// Cache filtered data for daily view (default)
					setCachedData(team.id, "daily", todaysWorkouts)
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
			<h2 className="text-2xl font-bold mb-6 pb-3 border-b-2 border-primary/20 text-center sm:text-left">
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
									<div className="space-y-6">
										{(() => {
											// Group workouts by date
											const workoutsByDate = teamWorkouts.reduce(
												(acc, scheduledWorkout) => {
													const instance = scheduledWorkout
													const workout = scheduledWorkout.trackWorkout?.workout

													if (!instance || !workout) {
														console.log(
															"[TeamWorkoutsDisplay] Skipping workout - missing instance or workout data",
															{ scheduledWorkout, workout },
														)
														return acc
													}

													// Use local timezone for date grouping
													const dateKey = getLocalDateKey(
														instance.scheduledDate,
													)
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
														workout: any
														trackWorkout: any
													}>
												>,
											)

											// Sort dates and render
											return Object.entries(workoutsByDate)
												.sort(([a], [b]) => a.localeCompare(b))
												.map(([dateKey, workouts]) => (
													<div key={dateKey} className="space-y-4">
														{/* Date Header */}
														<div className="flex items-center gap-2">
															<CalendarIcon
																className={`${viewMode === "daily" ? "h-5 w-5" : "h-4 w-4"} text-primary`}
															/>
															<h3
																className={`font-semibold ${viewMode === "daily" ? "text-lg" : "text-base"}`}
															>
																{format(
																	toLocalDate(dateKey),
																	"EEEE, MMMM d, yyyy",
																)}
															</h3>
														</div>

														{/* Workouts for this date */}
														<div
															className={`${
																viewMode === "daily"
																	? "ml-7 grid grid-cols-1 sm:grid-cols-2 gap-4"
																	: "flex flex-col gap-4"
															}`}
														>
															{workouts.map(
																(
																	{ instance, workout, trackWorkout },
																	index,
																) => (
																	<div
																		key={instance.id || index}
																		className={`${
																			viewMode === "daily"
																				? "border-2 border-black dark:border-dark-border p-6 rounded-lg bg-background/10 dark:bg-white/10 flex flex-col"
																				: "border-l-4 border-primary pl-4 ml-2"
																		}`}
																	>
																		<div
																			className={`${
																				viewMode === "daily"
																					? "flex flex-col h-full"
																					: "flex flex-col sm:flex-row sm:items-start sm:justify-between"
																			}`}
																		>
																			<div className="flex-1">
																				<Link href={`/workouts/${workout.id}`}>
																					<h4
																						className={`font-bold hover:underline ${
																							viewMode === "daily"
																								? "text-2xl mb-3 leading-tight"
																								: "text-lg mb-2"
																						}`}
																					>
																						{workout.name}
																					</h4>
																				</Link>

																				{/* Only show class times, not date */}
																				{instance.classTimes && (
																					<div
																						className={`flex items-center gap-2 text-muted-foreground ${
																							viewMode === "daily"
																								? "mb-4 text-base"
																								: "mb-2 text-sm"
																						}`}
																					>
																						<ClockIcon
																							className={`${viewMode === "daily" ? "h-4 w-4" : "h-3 w-3"}`}
																						/>
																						<span>{instance.classTimes}</span>
																					</div>
																				)}

																				{/* Scheme Display - Only for Today view */}
																				{viewMode === "daily" &&
																					workout.scheme && (
																						<div className="mb-4">
																							<div className="inline-block bg-primary text-primary-foreground px-3 py-2 rounded-sm">
																								<p className="font-bold text-sm uppercase tracking-wide">
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
																						<div className="mb-4">
																							<p className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground">
																								Movements
																							</p>
																							<div className="flex flex-wrap gap-2">
																								{workout.movements.map(
																									(movement: any) => (
																										<span
																											key={movement.id}
																											className="inline-block bg-secondary text-secondary-foreground px-3 py-1 text-sm font-medium rounded-sm"
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
																						className={
																							viewMode === "daily"
																								? "border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20 pl-4 py-3 mb-4 rounded-r"
																								: "bg-muted rounded p-2 mb-2"
																						}
																					>
																						{viewMode === "daily" ? (
																							<>
																								<p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-1">
																									Team Notes
																								</p>
																								<p className="text-base">
																									{instance.teamSpecificNotes}
																								</p>
																							</>
																						) : (
																							<p className="text-sm">
																								<strong>Team Notes:</strong>{" "}
																								{instance.teamSpecificNotes}
																							</p>
																						)}
																					</div>
																				)}

																				{instance.scalingGuidanceForDay && (
																					<div
																						className={
																							viewMode === "daily"
																								? "border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 pl-4 py-3 mb-4 rounded-r"
																								: "bg-muted rounded p-2 mb-2"
																						}
																					>
																						{viewMode === "daily" ? (
																							<>
																								<p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">
																									Scaling Options
																								</p>
																								<p className="text-base">
																									{
																										instance.scalingGuidanceForDay
																									}
																								</p>
																							</>
																						) : (
																							<p className="text-sm">
																								<strong>Scaling:</strong>{" "}
																								{instance.scalingGuidanceForDay}
																							</p>
																						)}
																					</div>
																				)}
																			</div>

																			<div
																				className={
																					viewMode === "daily"
																						? "mt-6 pt-4 border-t border-black/10 dark:border-white/10"
																						: "mt-2"
																				}
																			>
																				{(() => {
																					const result = instance.result

																					if (result) {
																						// Show the result with an edit button
																						return (
																							<div className="space-y-3">
																								<div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-500 rounded-lg p-4">
																									<div className="flex items-center justify-between">
																										<div>
																											<p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">
																												Result Logged
																											</p>
																											<p className="text-lg font-bold">
																												{result.wodScore ||
																													"Completed"}
																											</p>
																											{result.scale && (
																												<span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-green-600 text-white rounded">
																													{result.scale.toUpperCase()}
																												</span>
																											)}
																										</div>
																										<Button
																											asChild
																											variant="outline"
																											size="sm"
																											className="flex items-center gap-2"
																										>
																											<Link
																												href={{
																													pathname: `/log/${result.id}/edit`,
																													query: {
																														redirectUrl:
																															"/workouts",
																													},
																												}}
																											>
																												<PencilIcon className="h-4 w-4" />
																												Edit
																											</Link>
																										</Button>
																									</div>
																									{result.notes && (
																										<p className="mt-2 text-sm text-muted-foreground">
																											{result.notes}
																										</p>
																									)}
																								</div>
																							</div>
																						)
																					}

																					// Show the log button if no result exists
																					return (
																						<Button
																							asChild
																							variant={
																								viewMode === "daily"
																									? "default"
																									: "secondary"
																							}
																							size={
																								viewMode === "daily"
																									? "default"
																									: "sm"
																							}
																							className={
																								viewMode === "daily"
																									? "w-full"
																									: ""
																							}
																						>
																							<Link
																								href={{
																									pathname: "/log/new",
																									query: {
																										workoutId: workout.id,
																										scheduledInstanceId:
																											instance.id,
																										programmingTrackId:
																											trackWorkout?.trackId,
																										redirectUrl: "/workouts",
																									},
																								}}
																							>
																								Log Result
																							</Link>
																						</Button>
																					)
																				})()}
																			</div>
																		</div>
																	</div>
																),
															)}
														</div>
													</div>
												))
										})()}
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
