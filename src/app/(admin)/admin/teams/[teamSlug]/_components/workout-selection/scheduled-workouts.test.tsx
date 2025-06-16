import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"
import { ScheduledWorkouts } from "./scheduled-workouts"
import type { ScheduledWorkoutWithDetails } from "./types"

// Mock window.confirm
global.confirm = vi.fn()

describe("ScheduledWorkouts", () => {
	const mockScheduledWorkouts: ScheduledWorkoutWithDetails[] = [
		{
			id: "sw1",
			teamId: "team1",
			trackWorkoutId: "tw1",
			scheduledDate: new Date("2025-06-16"),
			teamSpecificNotes: "Focus on form",
			scalingGuidanceForDay: "Scale weights as needed",
			classTimes: "6:00 AM, 12:00 PM",
			createdAt: new Date(),
			updatedAt: new Date(),
			trackWorkout: {
				id: "tw1",
				dayNumber: 1,
				weekNumber: 1,
				notes: "Track notes",
				workoutId: "w1",
				workout: {
					id: "w1",
					name: "Strength Training",
					description: "Upper body strength",
					scheme: "5x5",
				},
			},
		},
		{
			id: "sw2",
			teamId: "team1",
			trackWorkoutId: "tw2",
			scheduledDate: new Date("2025-06-16"),
			teamSpecificNotes: null,
			scalingGuidanceForDay: null,
			classTimes: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			trackWorkout: {
				id: "tw2",
				dayNumber: 2,
				weekNumber: null,
				notes: null,
				workoutId: "w2",
				workout: {
					id: "w2",
					name: "Cardio Blast",
					description: "High intensity cardio",
					scheme: "AMRAP 20",
				},
			},
		},
	]

	const defaultProps = {
		scheduledWorkouts: mockScheduledWorkouts,
		selectedDate: new Date("2025-06-16"),
		editingScheduled: null,
		onEdit: vi.fn(),
		onUpdate: vi.fn(),
		onDelete: vi.fn(),
		isUpdating: false,
		isDeleting: false,
		isLoading: false,
		classTimes: "",
		teamNotes: "",
		scalingGuidance: "",
		onClassTimesChange: vi.fn(),
		onTeamNotesChange: vi.fn(),
		onScalingGuidanceChange: vi.fn(),
		onCancelEdit: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders scheduled workouts with correct details", () => {
		render(<ScheduledWorkouts {...defaultProps} />)

		expect(
			screen.getByText("Scheduled Workouts for Sun Jun 15 2025"),
		).toBeInTheDocument()
		expect(screen.getByText("Strength Training")).toBeInTheDocument()
		expect(screen.getByText("Day 1 - Week 1")).toBeInTheDocument()
		expect(screen.getByText("Notes:")).toBeInTheDocument()
		expect(screen.getByText("Focus on form")).toBeInTheDocument()
		expect(screen.getByText("Scaling:")).toBeInTheDocument()
		expect(screen.getByText("Scale weights as needed")).toBeInTheDocument()
		expect(screen.getByText("Class Times:")).toBeInTheDocument()
		expect(screen.getByText("6:00 AM, 12:00 PM")).toBeInTheDocument()
	})

	it("renders workout without optional fields", () => {
		render(<ScheduledWorkouts {...defaultProps} />)

		expect(screen.getByText("Cardio Blast")).toBeInTheDocument()
		expect(screen.getByText("Day 2")).toBeInTheDocument()
		// Should not show empty fields for second workout which has null values
		expect(screen.queryByText("Notes:")).toBeInTheDocument() // First workout has notes
		expect(screen.getAllByTestId("scheduled-workout-card")).toHaveLength(2)
	})

	it("does not render when no scheduled workouts", () => {
		const { container } = render(
			<ScheduledWorkouts {...defaultProps} scheduledWorkouts={[]} />,
		)
		expect(container.firstChild).toBeNull()
	})

	it("edit mode toggles properly", () => {
		const onEdit = vi.fn()
		render(<ScheduledWorkouts {...defaultProps} onEdit={onEdit} />)

		const editButtons = screen.getAllByText("Edit")
		fireEvent.click(editButtons[0])

		expect(onEdit).toHaveBeenCalledWith(mockScheduledWorkouts[0])
	})

	it("form fields populate correctly when editing", () => {
		render(
			<ScheduledWorkouts
				{...defaultProps}
				editingScheduled="sw1"
				classTimes="6:00 AM"
				teamNotes="Test notes"
				scalingGuidance="Test scaling"
			/>,
		)

		expect(screen.getByTestId("edit-form")).toBeInTheDocument()
		expect(screen.getByDisplayValue("6:00 AM")).toBeInTheDocument()
		expect(screen.getByDisplayValue("Test notes")).toBeInTheDocument()
		expect(screen.getByDisplayValue("Test scaling")).toBeInTheDocument()
	})

	it("form field changes trigger callbacks", () => {
		const onClassTimesChange = vi.fn()
		const onTeamNotesChange = vi.fn()
		const onScalingGuidanceChange = vi.fn()

		render(
			<ScheduledWorkouts
				{...defaultProps}
				editingScheduled="sw1"
				onClassTimesChange={onClassTimesChange}
				onTeamNotesChange={onTeamNotesChange}
				onScalingGuidanceChange={onScalingGuidanceChange}
			/>,
		)

		const classTimesInput = screen.getByPlaceholderText(
			"e.g., 6:00 AM, 12:00 PM, 6:00 PM",
		)
		const teamNotesInput = screen.getByPlaceholderText(
			"Any team-specific notes...",
		)
		const scalingInput = screen.getByPlaceholderText(
			"Scaling options and modifications...",
		)

		fireEvent.change(classTimesInput, { target: { value: "9:00 AM" } })
		fireEvent.change(teamNotesInput, { target: { value: "New notes" } })
		fireEvent.change(scalingInput, { target: { value: "New scaling" } })

		expect(onClassTimesChange).toHaveBeenCalledWith("9:00 AM")
		expect(onTeamNotesChange).toHaveBeenCalledWith("New notes")
		expect(onScalingGuidanceChange).toHaveBeenCalledWith("New scaling")
	})

	it("update operation calls correct handler", () => {
		const onUpdate = vi.fn()
		render(
			<ScheduledWorkouts
				{...defaultProps}
				editingScheduled="sw1"
				onUpdate={onUpdate}
			/>,
		)

		const updateButton = screen.getByText("Update")
		fireEvent.click(updateButton)

		expect(onUpdate).toHaveBeenCalledWith("sw1")
	})

	it("delete operation calls correct handler with confirmation", () => {
		const onDelete = vi.fn()
		vi.mocked(global.confirm).mockReturnValue(true)

		render(<ScheduledWorkouts {...defaultProps} onDelete={onDelete} />)

		const deleteButtons = screen.getAllByText("Remove")
		fireEvent.click(deleteButtons[0])

		expect(global.confirm).toHaveBeenCalledWith(
			"Are you sure you want to remove this scheduled workout?",
		)
		expect(onDelete).toHaveBeenCalledWith("sw1")
	})

	it("delete operation cancels when not confirmed", () => {
		const onDelete = vi.fn()
		vi.mocked(global.confirm).mockReturnValue(false)

		render(<ScheduledWorkouts {...defaultProps} onDelete={onDelete} />)

		const deleteButtons = screen.getAllByText("Remove")
		fireEvent.click(deleteButtons[0])

		expect(global.confirm).toHaveBeenCalled()
		expect(onDelete).not.toHaveBeenCalled()
	})

	it("loading state displays properly", () => {
		render(<ScheduledWorkouts {...defaultProps} isLoading={true} />)

		expect(
			screen.getByText("Loading scheduled workouts..."),
		).toBeInTheDocument()
		expect(screen.queryByText("Strength Training")).not.toBeInTheDocument()
	})

	it("buttons disable during operations", () => {
		render(
			<ScheduledWorkouts
				{...defaultProps}
				isUpdating={true}
				isDeleting={true}
			/>,
		)

		const editButtons = screen.getAllByText("Edit")
		const deleteButtons = screen.getAllByText("Remove")

		for (const button of editButtons) {
			expect(button).toBeDisabled()
		}
		for (const button of deleteButtons) {
			expect(button).toBeDisabled()
		}
	})

	it("cancel edit calls correct handler", () => {
		const onCancelEdit = vi.fn()
		render(
			<ScheduledWorkouts
				{...defaultProps}
				editingScheduled="sw1"
				onCancelEdit={onCancelEdit}
			/>,
		)

		const cancelButton = screen.getByText("Cancel")
		fireEvent.click(cancelButton)

		expect(onCancelEdit).toHaveBeenCalled()
	})
})
