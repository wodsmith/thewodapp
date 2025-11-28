import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SchedulingDetails } from "./scheduling-details"
import type { ProgrammingTrack, StandaloneWorkout, TrackWorkout } from "./types"

// Mock console.log for environment variable testing
const originalEnv = process.env.LOG_LEVEL
const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

describe("SchedulingDetails", () => {
	const mockTrack: ProgrammingTrack = {
		id: "track1",
		name: "Strength Training",
		description: "Upper body focus",
		type: "strength",
	}

	const mockTrackWorkout: TrackWorkout = {
		id: "tw1",
		trackOrder: 1,
		notes: "Focus on form",
		workoutId: "w1",
		workout: {
			id: "w1",
			name: "Squat Focus",
			description: "Heavy squats",
			scheme: "5x5",
		},
	}

	const mockStandaloneWorkout: StandaloneWorkout = {
		id: "sw1",
		name: "Cardio Blast",
		description: "High intensity cardio",
		scheme: "AMRAP 20",
	}

	const defaultProps = {
		selectedWorkout: null,
		selectedStandaloneWorkout: null,
		selectedTrack: null,
		classTimes: "",
		teamNotes: "",
		scalingGuidance: "",
		onClassTimesChange: vi.fn(),
		onTeamNotesChange: vi.fn(),
		onScalingGuidanceChange: vi.fn(),
		onSchedule: vi.fn(),
		onCancel: vi.fn(),
		isScheduling: false,
		isSchedulingStandalone: false,
	}

	beforeEach(() => {
		vi.clearAllMocks()
		process.env.LOG_LEVEL = originalEnv
	})

	afterEach(() => {
		process.env.LOG_LEVEL = originalEnv
	})

	it("does not render when no workout is selected", () => {
		const { container } = render(<SchedulingDetails {...defaultProps} />)
		expect(container.firstChild).toBeNull()
	})

	it("renders scheduling form when track workout is selected", () => {
		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={mockTrackWorkout}
				selectedTrack={mockTrack}
			/>,
		)

		expect(screen.getByTestId("scheduling-details")).toBeInTheDocument()
		expect(screen.getByText("Scheduling Details")).toBeInTheDocument()
		expect(screen.getByText("Selected Workout:")).toBeInTheDocument()
		expect(
			screen.getByText("Squat Focus from Strength Training (Day 1)"),
		).toBeInTheDocument()
	})

	it("renders scheduling form when standalone workout is selected", () => {
		render(
			<SchedulingDetails
				{...defaultProps}
				selectedStandaloneWorkout={mockStandaloneWorkout}
			/>,
		)

		expect(screen.getByTestId("scheduling-details")).toBeInTheDocument()
		expect(
			screen.getByText("Cardio Blast (Standalone workout)"),
		).toBeInTheDocument()
	})

	it("displays form fields with correct placeholders", () => {
		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={mockTrackWorkout}
				selectedTrack={mockTrack}
			/>,
		)

		expect(
			screen.getByPlaceholderText("e.g., 6:00 AM, 12:00 PM, 6:00 PM"),
		).toBeInTheDocument()
		expect(
			screen.getByPlaceholderText("Any team-specific notes..."),
		).toBeInTheDocument()
		expect(
			screen.getByPlaceholderText("Scaling options and modifications..."),
		).toBeInTheDocument()
	})

	it("populates form fields with provided values", () => {
		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={mockTrackWorkout}
				selectedTrack={mockTrack}
				classTimes="6:00 AM, 12:00 PM"
				teamNotes="Focus on technique"
				scalingGuidance="Scale weights as needed"
			/>,
		)

		expect(screen.getByDisplayValue("6:00 AM, 12:00 PM")).toBeInTheDocument()
		expect(screen.getByDisplayValue("Focus on technique")).toBeInTheDocument()
		expect(
			screen.getByDisplayValue("Scale weights as needed"),
		).toBeInTheDocument()
	})

	it("calls correct handlers when form fields change", () => {
		const onClassTimesChange = vi.fn()
		const onTeamNotesChange = vi.fn()
		const onScalingGuidanceChange = vi.fn()

		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={mockTrackWorkout}
				selectedTrack={mockTrack}
				onClassTimesChange={onClassTimesChange}
				onTeamNotesChange={onTeamNotesChange}
				onScalingGuidanceChange={onScalingGuidanceChange}
			/>,
		)

		fireEvent.change(screen.getByTestId("class-times-input"), {
			target: { value: "9:00 AM" },
		})
		fireEvent.change(screen.getByTestId("team-notes-input"), {
			target: { value: "New notes" },
		})
		fireEvent.change(screen.getByTestId("scaling-guidance-input"), {
			target: { value: "New scaling" },
		})

		expect(onClassTimesChange).toHaveBeenCalledWith("9:00 AM")
		expect(onTeamNotesChange).toHaveBeenCalledWith("New notes")
		expect(onScalingGuidanceChange).toHaveBeenCalledWith("New scaling")
	})

	it("calls onSchedule handler when schedule button is clicked", () => {
		const onSchedule = vi.fn()

		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={mockTrackWorkout}
				selectedTrack={mockTrack}
				onSchedule={onSchedule}
			/>,
		)

		fireEvent.click(screen.getByTestId("schedule-button"))
		expect(onSchedule).toHaveBeenCalledTimes(1)
	})

	it("calls onCancel handler when cancel button is clicked", () => {
		const onCancel = vi.fn()

		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={mockTrackWorkout}
				selectedTrack={mockTrack}
				onCancel={onCancel}
			/>,
		)

		fireEvent.click(screen.getByTestId("cancel-button"))
		expect(onCancel).toHaveBeenCalledTimes(1)
	})

	it("disables schedule button when no workout is selected", () => {
		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={null}
				selectedStandaloneWorkout={null}
			/>,
		)

		// Component should not render at all when no workout is selected
		expect(screen.queryByTestId("schedule-button")).not.toBeInTheDocument()
	})

	it("disables schedule button during scheduling operations", () => {
		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={mockTrackWorkout}
				selectedTrack={mockTrack}
				isScheduling={true}
			/>,
		)

		const scheduleButton = screen.getByTestId("schedule-button")
		expect(scheduleButton).toBeDisabled()
		expect(scheduleButton).toHaveTextContent("Scheduling...")
	})

	it("disables schedule button during standalone scheduling operations", () => {
		render(
			<SchedulingDetails
				{...defaultProps}
				selectedStandaloneWorkout={mockStandaloneWorkout}
				isSchedulingStandalone={true}
			/>,
		)

		const scheduleButton = screen.getByTestId("schedule-button")
		expect(scheduleButton).toBeDisabled()
		expect(scheduleButton).toHaveTextContent("Scheduling...")
	})

	it("logs debug information when LOG_LEVEL is debug", () => {
		process.env.LOG_LEVEL = "debug"

		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={mockTrackWorkout}
				selectedTrack={mockTrack}
				classTimes="6:00 AM"
				teamNotes="Test notes"
				scalingGuidance="Test scaling"
			/>,
		)

		fireEvent.click(screen.getByTestId("schedule-button"))

		expect(consoleSpy).toHaveBeenCalledWith(
			"DEBUG: [SchedulingDetails] Form submitted with classTimes: '6:00 AM', teamNotes length: 10, scalingGuidance length: 12",
		)
	})

	it("does not log debug information when LOG_LEVEL is not debug", () => {
		process.env.LOG_LEVEL = "info"

		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={mockTrackWorkout}
				selectedTrack={mockTrack}
			/>,
		)

		fireEvent.click(screen.getByTestId("schedule-button"))

		expect(consoleSpy).not.toHaveBeenCalled()
	})

	it("renders correct workout info without week number", () => {
		const workoutWithoutWeek = {
			...mockTrackWorkout,
			weekNumber: null,
		}

		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={workoutWithoutWeek}
				selectedTrack={mockTrack}
			/>,
		)

		expect(
			screen.getByText("Squat Focus from Strength Training (Day 1)"),
		).toBeInTheDocument()
	})

	it("renders correct workout info without day number", () => {
		const workoutWithoutDay = {
			...mockTrackWorkout,
			trackOrder: 0,
		}

		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={workoutWithoutDay}
				selectedTrack={mockTrack}
			/>,
		)

		expect(
			screen.getByText("Squat Focus from Strength Training"),
		).toBeInTheDocument()
	})

	it("renders default workout name when workout details are missing", () => {
		const workoutWithoutDetails = {
			...mockTrackWorkout,
			workout: undefined,
		}

		render(
			<SchedulingDetails
				{...defaultProps}
				selectedWorkout={workoutWithoutDetails}
				selectedTrack={mockTrack}
			/>,
		)

		expect(
			screen.getByText("from Strength Training (Day 1)"),
		).toBeInTheDocument()
	})
})
