import React from "react"
import "@testing-library/jest-dom"
import TrackManagementSidebar from "@/components/admin/TrackManagementSidebar"
import { getTeamTracks } from "@/server/programming-tracks"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock the getTeamTracks function
vi.mock("@/server/programming-tracks", () => ({
	getTeamTracks: vi.fn(),
}))

// Mock data
const mockTracks = [
	{
		id: "ptrk_test_1",
		name: "Strength Track",
		description: "Focus on building strength",
		type: "team_owned",
		ownerTeamId: "team_test_123",
		isPublic: 1,
		createdAt: new Date("2025-01-01"),
		updatedAt: new Date("2025-01-01"),
		updateCounter: 0,
	},
	{
		id: "ptrk_test_2",
		name: "Cardio Track",
		description: "Cardiovascular endurance",
		type: "team_owned",
		ownerTeamId: "team_test_123",
		isPublic: 0,
		createdAt: new Date("2025-01-02"),
		updatedAt: new Date("2025-01-02"),
		updateCounter: 0,
	},
]

const mockTeamId = "team_test_123"

describe("TrackManagementSidebar", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.stubEnv("NODE_ENV", "development")

		// Mock getTeamTracks to return mock data
		vi.mocked(getTeamTracks).mockResolvedValue(mockTracks)
	})

	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("should render sidebar correctly", async () => {
		render(<TrackManagementSidebar teamId={mockTeamId} />)

		// Should show loading skeleton initially
		expect(document.querySelector(".animate-pulse")).toBeInTheDocument()

		// Wait for tracks to load
		await waitFor(() => {
			expect(screen.getByText("Tracks")).toBeInTheDocument()
		})

		// Should show sidebar header
		expect(screen.getByText("Tracks")).toBeInTheDocument()
		expect(screen.getByText("2 active tracks")).toBeInTheDocument()
	})

	it("should display team tracks after loading", async () => {
		render(<TrackManagementSidebar teamId={mockTeamId} />)

		await waitFor(() => {
			expect(screen.getByText("Tracks")).toBeInTheDocument()
		})

		// Should display both tracks
		expect(screen.getByText("Strength Track")).toBeInTheDocument()
		expect(screen.getByText("Cardio Track")).toBeInTheDocument()
		expect(screen.getByText("Focus on building strength")).toBeInTheDocument()
		expect(screen.getByText("Cardiovascular endurance")).toBeInTheDocument()
	})

	it("should handle track selection", async () => {
		const onTrackSelected = vi.fn()

		render(
			<TrackManagementSidebar
				teamId={mockTeamId}
				onTrackSelected={onTrackSelected}
			/>,
		)

		await waitFor(() => {
			expect(screen.getByText("Tracks")).toBeInTheDocument()
		})

		// Click on first track
		const trackCard = screen
			.getByText("Strength Track")
			.closest('div[role="button"], [role="button"], div[tabindex], button')
		if (trackCard) {
			fireEvent.click(trackCard)
			expect(onTrackSelected).toHaveBeenCalledWith("ptrk_test_1")
		}
	})

	it("should show New Track button", async () => {
		render(<TrackManagementSidebar teamId={mockTeamId} />)

		await waitFor(() => {
			expect(screen.getByText("Tracks")).toBeInTheDocument()
		})

		const newTrackButton = screen.getByRole("button", { name: /new track/i })
		expect(newTrackButton).toBeInTheDocument()
	})

	it("should handle sidebar collapse/expand", async () => {
		const onToggleCollapsed = vi.fn()

		render(
			<TrackManagementSidebar
				teamId={mockTeamId}
				onToggleCollapsed={onToggleCollapsed}
			/>,
		)

		// Wait for component to load first
		await waitFor(() => {
			expect(screen.getByText("Tracks")).toBeInTheDocument()
		})

		const toggleButton = screen.getByRole("button", {
			name: /collapse sidebar|expand sidebar/i,
		})
		fireEvent.click(toggleButton)

		expect(onToggleCollapsed).toHaveBeenCalled()
	})

	it("should show collapsed state correctly", async () => {
		render(<TrackManagementSidebar teamId={mockTeamId} isCollapsed={true} />)

		await waitFor(() => {
			expect(document.querySelector(".w-12")).toBeInTheDocument()
		})

		// In collapsed state, track names should not be visible
		expect(screen.queryByText("Strength Track")).not.toBeInTheDocument()
		expect(screen.queryByText("Tracks")).not.toBeInTheDocument()
	})

	it("should display track progress information", async () => {
		render(<TrackManagementSidebar teamId={mockTeamId} />)

		await waitFor(() => {
			expect(screen.getByText("Tracks")).toBeInTheDocument()
		})

		// Should show week progress (mocked values)
		const weekElements = screen.getAllByText(/Week \d+ of 12/)
		expect(weekElements.length).toBeGreaterThan(0)

		const percentageElements = screen.getAllByText(/\d+%/)
		expect(percentageElements.length).toBeGreaterThan(0)
	})

	it("should show manage and stats buttons for tracks", async () => {
		render(<TrackManagementSidebar teamId={mockTeamId} />)

		await waitFor(() => {
			expect(screen.getByText("Tracks")).toBeInTheDocument()
		})

		// Should show action buttons
		const manageButtons = screen.getAllByText(/manage/i)
		const statsButtons = screen.getAllByText(/stats/i)

		expect(manageButtons.length).toBeGreaterThan(0)
		expect(statsButtons.length).toBeGreaterThan(0)
	})

	it("should log actions in development mode", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		render(<TrackManagementSidebar teamId={mockTeamId} />)

		await waitFor(() => {
			expect(screen.queryByText(/Loading.../)).not.toBeInTheDocument()
		})

		// Verify logging
		expect(consoleSpy).toHaveBeenCalledWith(
			"[TrackManagementSidebar] Fetching team tracks",
			expect.objectContaining({
				teamId: mockTeamId,
			}),
		)

		expect(consoleSpy).toHaveBeenCalledWith(
			"[TrackManagementSidebar] Fetched team tracks",
			expect.objectContaining({
				count: 2,
			}),
		)

		consoleSpy.mockRestore()
	})

	it("should not log in production mode", async () => {
		vi.stubEnv("NODE_ENV", "production")
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		render(<TrackManagementSidebar teamId={mockTeamId} />)

		await waitFor(() => {
			expect(screen.queryByText(/Loading.../)).not.toBeInTheDocument()
		})

		// Should not have any [TrackManagementSidebar] logs in production
		const sidebarLogs = consoleSpy.mock.calls.filter((call) =>
			call[0]?.includes?.("[TrackManagementSidebar]"),
		)
		expect(sidebarLogs).toHaveLength(0)

		consoleSpy.mockRestore()
	})

	it("should handle empty tracks state", async () => {
		// Mock empty tracks
		vi.mocked(getTeamTracks).mockResolvedValue([])

		render(<TrackManagementSidebar teamId={mockTeamId} />)

		await waitFor(() => {
			expect(screen.queryByText(/Loading.../)).not.toBeInTheDocument()
		})

		expect(screen.getByText("No tracks found")).toBeInTheDocument()
		expect(screen.getByText("Create your first track")).toBeInTheDocument()
	})

	it("should handle error state", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {})

		// Mock error
		vi.mocked(getTeamTracks).mockRejectedValue(new Error("Failed to fetch"))

		render(<TrackManagementSidebar teamId={mockTeamId} />)

		await waitFor(() => {
			expect(screen.queryByText(/Loading.../)).not.toBeInTheDocument()
		})

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"[TrackManagementSidebar] Error fetching tracks:",
			expect.any(Error),
		)

		consoleErrorSpy.mockRestore()
	})
})
