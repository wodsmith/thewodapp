import React from "react"
import "@testing-library/jest-dom"
import QuickActionsSidebar from "@/components/admin/QuickActionsSidebar"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockTeamId = "team_test_123"

describe("QuickActionsSidebar", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.stubEnv("NODE_ENV", "development")
	})

	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("should render sidebar correctly", () => {
		render(<QuickActionsSidebar teamId={mockTeamId} />)

		expect(screen.getByText("Quick Actions")).toBeInTheDocument()
		expect(screen.getByText("Common admin tasks")).toBeInTheDocument()
	})

	it("should display primary action buttons", () => {
		render(<QuickActionsSidebar teamId={mockTeamId} />)

		// Primary actions
		expect(screen.getByText("Schedule Workout")).toBeInTheDocument()
		expect(screen.getByText("Create Workout")).toBeInTheDocument()
		expect(screen.getByText("Manage Members")).toBeInTheDocument()
		expect(screen.getByText("View Analytics")).toBeInTheDocument()
	})

	it("should display bulk operation buttons", () => {
		render(<QuickActionsSidebar teamId={mockTeamId} />)

		// Bulk operations
		expect(screen.getByText("Bulk Schedule")).toBeInTheDocument()
		expect(screen.getByText("Copy Schedule")).toBeInTheDocument()
		expect(screen.getByText("Clear Schedule")).toBeInTheDocument()
	})

	it("should display quick edit buttons", () => {
		render(<QuickActionsSidebar teamId={mockTeamId} />)

		// Quick edit actions
		expect(screen.getByText("Edit Today")).toBeInTheDocument()
		expect(screen.getByText("Time Blocks")).toBeInTheDocument()
	})

	it("should handle schedule workout action", () => {
		const onScheduleWorkout = vi.fn()

		render(
			<QuickActionsSidebar
				teamId={mockTeamId}
				onScheduleWorkout={onScheduleWorkout}
			/>,
		)

		const scheduleButton = screen.getByText("Schedule Workout")
		fireEvent.click(scheduleButton)

		expect(onScheduleWorkout).toHaveBeenCalled()
	})

	it("should handle create workout action", () => {
		const onCreateWorkout = vi.fn()

		render(
			<QuickActionsSidebar
				teamId={mockTeamId}
				onCreateWorkout={onCreateWorkout}
			/>,
		)

		const createButton = screen.getByText("Create Workout")
		fireEvent.click(createButton)

		expect(onCreateWorkout).toHaveBeenCalled()
	})

	it("should handle manage members action", () => {
		const onManageMembers = vi.fn()

		render(
			<QuickActionsSidebar
				teamId={mockTeamId}
				onManageMembers={onManageMembers}
			/>,
		)

		const manageMembersButton = screen.getByText("Manage Members")
		fireEvent.click(manageMembersButton)

		expect(onManageMembers).toHaveBeenCalled()
	})

	it("should handle view analytics action", () => {
		const onViewAnalytics = vi.fn()

		render(
			<QuickActionsSidebar
				teamId={mockTeamId}
				onViewAnalytics={onViewAnalytics}
			/>,
		)

		const analyticsButton = screen.getByText("View Analytics")
		fireEvent.click(analyticsButton)

		expect(onViewAnalytics).toHaveBeenCalled()
	})

	it("should handle sidebar collapse/expand", () => {
		const onToggleCollapsed = vi.fn()

		render(
			<QuickActionsSidebar
				teamId={mockTeamId}
				onToggleCollapsed={onToggleCollapsed}
			/>,
		)

		const toggleButton = screen.getByRole("button", {
			name: /collapse sidebar|expand sidebar/i,
		})
		fireEvent.click(toggleButton)

		expect(onToggleCollapsed).toHaveBeenCalled()
	})

	it("should show collapsed state correctly", () => {
		render(<QuickActionsSidebar teamId={mockTeamId} isCollapsed={true} />)

		// In collapsed state, action labels should not be visible
		expect(screen.queryByText("Quick Actions")).not.toBeInTheDocument()
		expect(screen.queryByText("Schedule Workout")).not.toBeInTheDocument()
	})

	it("should display action descriptions", () => {
		render(<QuickActionsSidebar teamId={mockTeamId} />)

		expect(
			screen.getByText("Schedule a workout for specific date"),
		).toBeInTheDocument()
		expect(screen.getByText("Create a new workout")).toBeInTheDocument()
		expect(
			screen.getByText("Manage team members and permissions"),
		).toBeInTheDocument()
		expect(
			screen.getByText("View team performance analytics"),
		).toBeInTheDocument()
	})

	it("should show section headers", () => {
		render(<QuickActionsSidebar teamId={mockTeamId} />)

		expect(screen.getByText("Primary Actions")).toBeInTheDocument()
		expect(screen.getByText("Bulk Operations")).toBeInTheDocument()
		expect(screen.getByText("Quick Edit")).toBeInTheDocument()
	})

	it("should track recent actions", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		render(<QuickActionsSidebar teamId={mockTeamId} />)

		// Click an action
		const scheduleButton = screen.getByText("Schedule Workout")
		fireEvent.click(scheduleButton)

		// Should log the action
		expect(consoleSpy).toHaveBeenCalledWith(
			"[QuickActionsSidebar] Schedule workout action",
			expect.objectContaining({
				actionId: "schedule-workout",
				teamId: mockTeamId,
			}),
		)

		consoleSpy.mockRestore()
	})

	it("should show recent activity section after actions", async () => {
		render(<QuickActionsSidebar teamId={mockTeamId} />)

		// Click an action to add to recent activity
		const scheduleButton = screen.getByText("Schedule Workout")
		fireEvent.click(scheduleButton)

		// Recent activity section should appear
		await waitFor(() => {
			expect(screen.getByText("Recent Actions")).toBeInTheDocument()
		})
	})

	it("should handle bulk operations", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		render(<QuickActionsSidebar teamId={mockTeamId} />)

		// Test bulk schedule
		const bulkScheduleButton = screen.getByText("Bulk Schedule")
		fireEvent.click(bulkScheduleButton)

		expect(consoleSpy).toHaveBeenCalledWith(
			"[QuickActionsSidebar] Bulk schedule workouts",
			expect.objectContaining({
				actionId: "bulk-schedule",
				teamId: mockTeamId,
			}),
		)

		consoleSpy.mockRestore()
	})

	it("should handle quick edit actions", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		render(<QuickActionsSidebar teamId={mockTeamId} />)

		// Test edit today
		const editTodayButton = screen.getByText("Edit Today")
		fireEvent.click(editTodayButton)

		expect(consoleSpy).toHaveBeenCalledWith(
			"[QuickActionsSidebar] Edit today's workouts",
			expect.objectContaining({
				actionId: "edit-today",
				teamId: mockTeamId,
			}),
		)

		consoleSpy.mockRestore()
	})

	it("should show New badge on analytics", () => {
		render(<QuickActionsSidebar teamId={mockTeamId} />)

		const newBadge = screen.getByText("New")
		expect(newBadge).toBeInTheDocument()
	})

	it("should log actions in development mode", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		render(<QuickActionsSidebar teamId={mockTeamId} />)

		const createButton = screen.getByText("Create Workout")
		fireEvent.click(createButton)

		expect(consoleSpy).toHaveBeenCalledWith(
			"[QuickActionsSidebar] Create workout action",
			expect.objectContaining({
				actionId: "create-workout",
				teamId: mockTeamId,
			}),
		)

		consoleSpy.mockRestore()
	})

	it("should not log in production mode", () => {
		vi.stubEnv("NODE_ENV", "production")
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		render(<QuickActionsSidebar teamId={mockTeamId} />)

		const createButton = screen.getByText("Create Workout")
		fireEvent.click(createButton)

		// Should not have any [QuickActionsSidebar] logs in production
		const sidebarLogs = consoleSpy.mock.calls.filter((call) =>
			call[0]?.includes?.("[QuickActionsSidebar]"),
		)
		expect(sidebarLogs).toHaveLength(0)

		consoleSpy.mockRestore()
	})

	it("should show visual indicators for recent actions", async () => {
		render(<QuickActionsSidebar teamId={mockTeamId} />)

		// Click an action
		const scheduleButton = screen.getByText("Schedule Workout")
		fireEvent.click(scheduleButton)

		// Should show green indicator dot (visual feedback)
		await waitFor(() => {
			const indicator = document.querySelector(".bg-green-500")
			expect(indicator).toBeInTheDocument()
		})
	})
})
