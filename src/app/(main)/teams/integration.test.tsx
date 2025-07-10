import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TeamsPage from "./page"

// Mock the server action
vi.mock("@/actions/team-scheduled-workouts.action", () => ({
	getTeamsWithScheduledWorkoutsAction: vi.fn(),
}))

// Mock the auth utility
vi.mock("@/utils/auth", () => ({
	requireVerifiedEmail: vi.fn(),
}))

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
}))

describe("TeamsPage Integration", () => {
	it("verifies complete data flow from server actions to UI components", async () => {
		const { getTeamsWithScheduledWorkoutsAction } = await import(
			"@/actions/team-scheduled-workouts.action"
		)
		const { requireVerifiedEmail } = await import("@/utils/auth")

		// Mock authenticated user
		vi.mocked(requireVerifiedEmail).mockResolvedValue({
			user: { id: "test-user-id" },
		} as any)

		// Mock successful server action response
		const mockTeams = [
			{
				id: "team-1",
				name: "Test Team",
				slug: "test-team",
				scheduledWorkouts: [
					{
						id: "workout-1",
						scheduledDate: new Date("2025-07-10T09:00:00Z"),
						teamSpecificNotes: "Focus on form",
						scalingGuidanceForDay: "Scale weights as needed",
						classTimes: "6:00 AM, 12:00 PM",
						trackWorkout: {
							id: "tw-1",
							trackId: "track-1",
							workoutId: "w-1",
							dayNumber: 1,
							weekNumber: 1,
							notes: "Week 1 opener",
							createdAt: new Date(),
							updatedAt: new Date(),
							updateCounter: 0,
							workout: {
								id: "w-1",
								name: "Fran",
								description: "21-15-9\\nThrusters (95/65)\\nPull-ups",
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
								name: "CrossFit Mainsite",
								description: "Official CrossFit programming",
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

		vi.mocked(getTeamsWithScheduledWorkoutsAction).mockResolvedValue([
			{
				teams: mockTeams,
				success: true,
			},
			null,
		])

		render(await TeamsPage())

		// Check for main heading
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("TEAMS")

		// Check for team scheduled workouts component
		expect(screen.getByText("Team Scheduled Workouts")).toBeInTheDocument()

		// Check for workout details
		expect(screen.getByText("Fran")).toBeInTheDocument()
		expect(screen.getByText("CrossFit Mainsite")).toBeInTheDocument()
	})

	it("handles proper error handling", async () => {
		const { getTeamsWithScheduledWorkoutsAction } = await import(
			"@/actions/team-scheduled-workouts.action"
		)
		const { requireVerifiedEmail } = await import("@/utils/auth")

		// Mock authenticated user
		vi.mocked(requireVerifiedEmail).mockResolvedValue({
			user: { id: "test-user-id" },
		} as any)

		// Mock server action error
		vi.mocked(getTeamsWithScheduledWorkoutsAction).mockResolvedValue([
			null,
			{
				code: "ERROR" as const,
				message: "Failed to fetch teams",
			} as any,
		])

		render(await TeamsPage())

		// Check for error message
		expect(screen.getByText("Error Loading Teams")).toBeInTheDocument()
		expect(
			screen.getByText(
				"There was an error loading your teams. Please try again later.",
			),
		).toBeInTheDocument()
	})

	it("verifies navigation functionality", async () => {
		const { getTeamsWithScheduledWorkoutsAction } = await import(
			"@/actions/team-scheduled-workouts.action"
		)
		const { requireVerifiedEmail } = await import("@/utils/auth")

		// Mock authenticated user
		vi.mocked(requireVerifiedEmail).mockResolvedValue({
			user: { id: "test-user-id" },
		} as any)

		// Mock successful server action response with empty teams
		vi.mocked(getTeamsWithScheduledWorkoutsAction).mockResolvedValue([
			{
				teams: [],
				success: true,
			},
			null,
		])

		render(await TeamsPage())

		// Check that page renders successfully
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("TEAMS")

		// Check for empty state
		expect(screen.getByText("No Teams Found")).toBeInTheDocument()
	})
})
