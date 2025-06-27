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
	{ id: "tag1", name: "Tag 1" },
	{ id: "tag2", name: "Tag 2" },
]
const mockMovements = [
	{ id: "move1", name: "Movement 1", type: "weightlifting" },
	{ id: "move2", name: "Movement 2", type: "gymnastic" },
]
const mockWorkout = {
	id: "1",
	name: "Workout 1",
	description: "desc",
	tags: [mockTags[0]],
	movements: [mockMovements[0]],
	scheme: "time",
	scope: "private",
	repsPerRound: 10,
	roundsToScore: 1,
}
const mockUpdateWorkoutAction = vi.fn()

function setup() {
	render(
		<EditWorkoutClient
			workout={mockWorkout}
			tags={mockTags}
			movements={mockMovements}
			workoutId={mockWorkout.id}
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
