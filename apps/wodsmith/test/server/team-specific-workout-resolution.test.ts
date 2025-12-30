import { describe, expect, it, beforeEach, vi } from "vitest"
import { FakeDrizzleDb } from "@repo/test-utils"
import { getTeamSpecificWorkout } from "@/server/workouts"

// Mock the database with proper chainable mock
const mockDb = new FakeDrizzleDb()

vi.mock("@/db", () => ({
	getDb: vi.fn(() => mockDb),
}))

describe("Team-Specific Workout Resolution", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDb.reset()
	})

	describe("getTeamSpecificWorkout", () => {
		it("should return original workout when no team remix exists", async () => {
			const originalWorkout = {
				id: "original-workout-id",
				name: "Original Fran",
				description: "21-15-9 Thrusters and Pull-ups",
				scheme: "time" as const,
				scope: "public" as const,
				teamId: null,
				sourceWorkoutId: null,
			}

			// First query: check for team remix (returns empty)
			// Second query: fetch original workout
			const whereMock = mockDb.getChainMock().where as any
			whereMock
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
				scheme: "time" as const,
				scope: "private" as const,
				teamId: "team-a",
				sourceWorkoutId: "original-workout-id",
			}

			// First query: check for team remix (returns the remix)
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([teamRemix])

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
				description: "Team A version",
				scheme: "time" as const,
				scope: "private" as const,
				teamId: "team-a",
				sourceWorkoutId: "original-workout-id",
			}

			const teamBRemix = {
				id: "team-b-remix-id",
				name: "Team B Modified Fran",
				description: "Team B version",
				scheme: "time" as const,
				scope: "private" as const,
				teamId: "team-b",
				sourceWorkoutId: "original-workout-id",
			}

			const whereMock = mockDb.getChainMock().where as any
			
			// Mock team A gets their remix
			whereMock.mockResolvedValueOnce([teamARemix])

			const teamAResult = await getTeamSpecificWorkout({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			expect(teamAResult.id).toBe("team-a-remix-id")
			expect(teamAResult.name).toBe("Team A Modified Fran")

			// Mock team B gets their remix
			whereMock.mockResolvedValueOnce([teamBRemix])

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
			const whereMock = mockDb.getChainMock().where as any
			whereMock
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
				description: "Team version",
				scheme: "time" as const,
				scope: "private" as const,
				teamId: "team-a",
				sourceWorkoutId: "original-workout-id",
			}

			// Mock team remix found (should not check for original)
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([teamRemix])

			const result = await getTeamSpecificWorkout({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			expect(result.id).toBe("team-remix-id")
			expect(result.name).toBe("Team Remix")
			
			// Should only have called where once (for remix check)
			expect(whereMock).toHaveBeenCalledTimes(1)
		})

		it("should query with correct parameters", async () => {
			const teamRemix = {
				id: "team-remix-id",
				name: "Team Remix",
				description: "Team version",
				scheme: "time" as const,
				scope: "private" as const,
				teamId: "team-a",
				sourceWorkoutId: "original-workout-id",
			}

			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([teamRemix])

			await getTeamSpecificWorkout({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			// Verify the database was called correctly
			expect(mockDb.select).toHaveBeenCalled()
			expect(mockDb.from).toHaveBeenCalled()
			expect(whereMock).toHaveBeenCalled()
		})

		it("should return original workout when preferOriginal is true, even if remix exists", async () => {
			const originalWorkout = {
				id: "original-workout-id",
				name: "Original Grace",
				description: "30 Clean and Jerks for Time",
				scheme: "time" as const,
				scope: "public" as const,
				teamId: null,
				sourceWorkoutId: null,
			}

			// Mock original workout found (should skip remix check)
			const whereMock = mockDb.getChainMock().where as any
			whereMock.mockResolvedValueOnce([originalWorkout])

			const result = await getTeamSpecificWorkout({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
				preferOriginal: true,
			})

			expect(result.id).toBe("original-workout-id")
			expect(result.name).toBe("Original Grace")
			expect(result.sourceWorkoutId).toBe(null)
			
			// Should only have called where once (for original workout, skipping remix check)
			expect(whereMock).toHaveBeenCalledTimes(1)
		})
	})
})