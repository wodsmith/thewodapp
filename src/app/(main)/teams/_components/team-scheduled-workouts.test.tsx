import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { TeamScheduledWorkouts } from "./team-scheduled-workouts"
import type { TeamWithScheduledWorkouts } from "@/server/team-programming-tracks"

const mockTeams: TeamWithScheduledWorkouts[] = [
	{
		id: "team-1",
		name: "Team Alpha",
		slug: "team-alpha",
		scheduledWorkouts: [
			{
				id: "workout-1",
				scheduledDate: new Date("2025-07-10T09:00:00Z"),
				teamSpecificNotes: "Focus on form",
				scalingGuidanceForDay: "Scale weights as needed",
				classTimes: "6:00 AM, 12:00 PM, 6:00 PM",
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
						scheme: "time",
						scope: "public",
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
						type: "official_3rd_party",
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
	{
		id: "team-2",
		name: "Team Beta",
		slug: "team-beta",
		scheduledWorkouts: [],
	},
]

describe("TeamScheduledWorkouts", () => {
	it("renders scheduled workouts correctly", () => {
		render(<TeamScheduledWorkouts teams={mockTeams} />)

		// Check for main heading
		expect(screen.getByText("Team Scheduled Workouts")).toBeInTheDocument()

		// Check for team selection dropdown
		expect(screen.getByRole("combobox")).toBeInTheDocument()

		// Check for workout card
		expect(screen.getByText("Fran")).toBeInTheDocument()
		expect(screen.getByText("CrossFit Mainsite")).toBeInTheDocument()
		expect(screen.getByText("Day 1 • Week 1")).toBeInTheDocument()
	})

	it("handles team selection", async () => {
		const user = userEvent.setup()
		render(<TeamScheduledWorkouts teams={mockTeams} />)

		// Open dropdown
		await user.click(screen.getByRole("combobox"))

		// Select Team Beta
		await user.click(screen.getByText("Team Beta"))

		// Should show no workouts message
		expect(screen.getByText("No Scheduled Workouts")).toBeInTheDocument()
		expect(
			screen.getByText(
				"Team Beta doesn't have any scheduled workouts at this time.",
			),
		).toBeInTheDocument()
	})

	it("displays proper workout information", () => {
		render(<TeamScheduledWorkouts teams={mockTeams} />)

		// Check workout details
		expect(
			screen.getByText("21-15-9\\nThrusters (95/65)\\nPull-ups"),
		).toBeInTheDocument()
		expect(screen.getByText("Focus on form")).toBeInTheDocument()
		expect(screen.getByText("Scale weights as needed")).toBeInTheDocument()
		expect(screen.getByText("6:00 AM, 12:00 PM, 6:00 PM")).toBeInTheDocument()
		expect(screen.getByText("Week 1 opener")).toBeInTheDocument()
	})

	it("shows loading state", () => {
		render(<TeamScheduledWorkouts teams={[]} isLoading={true} />)

		// Check for loading skeletons
		expect(screen.getAllByRole("generic")).toHaveLength(expect.any(Number))
	})

	it("shows empty state when no teams", () => {
		render(<TeamScheduledWorkouts teams={[]} />)

		expect(screen.getByText("No Teams Found")).toBeInTheDocument()
		expect(
			screen.getByText(
				"You don't have access to any teams with scheduled workouts.",
			),
		).toBeInTheDocument()
	})
})
