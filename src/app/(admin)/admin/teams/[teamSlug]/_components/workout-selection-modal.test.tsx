import { render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"
import { WorkoutSelectionModal } from "./workout-selection-modal"

// Mock all the server actions to return proper async results
vi.mock("../_actions/scheduling-actions", () => ({
	deleteScheduledWorkoutAction: vi.fn().mockResolvedValue([{ success: true }]),
	getScheduledWorkoutsAction: vi
		.fn()
		.mockResolvedValue([{ success: true, data: [] }]),
	scheduleStandaloneWorkoutAction: vi
		.fn()
		.mockResolvedValue([{ success: true }]),
	scheduleWorkoutAction: vi.fn().mockResolvedValue([{ success: true }]),
	updateScheduledWorkoutAction: vi.fn().mockResolvedValue([{ success: true }]),
}))

vi.mock("../_actions/programming-actions", () => ({
	getTeamTracksAction: vi.fn().mockResolvedValue([{ success: true, data: [] }]),
	getWorkoutsForTrackAction: vi
		.fn()
		.mockResolvedValue([{ success: true, data: [] }]),
	getWorkoutsNotInTracksAction: vi
		.fn()
		.mockResolvedValue([{ success: true, data: [] }]),
}))

vi.mock("zsa-react", () => ({
	useServerAction: vi.fn(() => ({
		execute: vi.fn(),
		isPending: false,
	})),
}))

describe("WorkoutSelectionModal (Refactored)", () => {
	const defaultProps = {
		isOpen: true,
		onClose: vi.fn(),
		selectedDate: new Date("2025-06-16"),
		teamId: "team1",
		onWorkoutScheduled: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the modal when open", () => {
		render(<WorkoutSelectionModal {...defaultProps} />)

		expect(screen.getByText("Schedule Workout")).toBeInTheDocument()
		expect(screen.getByText("Select Programming Track")).toBeInTheDocument()
		expect(screen.getByText("Select Workout")).toBeInTheDocument()
	})

	it("does not render when closed", () => {
		render(<WorkoutSelectionModal {...defaultProps} isOpen={false} />)

		expect(screen.queryByText("Schedule Workout")).not.toBeInTheDocument()
	})

	it("displays selected date in header", () => {
		render(<WorkoutSelectionModal {...defaultProps} />)

		// The date format shown is "Sun Jun 15 2025" (formatted by the modal)
		expect(screen.getByText(/Sun Jun 15 2025/)).toBeInTheDocument()
	})

	it("renders all component sections", () => {
		render(<WorkoutSelectionModal {...defaultProps} />)

		// Should render track selection
		expect(screen.getByText("Select Programming Track")).toBeInTheDocument()

		// Should render workout selection
		expect(screen.getByText("Select Workout")).toBeInTheDocument()

		// Should show message to select track first
		expect(
			screen.getByText("Select a track to view workouts"),
		).toBeInTheDocument()
	})

	it("integrates all extracted components correctly", () => {
		render(<WorkoutSelectionModal {...defaultProps} />)

		// Verify the modal structure includes all four main sections:
		// 1. ScheduledWorkouts section would appear above the main layout
		// 2. TrackSelection component
		expect(screen.getByText("Select Programming Track")).toBeInTheDocument()
		const trackCard = screen.getByTestId("track-card")
		expect(trackCard).toBeInTheDocument()

		// 3. WorkoutSelection component
		expect(screen.getByText("Select Workout")).toBeInTheDocument()
		expect(
			screen.getByText("Select a track to view workouts"),
		).toBeInTheDocument()

		// 4. SchedulingDetails section would render when workout is selected
		// The drawer structure is preserved
		expect(screen.getByRole("dialog")).toBeInTheDocument()
	})
})
