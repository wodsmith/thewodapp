import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import EditWorkoutClient from "./edit-workout-client"

// Mock the updateWorkoutAction
vi.mock("../../../../../actions/workout-actions", () => ({
	updateWorkoutAction: vi.fn(),
}))

// Mock next/navigation useRouter
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn() }),
}))

const mockTags = [
	{
		id: "tag1",
		name: "Tag 1",
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		updateCounter: 0,
	},
	{
		id: "tag2",
		name: "Tag 2",
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		updateCounter: 0,
	},
]
const mockMovements = [
	{
		id: "move1",
		name: "Movement 1",
		type: "weightlifting" as const,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		updateCounter: 0,
	},
	{
		id: "move2",
		name: "Movement 2",
		type: "gymnastic" as const,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		updateCounter: 0,
	},
]
const mockWorkout = {
	id: "1",
	name: "Workout 1",
	description: "desc",
	tags: mockTags.filter((t): t is NonNullable<typeof t> => t !== undefined),
	movements: mockMovements.filter(
		(m): m is NonNullable<typeof m> => m !== undefined,
	),
	scheme: "time" as const,
	scoreType: null,
	scope: "private" as const,
	repsPerRound: 10,
	roundsToScore: 1,
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
	updateCounter: 0,
	teamId: "team1",
	sugarId: "sugar1",
	tiebreakScheme: null,
	secondaryScheme: null,
	sourceTrackId: null,
	sourceWorkoutId: null,
	scalingGroupId: null,
	timeCap: null,
}
const mockUpdateWorkoutAction = vi.fn()

function setup() {
	render(
		<EditWorkoutClient
			workout={mockWorkout}
			tags={mockTags}
			movements={mockMovements}
			workoutId={mockWorkout.id}
			updateWorkoutAction={mockUpdateWorkoutAction}
		/>,
	)
}

describe("EditWorkoutClient", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders form pre-populated with workout data", () => {
		setup()
		expect(screen.getByDisplayValue(mockWorkout.name)).toBeInTheDocument()
		expect(
			screen.getByDisplayValue(mockWorkout.description),
		).toBeInTheDocument()
	})

	it("allows modifying form fields and updates state", () => {
		setup()
		const nameInput = screen.getByLabelText(/name/i)
		fireEvent.change(nameInput, { target: { value: "Updated Name" } })
		expect((nameInput as HTMLInputElement).value).toBe("Updated Name")
	})

	it("handles tag and movement selection and deselection", () => {
		setup()
		// Simulate clicking tag and movement buttons
		const tagButton = screen.getByText("Tag 2").closest("button")
		expect(tagButton).toBeInTheDocument()
		if (tagButton) fireEvent.click(tagButton)
		const movementButton = screen.getByText("Movement 2").closest("button")
		expect(movementButton).toBeInTheDocument()
		if (movementButton) fireEvent.click(movementButton)
	})

	it("submits form and calls updateWorkoutAction", async () => {
		setup()
		const nameInput = screen.getByLabelText(/name/i)
		fireEvent.change(nameInput, { target: { value: "Updated Name" } })
		const form = document.querySelector("form")
		expect(form).toBeInTheDocument()
		if (form) fireEvent.submit(form)
		await vi.waitFor(() => expect(mockUpdateWorkoutAction).toHaveBeenCalled())
	})
})
