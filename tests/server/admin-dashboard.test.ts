import {
	type AdminDashboardData,
	type TeamSchedulingStats,
	type UpcomingScheduleOverview,
	getAdminDashboardData,
	getDashboardPerformanceMetrics,
	getTeamSchedulingStats,
	getUpcomingScheduleOverview,
	invalidateAdminDashboardCache,
} from "@/server/admin-dashboard"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock external dependencies
vi.mock("@/server/programming-tracks", () => ({
	getTeamTracks: vi.fn(),
	getWorkoutsForTrack: vi.fn(),
}))

vi.mock("@/server/scheduling-service", () => ({
	getScheduledWorkoutsForTeam: vi.fn(),
}))

vi.mock("@/server/teams", () => ({
	getTeam: vi.fn(),
}))

vi.mock("next/cache", () => ({
	unstable_cache: vi.fn((fn) => fn),
	revalidateTag: vi.fn(),
}))

// Import mocked functions
import { getTeamTracks, getWorkoutsForTrack } from "@/server/programming-tracks"
import { getScheduledWorkoutsForTeam } from "@/server/scheduling-service"
import { getTeam } from "@/server/teams"

const mockGetTeamTracks = vi.mocked(getTeamTracks)
const mockGetWorkoutsForTrack = vi.mocked(getWorkoutsForTrack)
const mockGetScheduledWorkoutsForTeam = vi.mocked(getScheduledWorkoutsForTeam)
const mockGetTeam = vi.mocked(getTeam)

// Mock data
const mockTeam = {
	id: "team_123",
	name: "Test Team",
	memberCount: 15,
	createdAt: new Date("2024-01-01"),
}

const mockTracks = [
	{
		id: "track_1",
		name: "Strength Track",
		description: "Build muscle and strength",
		type: "strength",
		createdAt: new Date("2024-01-15"),
		updatedAt: new Date("2024-01-15"),
		updateCounter: null,
		ownerTeamId: "team_123",
		isPublic: 0,
	},
	{
		id: "track_2",
		name: "Cardio Track",
		description: "Improve cardiovascular fitness",
		type: "cardio",
		createdAt: new Date("2024-02-01"),
		updatedAt: new Date("2024-02-01"),
		updateCounter: null,
		ownerTeamId: "team_123",
		isPublic: 0,
	},
]

const mockTrackWorkouts = [
	{
		id: "trwk_1",
		trackId: "track_1",
		workoutId: "workout_1",
		dayNumber: 1,
		weekNumber: 1,
		notes: null,
		createdAt: new Date("2024-11-01"),
		updatedAt: new Date("2024-11-01"),
		updateCounter: 0,
	},
	{
		id: "trwk_2",
		trackId: "track_1",
		workoutId: "workout_2",
		dayNumber: 2,
		weekNumber: 1,
		notes: null,
		createdAt: new Date("2024-11-01"),
		updatedAt: new Date("2024-11-01"),
		updateCounter: 0,
	},
	{
		id: "trwk_3",
		trackId: "track_1",
		workoutId: "workout_3",
		dayNumber: 3,
		weekNumber: 1,
		notes: null,
		createdAt: new Date("2024-11-01"),
		updatedAt: new Date("2024-11-01"),
		updateCounter: 0,
	},
]

const mockScheduledWorkouts = [
	{
		id: "scheduled_1",
		teamId: "team_123",
		trackWorkoutId: "trwk_1",
		scheduledDate: new Date("2024-12-01T09:00:00Z"),
		teamSpecificNotes: null,
		scalingGuidanceForDay: null,
		classTimes: null,
		createdAt: new Date("2024-11-01"),
		updatedAt: new Date("2024-11-01"),
		updateCounter: 0,
		trackWorkout: {
			id: "trwk_1",
			trackId: "track_1",
			workoutId: "workout_1",
			dayNumber: 1,
			weekNumber: 1,
			notes: null,
			createdAt: new Date("2024-11-01"),
			updatedAt: new Date("2024-11-01"),
			updateCounter: 0,
		},
	},
	{
		id: "scheduled_2",
		teamId: "team_123",
		trackWorkoutId: "trwk_2",
		scheduledDate: new Date("2024-12-15T18:00:00Z"),
		teamSpecificNotes: null,
		scalingGuidanceForDay: null,
		classTimes: null,
		createdAt: new Date("2024-11-01"),
		updatedAt: new Date("2024-11-01"),
		updateCounter: 0,
		trackWorkout: {
			id: "trwk_2",
			trackId: "track_2",
			workoutId: "workout_2",
			dayNumber: 2,
			weekNumber: 1,
			notes: null,
			createdAt: new Date("2024-11-01"),
			updatedAt: new Date("2024-11-01"),
			updateCounter: 0,
		},
	},
]

describe("Admin Dashboard Service", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.stubEnv("NODE_ENV", "test")
		vi.stubEnv("LOG_LEVEL", "debug")

		// Setup default mocks
		mockGetTeam.mockResolvedValue(mockTeam)
		mockGetTeamTracks.mockResolvedValue(mockTracks)
		mockGetWorkoutsForTrack.mockResolvedValue(mockTrackWorkouts)
		mockGetScheduledWorkoutsForTeam.mockResolvedValue(mockScheduledWorkouts)
	})

	afterEach(() => {
		vi.unstubAllEnvs()
	})

	describe("getAdminDashboardData", () => {
		it("should return comprehensive dashboard data", async () => {
			const result = await getAdminDashboardData("team_123")

			expect(result).toMatchObject({
				team: {
					id: "team_123",
					name: "Test Team",
					memberCount: 15,
				},
				tracks: expect.arrayContaining([
					expect.objectContaining({
						id: "track_1",
						name: "Strength Track",
						workoutCount: 3,
						completedWorkouts: 2,
						progressPercentage: 67,
					}),
				]),
				schedulingStats: expect.objectContaining({
					totalScheduledWorkouts: 2,
					upcomingWorkouts: 1,
				}),
				performanceMetrics: expect.objectContaining({
					dataFetchTime: expect.any(Number),
					cacheStatus: "miss",
					lastUpdated: expect.any(Date),
				}),
			})
		})

		it("should handle parallel data fetching efficiently", async () => {
			const startTime = Date.now()
			await getAdminDashboardData("team_123")
			const endTime = Date.now()

			// Verify all functions were called (parallel execution)
			expect(mockGetTeam).toHaveBeenCalledWith("team_123")
			expect(mockGetTeamTracks).toHaveBeenCalledWith("team_123")
			expect(mockGetScheduledWorkoutsForTeam).toHaveBeenCalledWith(
				"team_123",
				expect.any(Object),
			)

			// Should complete in reasonable time (parallel execution)
			const executionTime = endTime - startTime
			expect(executionTime).toBeLessThan(1000) // Less than 1 second
		})

		it("should calculate track progress correctly", async () => {
			const result = await getAdminDashboardData("team_123")

			const strengthTrack = result.tracks.find((t) => t.id === "track_1")
			expect(strengthTrack).toMatchObject({
				workoutCount: 3,
				completedWorkouts: 2,
				progressPercentage: 67, // 2/3 * 100, rounded
			})
		})

		it("should calculate scheduling statistics correctly", async () => {
			// Mock current date for consistent testing
			const mockDate = new Date("2024-12-10T12:00:00Z")
			vi.setSystemTime(mockDate)

			const result = await getAdminDashboardData("team_123")

			expect(result.schedulingStats).toMatchObject({
				totalScheduledWorkouts: 2,
				upcomingWorkouts: 1,
				workoutsThisWeek: expect.any(Number),
				workoutsThisMonth: expect.any(Number),
				averageWorkoutsPerWeek: expect.any(Number),
			})

			vi.useRealTimers()
		})

		it("should handle team not found error gracefully", async () => {
			mockGetTeam.mockRejectedValue(new Error("Team not found"))

			const result = await getAdminDashboardData("nonexistent_team")

			expect(result).toMatchObject({
				team: {
					id: "nonexistent_team",
					name: "Unknown Team",
					memberCount: 0,
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
				performanceMetrics: expect.objectContaining({
					dataFetchTime: expect.any(Number),
					cacheStatus: "miss",
				}),
			})
		})

		it("should return minimal data structure on error", async () => {
			mockGetTeam.mockRejectedValue(new Error("Database error"))

			const result = await getAdminDashboardData("team_123")

			expect(result).toMatchObject({
				team: {
					id: "team_123",
					name: "Unknown Team",
					memberCount: 0,
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
				performanceMetrics: expect.objectContaining({
					dataFetchTime: expect.any(Number),
					cacheStatus: "miss",
				}),
			})
		})

		it("should log performance metrics in development", async () => {
			vi.stubEnv("NODE_ENV", "development")
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			await getAdminDashboardData("team_123")

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"[AdminDashboard] Starting data aggregation for teamId: team_123",
				),
			)
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringMatching(
					/\[AdminDashboard\] Data aggregation completed for teamId: team_123 in \d+ms\. Cached: miss/,
				),
			)

			consoleSpy.mockRestore()
		})
	})

	describe("getTeamSchedulingStats", () => {
		it("should return detailed scheduling statistics", async () => {
			const result = await getTeamSchedulingStats("team_123")

			expect(result).toMatchObject({
				totalScheduledWorkouts: 2,
				upcomingWorkouts: expect.any(Number),
				workoutsThisWeek: expect.any(Number),
				workoutsThisMonth: expect.any(Number),
				averageWorkoutsPerWeek: expect.any(Number),
				completionRate: 50, // 1 completed out of 2 total
				mostActiveTrack: expect.any(String),
			})
		})

		it("should calculate completion rate correctly", async () => {
			const result = await getTeamSchedulingStats("team_123")

			expect(result.completionRate).toBe(50) // 1 completed out of 2 total
		})

		it("should identify most active track", async () => {
			const result = await getTeamSchedulingStats("team_123")

			// Should identify the track with most workouts
			expect(result.mostActiveTrack).toBeTruthy()
			expect(typeof result.mostActiveTrack).toBe("string")
		})

		it("should handle empty data gracefully", async () => {
			mockGetScheduledWorkoutsForTeam.mockResolvedValue([])
			mockGetTeamTracks.mockResolvedValue([])

			const result = await getTeamSchedulingStats("team_123")

			expect(result).toMatchObject({
				totalScheduledWorkouts: 0,
				upcomingWorkouts: 0,
				workoutsThisWeek: 0,
				workoutsThisMonth: 0,
				averageWorkoutsPerWeek: 0,
				completionRate: 0,
				mostActiveTrack: null,
			})
		})

		it("should handle errors gracefully", async () => {
			mockGetScheduledWorkoutsForTeam.mockRejectedValue(
				new Error("Database error"),
			)

			const result = await getTeamSchedulingStats("team_123")

			expect(result).toMatchObject({
				totalScheduledWorkouts: 0,
				upcomingWorkouts: 0,
				workoutsThisWeek: 0,
				workoutsThisMonth: 0,
				averageWorkoutsPerWeek: 0,
				completionRate: 0,
				mostActiveTrack: null,
			})
		})
	})

	describe("getUpcomingScheduleOverview", () => {
		it("should return schedule overview grouped by date", async () => {
			const result = await getUpcomingScheduleOverview("team_123", 14)

			expect(result).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						date: expect.any(String),
						workouts: expect.arrayContaining([
							expect.objectContaining({
								id: expect.any(String),
								name: expect.any(String),
								type: expect.any(String),
								duration: expect.any(Number),
								scheduledAt: expect.any(Date),
							}),
						]),
					}),
				]),
			)
		})

		it("should include track information in workouts", async () => {
			const result = await getUpcomingScheduleOverview("team_123", 14)

			if (result.length > 0 && result[0].workouts.length > 0) {
				const workout = result[0].workouts[0]
				expect(workout).toMatchObject({
					trackId: expect.any(String),
					trackName: expect.any(String),
				})
			}
		})

		it("should sort dates chronologically", async () => {
			// Create mock data with different dates
			const multipleScheduledWorkouts = [
				{
					id: "scheduled_3",
					teamId: "team_123",
					trackWorkoutId: "trwk_3",
					scheduledDate: new Date("2024-12-25T10:00:00Z"),
					teamSpecificNotes: null,
					scalingGuidanceForDay: null,
					classTimes: null,
					createdAt: new Date("2024-11-01"),
					updatedAt: new Date("2024-11-01"),
					updateCounter: 0,
					trackWorkout: {
						id: "trwk_3",
						trackId: "track_1",
						workoutId: "workout_3",
						dayNumber: 3,
						weekNumber: 1,
						notes: null,
						createdAt: new Date("2024-11-01"),
						updatedAt: new Date("2024-11-01"),
						updateCounter: 0,
					},
				},
				{
					id: "scheduled_4",
					teamId: "team_123",
					trackWorkoutId: "trwk_4",
					scheduledDate: new Date("2024-12-20T10:00:00Z"),
					teamSpecificNotes: null,
					scalingGuidanceForDay: null,
					classTimes: null,
					createdAt: new Date("2024-11-01"),
					updatedAt: new Date("2024-11-01"),
					updateCounter: 0,
					trackWorkout: {
						id: "trwk_4",
						trackId: "track_2",
						workoutId: "workout_4",
						dayNumber: 4,
						weekNumber: 1,
						notes: null,
						createdAt: new Date("2024-11-01"),
						updatedAt: new Date("2024-11-01"),
						updateCounter: 0,
					},
				},
			]

			mockGetScheduledWorkoutsForTeam.mockResolvedValue(
				multipleScheduledWorkouts,
			)

			const result = await getUpcomingScheduleOverview("team_123", 14)

			if (result.length >= 2) {
				const dates = result.map((r) => new Date(r.date))
				expect(dates[0].getTime()).toBeLessThanOrEqual(dates[1].getTime())
			}
		})

		it("should handle empty upcoming workouts", async () => {
			mockGetScheduledWorkoutsForTeam.mockResolvedValue([])

			const result = await getUpcomingScheduleOverview("team_123", 14)

			expect(result).toEqual([])
		})

		it("should handle errors gracefully", async () => {
			mockGetScheduledWorkoutsForTeam.mockRejectedValue(
				new Error("Database error"),
			)

			const result = await getUpcomingScheduleOverview("team_123", 14)

			expect(result).toEqual([])
		})
	})

	describe("invalidateAdminDashboardCache", () => {
		it("should invalidate all cache tags", async () => {
			const { revalidateTag } = await import("next/cache")
			const mockRevalidateTag = vi.mocked(revalidateTag)

			await invalidateAdminDashboardCache("team_123")

			expect(mockRevalidateTag).toHaveBeenCalledWith("admin-dashboard")
			expect(mockRevalidateTag).toHaveBeenCalledWith("team-stats")
			expect(mockRevalidateTag).toHaveBeenCalledWith("schedule-overview")
		})

		it("should handle cache invalidation errors", async () => {
			const { revalidateTag } = await import("next/cache")
			const mockRevalidateTag = vi.mocked(revalidateTag)
			mockRevalidateTag.mockImplementation(() => {
				throw new Error("Cache error")
			})

			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			await invalidateAdminDashboardCache("team_123")

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"[AdminDashboard] Error invalidating cache for teamId: team_123",
				),
				expect.any(Error),
			)

			consoleSpy.mockRestore()
		})
	})

	describe("getDashboardPerformanceMetrics", () => {
		it("should return performance metrics", async () => {
			const result = await getDashboardPerformanceMetrics("team_123")

			expect(result).toMatchObject({
				cacheHitRate: expect.any(Number),
				averageLoadTime: expect.any(Number),
				lastCacheRefresh: expect.any(Date),
			})

			expect(result.cacheHitRate).toBeGreaterThanOrEqual(0)
			expect(result.cacheHitRate).toBeLessThanOrEqual(1)
			expect(result.averageLoadTime).toBeGreaterThan(0)
		})
	})

	describe("Error Boundaries and Edge Cases", () => {
		it("should handle partial data failures gracefully", async () => {
			// Mock partial failure scenario where track processing fails but other data succeeds
			mockGetTeam.mockResolvedValue(mockTeam)
			mockGetTeamTracks.mockResolvedValue(mockTracks)
			mockGetWorkoutsForTrack.mockRejectedValue(
				new Error("Track workout fetch failed"),
			)
			mockGetScheduledWorkoutsForTeam.mockResolvedValue(mockScheduledWorkouts)

			const result = await getAdminDashboardData("team_123")

			// Should return fallback data structure due to error in track processing
			expect(result.team.id).toBe("team_123")
			expect(result.team.name).toBe("Unknown Team") // Error fallback
			expect(result.tracks).toEqual([])
			expect(result.schedulingStats.totalScheduledWorkouts).toBe(0)
			expect(result.schedulingStats.upcomingWorkouts).toBe(0)
			expect(result.performanceMetrics.cacheStatus).toBe("miss")
		})

		it("should handle zero division in percentage calculations", async () => {
			mockGetWorkoutsForTrack.mockResolvedValue([]) // Empty workouts

			const result = await getAdminDashboardData("team_123")

			const track = result.tracks[0]
			expect(track.progressPercentage).toBe(0)
			expect(track.workoutCount).toBe(0)
			expect(track.completedWorkouts).toBe(0)
		})

		it("should handle missing track information in workouts", async () => {
			const workoutsWithoutTracks = [
				{
					id: "scheduled_no_track",
					teamId: "team_123",
					trackWorkoutId: "trwk_unknown",
					scheduledDate: new Date("2024-12-20T10:00:00Z"),
					teamSpecificNotes: null,
					scalingGuidanceForDay: null,
					classTimes: null,
					createdAt: new Date("2024-11-01"),
					updatedAt: new Date("2024-11-01"),
					updateCounter: 0,
					trackWorkout: {
						id: "trwk_unknown",
						trackId: "track_unknown",
						workoutId: "workout_unknown",
						dayNumber: 1,
						weekNumber: 1,
						notes: null,
						createdAt: new Date("2024-11-01"),
						updatedAt: new Date("2024-11-01"),
						updateCounter: 0,
					},
				},
			]

			mockGetScheduledWorkoutsForTeam.mockResolvedValue(workoutsWithoutTracks)

			const result = await getUpcomingScheduleOverview("team_123", 14)

			if (result.length > 0 && result[0].workouts.length > 0) {
				const workout = result[0].workouts[0]
				expect(workout.trackId).toBe("track_unknown")
				expect(workout.trackName).toBe("Unknown Track") // Default fallback
			}
		})
	})
})
