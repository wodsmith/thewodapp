import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CreateWorkoutClient from "./create-workout-client"

// Mock the createWorkoutAction
vi.mock("@/actions/workout-actions", () => ({
	createWorkoutAction: vi.fn(),
}))

// Mock next/navigation useRouter
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn() }),
}))

// Mock zsa-react useServerAction
vi.mock("zsa-react", () => ({
	useServerAction: (action: unknown) => ({
		execute: (...args: unknown[]) =>
			(action as (...args: unknown[]) => unknown)(...args),
	}),
}))

const mockTags = [
	{
		id: "tag1",
		name: "Tag 1",
		createdAt: new Date(),
		updatedAt: new Date(),
		updateCounter: 0,
	},
	{
		id: "tag2",
		name: "Tag 2",
		createdAt: new Date(),
		updatedAt: new Date(),
		updateCounter: 0,
	},
]
const mockMovements = [
	{
		id: "move1",
		name: "Movement 1",
		type: "weightlifting" as const,
		createdAt: new Date(),
		updatedAt: new Date(),
		updateCounter: 0,
	},
	{
		id: "move2",
		name: "Movement 2",
		type: "gymnastic" as const,
		createdAt: new Date(),
		updatedAt: new Date(),
		updateCounter: 0,
	},
]
const mockCreateWorkoutAction = vi
	.fn()
	.mockResolvedValue({ data: { id: "mock-id" } })

function setup() {
	render(
		<CreateWorkoutClient
			tags={mockTags}
			movements={mockMovements}
			userId="test-user"
			createWorkoutAction={mockCreateWorkoutAction}
		/>,
	)
}

describe("CreateWorkoutClient", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders all expected fields", () => {
		setup()
		expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
		expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
		expect(screen.getByLabelText(/tags/i)).toBeInTheDocument()
		expect(screen.getByText(/movements/i)).toBeInTheDocument()
	})

	it("handles user input and updates state", () => {
		setup()
		const nameInput = screen.getByLabelText(/name/i)
		fireEvent.change(nameInput, { target: { value: "Test Workout" } })
		expect((nameInput as HTMLInputElement).value).toBe("Test Workout")
	})

	it("handles tag and movement selection", () => {
		setup()
		// Simulate clicking tag and movement buttons
		const tagButton = screen.getByRole("button", { name: /Tag 2/i })
		expect(tagButton).toBeInTheDocument()
		fireEvent.click(tagButton)
		const movementButton = screen.getByRole("button", { name: /Movement 2/i })
		expect(movementButton).toBeInTheDocument()
		fireEvent.click(movementButton)
	})

	// Radix Select is not fully supported in jsdom; see https://github.com/radix-ui/primitives/issues/1672
	it.skip("submits form and calls createWorkoutAction", async () => {
		setup()
		const nameInput = screen.getByLabelText(/name/i)
		fireEvent.change(nameInput, { target: { value: "Test Workout" } })
		const descriptionInput = screen.getByLabelText(/description/i)
		fireEvent.change(descriptionInput, { target: { value: "A test workout" } })
		// Select a scheme using the Select component
		const schemeTrigger = screen
			.getByText("Scheme")
			.parentElement?.querySelector('[role="combobox"]')
		expect(schemeTrigger).toBeInTheDocument()
		if (schemeTrigger) {
			await userEvent.click(schemeTrigger)
			const option = await screen.findByText("For Time")
			await userEvent.click(option)
		}
		// Select a tag
		const tagButton = screen.getByText("Tag 1").closest('div[role="button"]')
		expect(tagButton).toBeInTheDocument()
		if (tagButton) fireEvent.click(tagButton)
		// Select a movement
		const movementButton = screen
			.getByText("Movement 1")
			.closest('div[role="button"]')
		expect(movementButton).toBeInTheDocument()
		if (movementButton) fireEvent.click(movementButton)
		const form = document.querySelector("form")
		expect(form).toBeInTheDocument()
		if (form) fireEvent.submit(form)
		await waitFor(() => {
			expect(mockCreateWorkoutAction).toHaveBeenCalled()
		})
	})
})
