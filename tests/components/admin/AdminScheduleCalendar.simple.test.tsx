import React from "react"
import "@testing-library/jest-dom"
import AdminScheduleCalendar from "@/components/admin/AdminScheduleCalendar"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// Mock the scheduling actions
vi.mock("@/app/actions/schedulingActions", () => ({
	scheduleWorkoutAction: vi.fn(),
	updateScheduledWorkoutAction: vi.fn(),
	deleteScheduledWorkoutAction: vi.fn(),
}))

describe("AdminScheduleCalendar", () => {
	it("should render basic calendar structure", () => {
		render(<AdminScheduleCalendar teamId="test-team" />)

		// Check for basic calendar elements
		expect(
			screen.getByRole("button", { name: /previous month/i }),
		).toBeInTheDocument()
		expect(
			screen.getByRole("button", { name: /next month/i }),
		).toBeInTheDocument()
	})
})
