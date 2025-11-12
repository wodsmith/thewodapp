"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useServerAction } from "@repo/zsa-react"
import {
	getScheduledTeamWorkoutsAction,
	getScheduledTeamWorkoutsWithResultsAction,
} from "@/actions/workout-actions"
import type { Team } from "@/db/schema"
import type { ScheduledWorkoutInstanceWithDetails } from "@/server/scheduling-service"
import { useSessionStore } from "@/state/session"
import {
	endOfLocalDay,
	endOfLocalWeek,
	getLocalDateKey,
	startOfLocalDay,
	startOfLocalWeek,
} from "@/utils/date-utils"
import { TeamWorkoutSection } from "./team-workout-section"

type ViewMode = "daily" | "weekly"

// Uses server type: ScheduledWorkoutInstanceWithDetails (includes WorkoutWithMovements)
type ScheduledWorkoutInstanceWithResult =
	ScheduledWorkoutInstanceWithDetails & {
		result?: any | null
	}

interface TeamWorkoutDisplayProps {
	className?: string
	teams: Team[]
	initialScheduledWorkouts: Record<string, ScheduledWorkoutInstanceWithResult[]>
	workoutResults?: Record<string, any>
	userId?: string
}

// Session storage key prefix for caching
const CACHE_KEY_PREFIX = "team-workouts-"
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const IS_DEVELOPMENT = process.env.NODE_ENV === "development"

interface CachedWorkoutData {
	data: ScheduledWorkoutInstanceWithResult[]
	timestamp: number
	viewMode: ViewMode
}

export function TeamWorkoutsDisplay({
	className,
	teams,
	initialScheduledWorkouts,
	userId: propUserId,
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
		Record<string, ScheduledWorkoutInstanceWithResult[]>
	>(() => {
		// Filter initial data to only show today's workouts for daily view
		// This filtering happens on the client side with the user's local timezone
		const filtered: Record<string, ScheduledWorkoutInstanceWithResult[]> = {}
		const todayKey = getLocalDateKey(new Date())

		for (const teamId in initialScheduledWorkouts) {
			const teamWorkouts = initialScheduledWorkouts[teamId]
			if (teamWorkouts) {
				// Filter to only include today's workouts initially (in user's local timezone)
				filtered[teamId] = teamWorkouts.filter((workout) => {
					const workoutDateKey = getLocalDateKey(workout.scheduledDate)
					return workoutDateKey === todayKey
				})
			}
		}

		return filtered
	})

	const [teamLoadingStates, setTeamLoadingStates] = useState<
		Record<string, boolean>
	>({})

	const [teamErrors, setTeamErrors] = useState<Record<string, string | null>>(
		{},
	)

	// Get user ID from session or prop
	const session = useSessionStore((state) => state.session)
	const userId = propUserId || session?.userId

	// Fetch scheduled workouts (use with results action if user ID is available)
	const { execute: fetchScheduledWorkouts } = useServerAction(
		userId
			? getScheduledTeamWorkoutsWithResultsAction
			: getScheduledTeamWorkoutsAction,
	)

	// Get cached data from session storage
	const getCachedData = useCallback(
		(
			teamId: string,
			mode: ViewMode,
		): ScheduledWorkoutInstanceWithResult[] | null => {
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
			data: ScheduledWorkoutInstanceWithResult[],
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
				const params = userId
					? {
							teamId,
							startDate: start.toISOString(),
							endDate: end.toISOString(),
							userId,
						}
					: {
							teamId,
							startDate: start.toISOString(),
							endDate: end.toISOString(),
						}

				const result = await fetchScheduledWorkouts(params as any)

				const [serverResult, serverError] = result

				if (serverResult?.success && !serverError) {
					const data = serverResult.data
					setScheduledWorkouts((prev) => ({
						...prev,
						[teamId]: data,
					}))
					setTeamErrors((prev) => ({ ...prev, [teamId]: null }))
					// Cache the successful result
					setCachedData(teamId, mode, data)
				} else {
					setScheduledWorkouts((prev) => ({
						...prev,
						[teamId]: [],
					}))
					setTeamErrors((prev) => ({
						...prev,
						[teamId]: "Failed to load workouts. Try again.",
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
				setTeamErrors((prev) => ({
					...prev,
					[teamId]: "Failed to load workouts. Try again.",
				}))
			} finally {
				// Clear loading state for this team
				setTeamLoadingStates((prev) => ({
					...prev,
					[teamId]: false,
				}))
			}
		},
		[
			fetchScheduledWorkouts,
			getDateRange,
			getCachedData,
			setCachedData,
			userId,
		],
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
		if (typeof window !== "undefined" && !IS_DEVELOPMENT) {
			for (const team of teams) {
				const teamWorkouts = initialScheduledWorkouts[team.id]
				if (teamWorkouts) {
					// Filter initial data to only include today's workouts for daily view
					const todayKey = getLocalDateKey(new Date())
					const todaysWorkouts = teamWorkouts.filter((workout) => {
						const workoutDateKey = getLocalDateKey(workout.scheduledDate)
						return workoutDateKey === todayKey
					})
					// Cache filtered data for daily view (default)
					// Even if empty, we cache it to show that we've loaded the data
					setCachedData(team.id, "daily", todaysWorkouts)
				}
			}
		}
	}, [teams, initialScheduledWorkouts, setCachedData]) // Run when dependencies change

	// Sort teams to put personal teams on top
	const allTeams = useMemo(() => {
		return (teams as Team[])
			.filter((team): team is Team => team !== null && team !== undefined)
			.sort((a, b) => {
				// Personal teams first (isPersonalTeam is truthy)
				const aIsPersonal = Boolean(a.isPersonalTeam)
				const bIsPersonal = Boolean(b.isPersonalTeam)

				if (aIsPersonal && !bIsPersonal) return -1
				if (!aIsPersonal && bIsPersonal) return 1

				// Within same type, sort alphabetically
				return a.name.localeCompare(b.name)
			})
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
					const error = teamErrors[team.id] || null

					return (
						<TeamWorkoutSection
							key={team.id}
							team={team}
							viewMode={viewMode}
							teamWorkouts={teamWorkouts}
							isLoading={isLoading}
							error={error}
							onViewModeChange={handleViewModeChange}
							onRefresh={fetchTeamWorkouts}
						/>
					)
				})}
			</div>
		</div>
	)
}
