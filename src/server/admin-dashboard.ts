import type { ProgrammingTrack } from "@/db/schema"
import { unstable_cache as nextCache } from "next/cache"
import { cache } from "react"
import { getTeamTracks, getWorkoutsForTrack } from "./programming-tracks"
import {
	type ScheduledWorkoutInstanceWithDetails,
	getScheduledWorkoutsForTeam,
} from "./scheduling-service"
import { getTeam } from "./teams"

// Extended type for admin dashboard with additional computed properties
interface ExtendedScheduledWorkout extends ScheduledWorkoutInstanceWithDetails {
	scheduledAt: Date
	isCompleted: boolean
	trackId?: string | null
	name: string
	type: string
	estimatedDuration: number
}

// Helper function to get scheduled workouts for a team (wrapper for convenience)
async function getTeamScheduledWorkouts(
	teamId: string,
): Promise<ExtendedScheduledWorkout[]> {
	const now = new Date()
	const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // Next year
	const startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) // Last year

	const workouts = await getScheduledWorkoutsForTeam(teamId, {
		start: startDate,
		end: endDate,
	})

	// Convert to extended type with computed properties
	return workouts.map((w) => ({
		...w,
		scheduledAt: new Date(w.scheduledDate),
		isCompleted: false, // TODO: This would need to be calculated from actual completion data
		trackId: w.trackWorkout?.trackId || null, // Get trackId from the related track workout
		name: "Workout", // TODO: Get actual workout name from related data
		type: "workout",
		estimatedDuration: 60, // Default duration
	}))
}

// Helper function to get upcoming workouts for a team
async function getUpcomingWorkouts(
	teamId: string,
	days = 30,
): Promise<ExtendedScheduledWorkout[]> {
	const now = new Date()
	const workouts = await getTeamScheduledWorkouts(teamId)
	return workouts.filter((w) => w.scheduledAt > now)
}

export interface AdminDashboardData {
	team: {
		id: string
		name: string
		memberCount: number
		createdAt: Date
	}
	tracks: {
		id: string
		name: string
		description: string
		workoutCount: number
		completedWorkouts: number
		progressPercentage: number
		isActive: boolean
		createdAt: Date
	}[]
	schedulingStats: {
		totalScheduledWorkouts: number
		upcomingWorkouts: number
		workoutsThisWeek: number
		workoutsThisMonth: number
		averageWorkoutsPerWeek: number
	}
	upcomingSchedule: {
		date: string
		workouts: {
			id: string
			name: string
			type: string
			duration: number
			trackId?: string
			trackName?: string
		}[]
	}[]
	performanceMetrics: {
		dataFetchTime: number
		cacheStatus: "hit" | "miss" | "partial"
		lastUpdated: Date
	}
}

export interface TeamSchedulingStats {
	totalScheduledWorkouts: number
	upcomingWorkouts: number
	workoutsThisWeek: number
	workoutsThisMonth: number
	averageWorkoutsPerWeek: number
	completionRate: number
	mostActiveTrack: string | null
}

export type UpcomingScheduleOverview = {
	date: string
	workouts: {
		id: string
		name: string
		type: string
		duration: number
		trackId?: string
		trackName?: string
		scheduledAt: Date
	}[]
}[]

// Cache configuration
const CACHE_DURATION = 5 * 60 // 5 minutes
const CACHE_TAGS = {
	ADMIN_DASHBOARD: "admin-dashboard",
	TEAM_STATS: "team-stats",
	SCHEDULE_OVERVIEW: "schedule-overview",
} as const

/**
 * Get comprehensive admin dashboard data with performance optimization
 */
export const getAdminDashboardData = cache(
	async (teamId: string): Promise<AdminDashboardData> => {
		const startTime = Date.now()
		const cacheStatus: "hit" | "miss" | "partial" = "miss"

		try {
			if (process.env.NODE_ENV === "development") {
				console.log(
					`[AdminDashboard] Starting data aggregation for teamId: ${teamId}`,
				)
			}

			// Use parallel data fetching for performance
			const [team, tracks, scheduledWorkouts, upcomingWorkouts] =
				await Promise.all([
					getTeam(teamId),
					getTeamTracks(teamId),
					getTeamScheduledWorkouts(teamId),
					getUpcomingWorkouts(teamId, 30), // Next 30 days
				])

			if (!team) {
				throw new Error(`Team not found: ${teamId}`)
			}

			// Process tracks with workout counts and progress
			const processedTracks = await Promise.all(
				tracks.map(async (track) => {
					const trackWorkouts = await getWorkoutsForTrack(track.id)
					// Note: TrackWorkout doesn't have isCompleted property, so we'll use total count
					const completedWorkouts = 0 // This would need to be calculated from actual scheduled workout completions
					const progressPercentage = 0 // Placeholder for now

					return {
						id: track.id,
						name: track.name,
						description: track.description || "",
						workoutCount: trackWorkouts.length,
						completedWorkouts,
						progressPercentage,
						isActive: true, // ProgrammingTrack doesn't have isActive, default to true
						createdAt: track.createdAt,
					}
				}),
			)

			// Calculate scheduling statistics
			const now = new Date()
			const weekStart = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() - now.getDay(),
			)
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

			const workoutsThisWeek = scheduledWorkouts.filter(
				(w) =>
					new Date(w.scheduledAt) >= weekStart && new Date(w.scheduledAt) < now,
			).length

			const workoutsThisMonth = scheduledWorkouts.filter(
				(w) =>
					new Date(w.scheduledAt) >= monthStart &&
					new Date(w.scheduledAt) < now,
			).length

			// Calculate average workouts per week (last 4 weeks)
			const fourWeeksAgo = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000)
			const recentWorkouts = scheduledWorkouts.filter(
				(w) =>
					new Date(w.scheduledAt) >= fourWeeksAgo &&
					new Date(w.scheduledAt) < now,
			)
			const averageWorkoutsPerWeek = Math.round(recentWorkouts.length / 4)

			const schedulingStats: TeamSchedulingStats = {
				totalScheduledWorkouts: scheduledWorkouts.length,
				upcomingWorkouts: upcomingWorkouts.length,
				workoutsThisWeek,
				workoutsThisMonth,
				averageWorkoutsPerWeek,
				completionRate:
					scheduledWorkouts.length > 0
						? Math.round(
								(scheduledWorkouts.filter((w) => w.isCompleted).length /
									scheduledWorkouts.length) *
									100,
							)
						: 0,
				mostActiveTrack:
					processedTracks.length > 0
						? processedTracks.reduce((prev, current) =>
								prev.workoutCount > current.workoutCount ? prev : current,
							).name
						: null,
			}

			// Process upcoming schedule overview
			const upcomingSchedule = await getUpcomingScheduleOverview(teamId, 14)

			const endTime = Date.now()
			const dataFetchTime = endTime - startTime

			const dashboardData: AdminDashboardData = {
				team: {
					id: team.id,
					name: team.name,
					memberCount: team.memberCount || 0,
					createdAt: team.createdAt,
				},
				tracks: processedTracks,
				schedulingStats,
				upcomingSchedule,
				performanceMetrics: {
					dataFetchTime,
					cacheStatus,
					lastUpdated: new Date(),
				},
			}

			if (process.env.NODE_ENV === "development") {
				console.log(
					`[AdminDashboard] Data aggregation completed for teamId: ${teamId} in ${dataFetchTime}ms. Cached: ${cacheStatus}`,
				)
			}

			return dashboardData
		} catch (error) {
			const endTime = Date.now()
			const dataFetchTime = endTime - startTime

			console.error(
				`[AdminDashboard] Error aggregating data for teamId: ${teamId}:`,
				error,
			)

			// Return minimal data structure on error
			return {
				team: {
					id: teamId,
					name: "Unknown Team",
					memberCount: 0,
					createdAt: new Date(),
				},
				tracks: [],
				schedulingStats: {
					totalScheduledWorkouts: 0,
					upcomingWorkouts: 0,
					workoutsThisWeek: 0,
					workoutsThisMonth: 0,
					averageWorkoutsPerWeek: 0,
				},
				upcomingSchedule: [],
				performanceMetrics: {
					dataFetchTime,
					cacheStatus: "miss",
					lastUpdated: new Date(),
				},
			}
		}
	},
)

/**
 * Get detailed team scheduling statistics
 */
export const getTeamSchedulingStats = nextCache(
	async (teamId: string): Promise<TeamSchedulingStats> => {
		const startTime = Date.now()

		try {
			if (process.env.LOG_LEVEL === "debug") {
				console.log(
					`[AdminDashboard] Fetching scheduling stats for teamId: ${teamId}`,
				)
			}

			const [scheduledWorkouts, tracks] = await Promise.all([
				getTeamScheduledWorkouts(teamId),
				getTeamTracks(teamId),
			])

			const now = new Date()
			const weekStart = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() - now.getDay(),
			)
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

			const workoutsThisWeek = scheduledWorkouts.filter(
				(w) =>
					new Date(w.scheduledAt) >= weekStart &&
					new Date(w.scheduledAt) <= now,
			).length

			const workoutsThisMonth = scheduledWorkouts.filter(
				(w) =>
					new Date(w.scheduledAt) >= monthStart &&
					new Date(w.scheduledAt) <= now,
			).length

			const upcomingWorkouts = scheduledWorkouts.filter(
				(w) => new Date(w.scheduledAt) > now,
			).length

			// Calculate average workouts per week (last 8 weeks)
			const eightWeeksAgo = new Date(
				now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000,
			)
			const recentWorkouts = scheduledWorkouts.filter(
				(w) =>
					new Date(w.scheduledAt) >= eightWeeksAgo &&
					new Date(w.scheduledAt) <= now,
			)
			const averageWorkoutsPerWeek = Math.round(recentWorkouts.length / 8)

			// Calculate completion rate
			const completedWorkouts = scheduledWorkouts.filter(
				(w) => w.isCompleted,
			).length
			const completionRate =
				scheduledWorkouts.length > 0
					? Math.round((completedWorkouts / scheduledWorkouts.length) * 100)
					: 0

			// Find most active track
			const trackWorkoutCounts = new Map<string, number>()
			for (const workout of scheduledWorkouts) {
				if (workout.trackId) {
					trackWorkoutCounts.set(
						workout.trackId,
						(trackWorkoutCounts.get(workout.trackId) || 0) + 1,
					)
				}
			}

			let mostActiveTrack: string | null = null
			let maxCount = 0
			trackWorkoutCounts.forEach((count, trackId) => {
				if (count > maxCount) {
					maxCount = count
					const track = tracks.find((t) => t.id === trackId)
					mostActiveTrack = track ? track.name : null
				}
			})

			const stats: TeamSchedulingStats = {
				totalScheduledWorkouts: scheduledWorkouts.length,
				upcomingWorkouts,
				workoutsThisWeek,
				workoutsThisMonth,
				averageWorkoutsPerWeek,
				completionRate,
				mostActiveTrack,
			}

			const endTime = Date.now()
			if (process.env.LOG_LEVEL === "debug") {
				console.log(
					`[AdminDashboard] Scheduling stats fetched for teamId: ${teamId} in ${endTime - startTime}ms`,
				)
			}

			return stats
		} catch (error) {
			console.error(
				`[AdminDashboard] Error fetching scheduling stats for teamId: ${teamId}:`,
				error,
			)

			return {
				totalScheduledWorkouts: 0,
				upcomingWorkouts: 0,
				workoutsThisWeek: 0,
				workoutsThisMonth: 0,
				averageWorkoutsPerWeek: 0,
				completionRate: 0,
				mostActiveTrack: null,
			}
		}
	},
	[CACHE_TAGS.TEAM_STATS],
	{
		revalidate: CACHE_DURATION,
		tags: [CACHE_TAGS.TEAM_STATS],
	},
)

/**
 * Get upcoming schedule overview for specified number of days
 */
export const getUpcomingScheduleOverview = nextCache(
	async (teamId: string, days = 14): Promise<UpcomingScheduleOverview> => {
		const startTime = Date.now()

		try {
			if (process.env.LOG_LEVEL === "debug") {
				console.log(
					`[AdminDashboard] Fetching upcoming schedule for teamId: ${teamId}, days: ${days}`,
				)
			}

			const upcomingWorkouts = await getUpcomingWorkouts(teamId, days)
			const tracks = await getTeamTracks(teamId)

			// Group workouts by date
			const workoutsByDate = new Map<string, ExtendedScheduledWorkout[]>()

			for (const workout of upcomingWorkouts) {
				const dateKey = workout.scheduledAt.toISOString().split("T")[0]
				if (!workoutsByDate.has(dateKey)) {
					workoutsByDate.set(dateKey, [])
				}
				const workouts = workoutsByDate.get(dateKey)
				if (workouts) {
					workouts.push(workout)
				}
			}

			// Convert to array format with track information
			const scheduleOverview: UpcomingScheduleOverview = Array.from(
				workoutsByDate.entries(),
			)
				.map(([date, workouts]) => ({
					date,
					workouts: workouts.map((workout) => {
						const track = workout.trackId
							? tracks.find((t: ProgrammingTrack) => t.id === workout.trackId)
							: null
						return {
							id: workout.id,
							name: workout.name,
							type: workout.type,
							duration: workout.estimatedDuration,
							trackId: workout.trackId || undefined,
							trackName: track?.name || undefined,
							scheduledAt: workout.scheduledAt,
						}
					}),
				}))
				.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

			const endTime = Date.now()
			if (process.env.LOG_LEVEL === "debug") {
				console.log(
					`[AdminDashboard] Schedule overview fetched for teamId: ${teamId} in ${endTime - startTime}ms`,
				)
			}

			return scheduleOverview
		} catch (error) {
			console.error(
				`[AdminDashboard] Error fetching schedule overview for teamId: ${teamId}:`,
				error,
			)
			return []
		}
	},
	[CACHE_TAGS.SCHEDULE_OVERVIEW],
	{
		revalidate: CACHE_DURATION,
		tags: [CACHE_TAGS.SCHEDULE_OVERVIEW],
	},
)

/**
 * Invalidate admin dashboard cache for a specific team
 */
export async function invalidateAdminDashboardCache(
	teamId: string,
): Promise<void> {
	try {
		const { revalidateTag } = await import("next/cache")

		// Invalidate all related cache tags
		revalidateTag(CACHE_TAGS.ADMIN_DASHBOARD)
		revalidateTag(CACHE_TAGS.TEAM_STATS)
		revalidateTag(CACHE_TAGS.SCHEDULE_OVERVIEW)

		if (process.env.LOG_LEVEL === "debug") {
			console.log(`[AdminDashboard] Cache invalidated for teamId: ${teamId}`)
		}
	} catch (error) {
		console.error(
			`[AdminDashboard] Error invalidating cache for teamId: ${teamId}:`,
			error,
		)
	}
}

/**
 * Get performance metrics for the admin dashboard
 */
export async function getDashboardPerformanceMetrics(teamId: string): Promise<{
	cacheHitRate: number
	averageLoadTime: number
	lastCacheRefresh: Date
}> {
	// This would typically be implemented with a performance monitoring service
	// For now, return mock data
	return {
		cacheHitRate: 0.85, // 85% cache hit rate
		averageLoadTime: 250, // 250ms average load time
		lastCacheRefresh: new Date(),
	}
}
