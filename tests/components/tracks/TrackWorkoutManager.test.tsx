import { TrackWorkoutManager } from "@/components/tracks/TrackWorkoutManager"
import { render, screen } from "@testing-library/react"
import React from "react"

describe("TrackWorkoutManager", () => {
	it("shows placeholder text when no workouts", () => {
		render(<TrackWorkoutManager trackId="track_1" />)
		expect(screen.getByText(/No workouts yet/i)).toBeTruthy()
	})
})
