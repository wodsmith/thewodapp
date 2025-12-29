import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { OrganizerCompetitionForm } from "@/app/(compete)/compete/organizer/(dashboard)/new/_components/organizer-competition-form"

// Mock ResizeObserver for Radix UI components
beforeAll(() => {
	global.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
})

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		refresh: mockRefresh,
	}),
}))

// Mock posthog
vi.mock("posthog-js", () => ({
	default: {
		capture: vi.fn(),
	},
}))

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

// Mock useServerAction
const mockExecute = vi.fn()
vi.mock("@repo/zsa-react", () => ({
	useServerAction: vi.fn(() => ({
		execute: mockExecute,
		isPending: false,
	})),
}))

/**
 * Test props factory for OrganizerCompetitionForm
 */
function createTestProps(overrides = {}) {
	return {
		teams: [
			{ id: "team-1", name: "Test Gym", slug: "test-gym", type: "gym" as const },
		],
		selectedTeamId: "team-1",
		groups: [],
		scalingGroups: [],
		...overrides,
	}
}

describe("OrganizerCompetitionForm - Date Fields", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Default State (Single-Day Mode)", () => {
		it("renders with isMultiDay toggle OFF by default", () => {
			render(<OrganizerCompetitionForm {...createTestProps()} />)

			// The checkbox should exist and be unchecked
			const checkbox = screen.getByRole("checkbox", {
				name: /multi-day competition/i,
			})
			expect(checkbox).toBeInTheDocument()
			expect(checkbox).not.toBeChecked()
		})

		it("shows 'Competition Date' label when in single-day mode", () => {
			render(<OrganizerCompetitionForm {...createTestProps()} />)

			// Should show "Competition Date" not "Start Date"
			expect(screen.getByLabelText(/competition date/i)).toBeInTheDocument()
		})

		it("does NOT show end date field when isMultiDay is OFF", () => {
			render(<OrganizerCompetitionForm {...createTestProps()} />)

			// End date field should not be present
			expect(screen.queryByLabelText(/end date/i)).not.toBeInTheDocument()
		})
	})

	describe("Single-Day Submission", () => {
		it("submits successfully with only start date (no validation error)", async () => {
			const user = userEvent.setup()
			render(<OrganizerCompetitionForm {...createTestProps()} />)

			// Fill required fields
			await user.type(
				screen.getByLabelText(/competition name/i),
				"Summer Throwdown 2025",
			)
			await user.type(
				screen.getByLabelText(/slug/i),
				"summer-throwdown-2025",
			)
			await user.type(
				screen.getByLabelText(/competition date/i),
				"2025-07-15",
			)

			// Submit the form
			await user.click(
				screen.getByRole("button", { name: /create competition/i }),
			)

			// Wait for form submission - no validation errors should appear
			await waitFor(() => {
				expect(mockExecute).toHaveBeenCalled()
			})

			// Verify endDate is set to startDate in the action call
			expect(mockExecute).toHaveBeenCalledWith(
				expect.objectContaining({
					startDate: expect.any(Date),
					endDate: expect.any(Date),
				}),
			)

			// Verify no validation error messages are shown
			expect(
				screen.queryByText(/end date must be after start date/i),
			).not.toBeInTheDocument()
			expect(
				screen.queryByText(/end date is required/i),
			).not.toBeInTheDocument()
		})
	})

	describe("Multi-Day Toggle Behavior", () => {
		it("shows end date field when isMultiDay toggle is turned ON", async () => {
			const user = userEvent.setup()
			render(<OrganizerCompetitionForm {...createTestProps()} />)

			// Initially, end date should not be visible
			expect(screen.queryByLabelText(/end date/i)).not.toBeInTheDocument()

			// Click the multi-day checkbox
			const checkbox = screen.getByRole("checkbox", {
				name: /multi-day competition/i,
			})
			await user.click(checkbox)

			// Now end date field should be visible
			expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
		})

		it("changes label from 'Competition Date' to 'Start Date' when toggle is ON", async () => {
			const user = userEvent.setup()
			render(<OrganizerCompetitionForm {...createTestProps()} />)

			// Before toggle: "Competition Date"
			expect(screen.getByLabelText(/competition date/i)).toBeInTheDocument()
			expect(screen.queryByLabelText(/^start date$/i)).not.toBeInTheDocument()

			// Click the multi-day checkbox
			const checkbox = screen.getByRole("checkbox", {
				name: /multi-day competition/i,
			})
			await user.click(checkbox)

			// After toggle: "Start Date"
			expect(screen.getByLabelText(/^start date$/i)).toBeInTheDocument()
		})

		it("hides end date field when toggle is turned back OFF", async () => {
			const user = userEvent.setup()
			render(<OrganizerCompetitionForm {...createTestProps()} />)

			const checkbox = screen.getByRole("checkbox", {
				name: /multi-day competition/i,
			})

			// Turn ON
			await user.click(checkbox)
			expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()

			// Turn OFF
			await user.click(checkbox)
			expect(screen.queryByLabelText(/end date/i)).not.toBeInTheDocument()
		})
	})

	describe("Multi-Day Validation - Same Date Error", () => {
		it("shows validation error when end date equals start date", async () => {
			const user = userEvent.setup()
			render(<OrganizerCompetitionForm {...createTestProps()} />)

			// Fill required fields
			await user.type(
				screen.getByLabelText(/competition name/i),
				"Summer Throwdown 2025",
			)
			await user.type(
				screen.getByLabelText(/slug/i),
				"summer-throwdown-2025",
			)

			// Enable multi-day mode
			const checkbox = screen.getByRole("checkbox", {
				name: /multi-day competition/i,
			})
			await user.click(checkbox)

			// Set both dates to the same value
			await user.type(screen.getByLabelText(/^start date$/i), "2025-07-15")
			await user.type(screen.getByLabelText(/end date/i), "2025-07-15")

			// Attempt to submit
			await user.click(
				screen.getByRole("button", { name: /create competition/i }),
			)

			// Should show validation error
			await waitFor(() => {
				expect(
					screen.getByText(/end date must be after start date/i),
				).toBeInTheDocument()
			})

			// Action should NOT have been called
			expect(mockExecute).not.toHaveBeenCalled()
		})

		it("shows validation error when end date is before start date", async () => {
			const user = userEvent.setup()
			render(<OrganizerCompetitionForm {...createTestProps()} />)

			// Fill required fields
			await user.type(
				screen.getByLabelText(/competition name/i),
				"Summer Throwdown 2025",
			)
			await user.type(
				screen.getByLabelText(/slug/i),
				"summer-throwdown-2025",
			)

			// Enable multi-day mode
			const checkbox = screen.getByRole("checkbox", {
				name: /multi-day competition/i,
			})
			await user.click(checkbox)

			// Set end date before start date
			await user.type(screen.getByLabelText(/^start date$/i), "2025-07-15")
			await user.type(screen.getByLabelText(/end date/i), "2025-07-10")

			// Attempt to submit
			await user.click(
				screen.getByRole("button", { name: /create competition/i }),
			)

			// Should show validation error
			await waitFor(() => {
				expect(
					screen.getByText(/end date must be after start date/i),
				).toBeInTheDocument()
			})

			// Action should NOT have been called
			expect(mockExecute).not.toHaveBeenCalled()
		})
	})

	describe("Multi-Day Validation - Valid End Date", () => {
		it("submits successfully when end date is after start date", async () => {
			const user = userEvent.setup()
			render(<OrganizerCompetitionForm {...createTestProps()} />)

			// Fill required fields
			await user.type(
				screen.getByLabelText(/competition name/i),
				"Summer Throwdown 2025",
			)
			await user.type(
				screen.getByLabelText(/slug/i),
				"summer-throwdown-2025",
			)

			// Enable multi-day mode
			const checkbox = screen.getByRole("checkbox", {
				name: /multi-day competition/i,
			})
			await user.click(checkbox)

			// Set valid date range (end after start)
			await user.type(screen.getByLabelText(/^start date$/i), "2025-07-15")
			await user.type(screen.getByLabelText(/end date/i), "2025-07-17")

			// Submit
			await user.click(
				screen.getByRole("button", { name: /create competition/i }),
			)

			// Should submit without validation errors
			await waitFor(() => {
				expect(mockExecute).toHaveBeenCalled()
			})

			// Verify dates are passed correctly
			expect(mockExecute).toHaveBeenCalledWith(
				expect.objectContaining({
					startDate: expect.any(Date),
					endDate: expect.any(Date),
				}),
			)

			// No validation errors should be shown
			expect(
				screen.queryByText(/end date must be after start date/i),
			).not.toBeInTheDocument()
		})
	})

	describe("Multi-Day Required End Date", () => {
		it("shows validation error when multi-day is ON but end date is empty", async () => {
			const user = userEvent.setup()
			render(<OrganizerCompetitionForm {...createTestProps()} />)

			// Fill required fields
			await user.type(
				screen.getByLabelText(/competition name/i),
				"Summer Throwdown 2025",
			)
			await user.type(
				screen.getByLabelText(/slug/i),
				"summer-throwdown-2025",
			)

			// Enable multi-day mode
			const checkbox = screen.getByRole("checkbox", {
				name: /multi-day competition/i,
			})
			await user.click(checkbox)

			// Only set start date, leave end date empty
			await user.type(screen.getByLabelText(/^start date$/i), "2025-07-15")

			// Attempt to submit
			await user.click(
				screen.getByRole("button", { name: /create competition/i }),
			)

			// Should show validation error for required end date
			await waitFor(() => {
				expect(
					screen.getByText(/end date is required for multi-day competitions/i),
				).toBeInTheDocument()
			})

			// Action should NOT have been called
			expect(mockExecute).not.toHaveBeenCalled()
		})
	})
})
