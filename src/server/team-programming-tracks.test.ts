import { describe, expect, it, vi } from "vitest"
import { getTeamsWithScheduledWorkouts } from "./team-programming-tracks"

// Mock the database and auth utilities
vi.mock("@/db", () => ({
	getDB: vi.fn(),
}))

vi.mock("@/utils/team-auth", () => ({
	getUserTeams: vi.fn(),
}))

describe("getTeamsWithScheduledWorkouts", () => {
	it("verifies correct data fetching for user teams", async () => {
		const { getDB } = await import("@/db")
		const { getUserTeams } = await import("@/utils/team-auth")

		// Mock user teams
		vi.mocked(getUserTeams).mockResolvedValue([
			{ id: "team-1", name: "Team 1", slug: "team-1" },
			{ id: "team-2", name: "Team 2", slug: "team-2" },
		] as any)

		// Mock database query
		const mockSelect = vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					innerJoin: vi.fn().mockReturnValue({
						innerJoin: vi.fn().mockReturnValue({
							innerJoin: vi.fn().mockReturnValue({
								where: vi.fn().mockResolvedValue([
									{
										instanceId: "instance-1",
										scheduledDate: new Date("2025-07-10"),
										teamSpecificNotes: "Test notes",
										scalingGuidanceForDay: "Scale as needed",
										classTimes: "6:00 AM, 12:00 PM",
										teamId: "team-1",
										teamName: "Team 1",
										teamSlug: "team-1",
										trackWorkoutId: "tw-1",
										dayNumber: 1,
										weekNumber: 1,
										trackWorkoutNotes: "Track notes",
										workoutId: "workout-1",
										workoutName: "Test Workout",
										workoutDescription: "A test workout",
										workoutScheme: "AMRAP",
										workoutTimeCap: 20,
										workoutScope: "public",
										trackId: "track-1",
										trackName: "Test Track",
										trackDescription: "A test track",
										trackType: "official_3rd_party",
									},
								]),
							}),
						}),
					}),
				}),
			}),
		})

		vi.mocked(getDB).mockReturnValue({
			select: mockSelect,
		} as any)

		const result = await getTeamsWithScheduledWorkouts("user-1")

		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			id: "team-1",
			name: "Team 1",
			slug: "team-1",
			scheduledWorkouts: expect.arrayContaining([
				expect.objectContaining({
					id: "instance-1",
					scheduledDate: expect.any(Date),
					teamSpecificNotes: "Test notes",
					trackWorkout: expect.objectContaining({
						workout: expect.objectContaining({
							name: "Test Workout",
						}),
						track: expect.objectContaining({
							name: "Test Track",
						}),
					}),
				}),
			]),
		})
	})

	it("returns empty array when user has no teams", async () => {
		const { getUserTeams } = await import("@/utils/team-auth")

		vi.mocked(getUserTeams).mockResolvedValue([])

		const result = await getTeamsWithScheduledWorkouts("user-1")

		expect(result).toEqual([])
	})

	it("enforces authentication", async () => {
		const { getUserTeams } = await import("@/utils/team-auth")

		// Mock getUserTeams to throw authentication error
		vi.mocked(getUserTeams).mockRejectedValue(new Error("Not authenticated"))

		await expect(getTeamsWithScheduledWorkouts("user-1")).rejects.toThrow(
			"Not authenticated",
		)
	})
})
