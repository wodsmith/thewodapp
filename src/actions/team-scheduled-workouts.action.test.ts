import { describe, expect, it, vi } from "vitest"
import { getTeamsWithScheduledWorkoutsAction } from "./team-scheduled-workouts.action"

// Mock the server function
vi.mock("@/server/team-programming-tracks", () => ({
	getTeamsWithScheduledWorkouts: vi.fn(),
}))

// Mock the auth utility
vi.mock("@/utils/auth", () => ({
	requireVerifiedEmail: vi.fn(),
}))

describe("getTeamsWithScheduledWorkoutsAction", () => {
	it("handles authentication and validates inputs", async () => {
		const { getTeamsWithScheduledWorkouts } = await import(
			"@/server/team-programming-tracks"
		)
		const { requireVerifiedEmail } = await import("@/utils/auth")

		// Mock authenticated user
		vi.mocked(requireVerifiedEmail).mockResolvedValue({
			user: { id: "test-user-id" },
		} as any)

		// Mock server function response
		const mockTeams = [
			{
				id: "team-1",
				name: "Test Team",
				slug: "test-team",
				scheduledWorkouts: [],
			},
		]
		vi.mocked(getTeamsWithScheduledWorkouts).mockResolvedValue(mockTeams)

		const [result, error] = await getTeamsWithScheduledWorkoutsAction({})

		expect(error).toBeNull()
		expect(result).toEqual({
			teams: mockTeams,
			success: true,
		})
		expect(getTeamsWithScheduledWorkouts).toHaveBeenCalledWith("test-user-id")
	})

	it("returns properly typed data", async () => {
		const { getTeamsWithScheduledWorkouts } = await import(
			"@/server/team-programming-tracks"
		)
		const { requireVerifiedEmail } = await import("@/utils/auth")

		vi.mocked(requireVerifiedEmail).mockResolvedValue({
			user: { id: "test-user-id" },
		} as any)

		const mockTeams = [
			{
				id: "team-1",
				name: "Test Team",
				slug: "test-team",
				scheduledWorkouts: [
					{
						id: "workout-1",
						scheduledDate: new Date("2025-07-10"),
						teamSpecificNotes: "Test notes",
						scalingGuidanceForDay: "Scale as needed",
						classTimes: "6:00 AM",
						trackWorkout: {
							id: "tw-1",
							trackId: "track-1",
							workoutId: "w-1",
							dayNumber: 1,
							weekNumber: 1,
							notes: "Track notes",
							createdAt: new Date(),
							updatedAt: new Date(),
							updateCounter: 0,
							workout: {
								id: "w-1",
								name: "Test Workout",
								description: "A test workout",
								scheme: "time" as const,
								scope: "public" as const,
								createdAt: new Date(),
								updatedAt: new Date(),
								updateCounter: 0,
								teamId: "team-1",
								repsPerRound: null,
								roundsToScore: 1,
								sugarId: null,
								tiebreakScheme: null,
								secondaryScheme: null,
								sourceTrackId: null,
							},
							track: {
								id: "track-1",
								name: "Test Track",
								description: "A test track",
								type: "official_3rd_party" as const,
								ownerTeamId: null,
								isPublic: 1,
								createdAt: new Date(),
								updatedAt: new Date(),
								updateCounter: 0,
							},
						},
					},
				],
			},
		]
		vi.mocked(getTeamsWithScheduledWorkouts).mockResolvedValue(mockTeams)

		const [result, error] = await getTeamsWithScheduledWorkoutsAction({})

		expect(error).toBeNull()
		expect(result?.teams).toHaveLength(1)
		expect(result?.teams[0]).toMatchObject({
			id: "team-1",
			name: "Test Team",
			scheduledWorkouts: expect.arrayContaining([
				expect.objectContaining({
					id: "workout-1",
					trackWorkout: expect.objectContaining({
						workout: expect.objectContaining({
							name: "Test Workout",
						}),
					}),
				}),
			]),
		})
	})

	it("throws error when user is not authenticated", async () => {
		const { requireVerifiedEmail } = await import("@/utils/auth")

		vi.mocked(requireVerifiedEmail).mockResolvedValue(null)

		const [result, error] = await getTeamsWithScheduledWorkoutsAction({})

		expect(result).toBeNull()
		expect(error).toBeTruthy()
		expect(error?.message).toContain("Authentication required")
	})
})
