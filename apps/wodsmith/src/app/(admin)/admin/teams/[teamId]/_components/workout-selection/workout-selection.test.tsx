import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	type ProgrammingTrack,
	STANDALONE_TRACK_ID,
	type StandaloneWorkout,
	type TrackWorkout,
} from "./types"
import { WorkoutSelection } from "./workout-selection"

describe("WorkoutSelection", () => {
	const mockTrackWorkouts: TrackWorkout[] = [
		{
			id: "tw1",
			dayNumber: 1,
			weekNumber: 1,
			notes: "Focus on form",
			workoutId: "w1",
			workout: {
				id: "w1",
				name: "Strength Training",
				description: "Upper body strength",
				scheme: "5x5",
			},
		},
		{
			id: "tw2",
			dayNumber: 2,
			weekNumber: 1,
			notes: null,
			workoutId: "w2",
			workout: {
				id: "w2",
				name: "Cardio Blast",
				description: "High intensity cardio",
				scheme: "AMRAP 20",
			},
		},
	]

	const mockStandaloneWorkouts: StandaloneWorkout[] = [
		{
			id: "sw1",
			name: "Standalone Workout 1",
			description: "A standalone workout",
			scheme: "For Time",
		},
		{
			id: "sw2",
			name: "Standalone Workout 2",
			description: "Another standalone workout",
			scheme: "EMOM 15",
		},
	]

	const mockRegularTrack: ProgrammingTrack = {
		id: "track1",
		name: "Regular Track",
		description: "A regular programming track",
		type: "team_owned",
	}

	const mockStandaloneTrack: ProgrammingTrack = {
		id: STANDALONE_TRACK_ID,
		name: "All Available Workouts",
		description: "Workouts not assigned to any programming track",
		type: "standalone",
	}

	const defaultProps = {
		selectedTrack: null,
		trackWorkouts: mockTrackWorkouts,
		standaloneWorkouts: mockStandaloneWorkouts,
		selectedWorkout: null,
		selectedStandaloneWorkout: null,
		onWorkoutSelect: vi.fn(),
		onStandaloneWorkoutSelect: vi.fn(),
		isLoadingWorkouts: false,
		isLoadingStandaloneWorkouts: false,
	}

	it("renders track workouts when regular track is selected", () => {
		render(
			<WorkoutSelection {...defaultProps} selectedTrack={mockRegularTrack} />,
		)

		expect(screen.getByText("Select Workout")).toBeInTheDocument()
		expect(screen.getByText("Day 1 - Week 1")).toBeInTheDocument()
		expect(screen.getByText("Day 2 - Week 1")).toBeInTheDocument()
		expect(screen.getByText("Strength Training (5x5)")).toBeInTheDocument()
	})

	it("renders standalone workouts when standalone track is selected", () => {
		render(
			<WorkoutSelection
				{...defaultProps}
				selectedTrack={mockStandaloneTrack}
			/>,
		)

		expect(screen.getByText("Select Workout")).toBeInTheDocument()
		expect(screen.getByText("Standalone Workout 1")).toBeInTheDocument()
		expect(screen.getByText("Standalone Workout 2")).toBeInTheDocument()
		expect(screen.getByText("For Time")).toBeInTheDocument()
	})

	it("shows select track message when no track is selected", () => {
		render(<WorkoutSelection {...defaultProps} />)

		expect(
			screen.getByText("Select a track to view workouts"),
		).toBeInTheDocument()
	})

	it("workout selection callback triggers with correct workout object", () => {
		const onWorkoutSelect = vi.fn()
		render(
			<WorkoutSelection
				{...defaultProps}
				selectedTrack={mockRegularTrack}
				onWorkoutSelect={onWorkoutSelect}
			/>,
		)

		fireEvent.click(screen.getByText("Day 1 - Week 1"))

		expect(onWorkoutSelect).toHaveBeenCalledWith(mockTrackWorkouts[0])
	})

	it("standalone workout selection callback triggers with correct workout object", () => {
		const onStandaloneWorkoutSelect = vi.fn()
		render(
			<WorkoutSelection
				{...defaultProps}
				selectedTrack={mockStandaloneTrack}
				onStandaloneWorkoutSelect={onStandaloneWorkoutSelect}
			/>,
		)

		fireEvent.click(screen.getByText("Standalone Workout 1"))

		expect(onStandaloneWorkoutSelect).toHaveBeenCalledWith(
			mockStandaloneWorkouts[0],
		)
	})

	it("displays loading state for track workouts", () => {
		render(
			<WorkoutSelection
				{...defaultProps}
				selectedTrack={mockRegularTrack}
				isLoadingWorkouts={true}
			/>,
		)

		expect(screen.getByText("Loading workouts...")).toBeInTheDocument()
		expect(screen.queryByText("Day 1 - Week 1")).not.toBeInTheDocument()
	})

	it("displays loading state for standalone workouts", () => {
		render(
			<WorkoutSelection
				{...defaultProps}
				selectedTrack={mockStandaloneTrack}
				isLoadingStandaloneWorkouts={true}
			/>,
		)

		expect(screen.getByText("Loading workouts...")).toBeInTheDocument()
		expect(screen.queryByText("Standalone Workout 1")).not.toBeInTheDocument()
	})

	it("shows empty state message when no standalone workouts available", () => {
		render(
			<WorkoutSelection
				{...defaultProps}
				selectedTrack={mockStandaloneTrack}
				standaloneWorkouts={[]}
			/>,
		)

		expect(
			screen.getByText(
				"No standalone workouts available. All workouts are assigned to programming tracks.",
			),
		).toBeInTheDocument()
	})

	it("highlights selected track workout correctly", () => {
		render(
			<WorkoutSelection
				{...defaultProps}
				selectedTrack={mockRegularTrack}
				selectedWorkout={mockTrackWorkouts[0] ?? null}
			/>,
		)

		const selectedCard = screen
			.getByText("Day 1 - Week 1")
			.closest("[data-testid='workout-card']")
		expect(selectedCard).toHaveClass("border-primary", "bg-primary/10")
	})

	it("highlights selected standalone workout correctly", () => {
		render(
			<WorkoutSelection
				{...defaultProps}
				selectedTrack={mockStandaloneTrack}
				selectedStandaloneWorkout={mockStandaloneWorkouts[0] ?? null}
			/>,
		)

		const selectedCard = screen
			.getByText("Standalone Workout 1")
			.closest("[data-testid='workout-card']")
		expect(selectedCard).toHaveClass("border-primary", "bg-primary/10")
	})
})
