import TeamScheduleCalendar from "@/components/schedule/TeamScheduleCalendar"
import { render, screen } from "@testing-library/react"
import React from "react"

describe("TeamScheduleCalendar", () => {
	it("shows placeholder when no workouts", () => {
		render(<TeamScheduleCalendar teamId="team_1" />)
		expect(screen.getByText(/No workouts scheduled/i)).toBeTruthy()
	})
})
