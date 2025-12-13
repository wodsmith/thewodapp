import { describe, expect, it, beforeEach, vi } from "vitest"
import { getTeamSpecificWorkoutAction } from "@/actions/workout-actions"

// Mock the auth utility - user belongs to both teams for isolation testing
vi.mock("@/utils/auth", () => ({
	requireVerifiedEmail: vi.fn(() =>
		Promise.resolve({
			user: { id: "user-test" },
			userId: "user-test",
			teams: [{ id: "team-a" }, { id: "team-b" }]
		})
	),
}))

// Mock the server function
const mockGetTeamSpecificWorkout = vi.fn()
vi.mock("@/server/workouts", () => ({
	getTeamSpecificWorkout: (...args: any[]) => mockGetTeamSpecificWorkout(...args),
}))

describe("Team-Specific Workout Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getTeamSpecificWorkoutAction", () => {
		it("should return success with original workout when no remix exists", async () => {
			const originalWorkout = {
				id: "original-workout-id",
				name: "Original Fran",
				description: "21-15-9 Thrusters and Pull-ups",
				scheme: "time",
				scope: "public",
				teamId: null,
				sourceWorkoutId: null,
			}

			mockGetTeamSpecificWorkout.mockResolvedValueOnce(originalWorkout)

			const [result, error] = await getTeamSpecificWorkoutAction({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			expect(error).toBeNull()
			expect(result?.success).toBe(true)
			expect(result?.data?.id).toBe("original-workout-id")
			expect(result?.data?.name).toBe("Original Fran")
		})

		it("should return success with team remix when exists", async () => {
			const teamRemix = {
				id: "team-remix-id",
				name: "Team A Modified Fran",
				description: "Team A version",
				scheme: "time",
				scope: "private",
				teamId: "team-a",
				sourceWorkoutId: "original-workout-id",
			}

			mockGetTeamSpecificWorkout.mockResolvedValueOnce(teamRemix)

			const [result, error] = await getTeamSpecificWorkoutAction({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			expect(error).toBeNull()
			expect(result?.success).toBe(true)
			expect(result?.data?.id).toBe("team-remix-id")
			expect(result?.data?.name).toBe("Team A Modified Fran")
			expect(result?.data?.sourceWorkoutId).toBe("original-workout-id")
		})

		it("should handle errors gracefully", async () => {
			mockGetTeamSpecificWorkout.mockRejectedValueOnce(new Error("Database error"))

			const [result, error] = await getTeamSpecificWorkoutAction({
				originalWorkoutId: "non-existent-workout",
				teamId: "team-a",
			})

			expect(result).toBeNull()
			expect(error).not.toBeNull()
			expect(error?.code).toBe("INTERNAL_SERVER_ERROR")
		})

		it("should validate input parameters", async () => {
			// Test missing originalWorkoutId
			const [result1, error1] = await getTeamSpecificWorkoutAction({
				originalWorkoutId: "",
				teamId: "team-a",
			})

			expect(result1).toBeNull()
			expect(error1).not.toBeNull()

			// Test missing teamId  
			const [result2, error2] = await getTeamSpecificWorkoutAction({
				originalWorkoutId: "workout-id",
				teamId: "",
			})

			expect(result2).toBeNull()
			expect(error2).not.toBeNull()
		})

		it("should maintain team isolation in action calls", async () => {
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

			// Test team A gets their remix
			mockGetTeamSpecificWorkout.mockResolvedValueOnce(teamARemix)

			const [resultA, errorA] = await getTeamSpecificWorkoutAction({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			expect(errorA).toBeNull()
			expect(resultA?.data?.id).toBe("team-a-remix-id")
			expect(resultA?.data?.name).toBe("Team A Modified Fran")

			// Test team B gets their remix
			mockGetTeamSpecificWorkout.mockResolvedValueOnce(teamBRemix)

			const [resultB, errorB] = await getTeamSpecificWorkoutAction({
				originalWorkoutId: "original-workout-id",
				teamId: "team-b",
			})

			expect(errorB).toBeNull()
			expect(resultB?.data?.id).toBe("team-b-remix-id")
			expect(resultB?.data?.name).toBe("Team B Modified Fran")

			// Verify teams don't see each other's remixes
			expect(resultA?.data?.id).not.toBe(resultB?.data?.id)
		})

		it("should call server function with correct parameters", async () => {
			const mockWorkout = { id: "test-id", name: "Test" }
			mockGetTeamSpecificWorkout.mockResolvedValueOnce(mockWorkout)

			await getTeamSpecificWorkoutAction({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})

			expect(mockGetTeamSpecificWorkout).toHaveBeenCalledWith({
				originalWorkoutId: "original-workout-id",
				teamId: "team-a",
			})
		})
	})
})