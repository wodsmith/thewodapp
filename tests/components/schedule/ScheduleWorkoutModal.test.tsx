import ScheduleWorkoutModal from "@/components/schedule/ScheduleWorkoutModal"
import { render, screen } from "@testing-library/react"
import React from "react"
import { vi } from "vitest"

vi.mock("@/app/actions/schedulingActions", () => ({
	scheduleWorkoutAction: vi.fn().mockResolvedValue(undefined),
}))

describe("ScheduleWorkoutModal", () => {
	it("renders button initially", () => {
		render(<ScheduleWorkoutModal teamId="team_1" />)
		expect(
			screen.getByRole("button", { name: /schedule workout/i }),
		).toBeTruthy()
	})
})
