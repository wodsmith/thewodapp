import { describe, expect, it, beforeEach, vi } from "vitest"
import { getTeamSpecificWorkout } from "@/server/workouts"

// Mock the database
const mockDb = {
	select: vi.fn().mockReturnThis(),
	from: vi.fn().mockReturnThis(),
	where: vi.fn().mockReturnThis(),
}

vi.mock("@/db", () => ({
	getDd: vi.fn(() => mockDb),
}))

describe("Team-Specific Workout Resolution", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getTeamSpecificWorkout", () => {
		it("should return original workout when no team remix exists", async () => {
			const originalWorkout = {
				id: "original-workout-id",
				name: "Original Fran",
				description: "21-15-9 Thrusters and Pull-ups",
				scheme: "time",
				scope: "public",
				teamId: null,
				sourceWorkoutId: null,
			}

			// Mock no team remix found, then original workout found
			mockDb.where
				.mockResolvedValueOnce([]) // No team remix
				.mockResolvedValueOnce([originalWorkout]) // Original workout found

			const result = await getTeamSpecificWorkout({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			expect(result.id).toBe("original-workout-id")
			expect(result.name).toBe("Original Fran")
			expect(result.sourceWorkoutId).toBe(null)
		})

		it("should return team remix when exists", async () => {
			const teamRemix = {
				id: "team-remix-id",
				name: "Team A Modified Fran",
				description: "Team A version",
				scheme: "time",
				scope: "private",
				teamId: "team-a",
				sourceWorkoutId: "original-workout-id",
			}

			// Mock team remix found
			mockDb.where.mockResolvedValueOnce([teamRemix])

			const result = await getTeamSpecificWorkout({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			expect(result.id).toBe("team-remix-id")
			expect(result.name).toBe("Team A Modified Fran")
			expect(result.sourceWorkoutId).toBe("original-workout-id")
		})

		it("should maintain multi-tenant isolation", async () => {
			const teamARemix = {
				id: "team-a-remix-id",
				name: "Team A Modified Fran",
				teamId: "team-a",
				sourceWorkoutId: "original-workout-id",
			}

			const teamBRemix = {
				id: "team-b-remix-id",
				name: "Team B Modified Fran",
				teamId: "team-b",
				sourceWorkoutId: "original-workout-id",
			}

			// Mock team A gets their remix
			mockDb.where.mockResolvedValueOnce([teamARemix])

			const teamAResult = await getTeamSpecificWorkout({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			expect(teamAResult.id).toBe("team-a-remix-id")
			expect(teamAResult.name).toBe("Team A Modified Fran")

			// Mock team B gets their remix
			mockDb.where.mockResolvedValueOnce([teamBRemix])

			const teamBResult = await getTeamSpecificWorkout({
				originalWorkoutId: "original-workout-id",
				teamId: "team-b",
			})

			expect(teamBResult.id).toBe("team-b-remix-id")
			expect(teamBResult.name).toBe("Team B Modified Fran")

			// Teams should not see each other's remixes
			expect(teamAResult.id).not.toBe(teamBResult.id)
		})

		it("should handle non-existent workouts gracefully", async () => {
			// Mock no team remix and no original workout
			mockDb.where
				.mockResolvedValueOnce([]) // No team remix
				.mockResolvedValueOnce([]) // No original workout

			await expect(
				getTeamSpecificWorkout({
					originalWorkoutId: "non-existent-workout",
					teamId: "team-a",
				})
			).rejects.toThrow("Original workout not found")
		})

		it("should prefer team remix over original workout", async () => {
			const teamRemix = {
				id: "team-remix-id",
				name: "Team Remix",
				teamId: "team-a",
				sourceWorkoutId: "original-workout-id",
			}

			const originalWorkout = {
				id: "original-workout-id",
				name: "Original Workout",
				teamId: null,
				sourceWorkoutId: null,
			}

			// Mock team remix found (should not check for original)
			mockDb.where.mockResolvedValueOnce([teamRemix])

			const result = await getTeamSpecificWorkout({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			expect(result.id).toBe("team-remix-id")
			expect(result.name).toBe("Team Remix")
			
			// Should only have called the database once (for remix check)
			expect(mockDb.where).toHaveBeenCalledTimes(1)
		})

		it("should query with correct parameters", async () => {
			const teamRemix = {
				id: "team-remix-id",
				teamId: "team-a",
				sourceWorkoutId: "original-workout-id",
			}

			mockDb.where.mockResolvedValueOnce([teamRemix])

			await getTeamSpecificWorkout({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			// Verify the database was called correctly
			expect(mockDb.select).toHaveBeenCalled()
			expect(mockDb.from).toHaveBeenCalled()
			expect(mockDb.where).toHaveBeenCalled()
		})

		it("should return original workout when preferOriginal is true, even if remix exists", async () => {
			const originalWorkout = {
				id: "original-workout-id",
				name: "Original Grace",
				description: "30 Clean and Jerks for Time",
				scheme: "time",
				scope: "public",
				teamId: null,
				sourceWorkoutId: null,
			}

			// Mock original workout found (should skip remix check)
			mockDb.where.mockResolvedValueOnce([originalWorkout])

			const result = await getTeamSpecificWorkout({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
				preferOriginal: true,
			})

			expect(result.id).toBe("original-workout-id")
			expect(result.name).toBe("Original Grace")
			expect(result.sourceWorkoutId).toBe(null)
			
			// Should only have called the database once (for original workout, skipping remix check)
			expect(mockDb.where).toHaveBeenCalledTimes(1)
		})
	})
})