import AdminDashboardPage from "@/app/dashboard/teams/[teamId]/admin/page"
import { hasTeamPermission } from "@/utils/team-auth"
import { redirect } from "next/navigation"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock the dependencies
vi.mock("@/utils/team-auth", () => ({
	hasTeamPermission: vi.fn(),
}))

vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
}))

vi.mock("@/components/schedule/TeamScheduleCalendar", () => ({
	default: ({ teamId }: { teamId: string }) => `Calendar for team: ${teamId}`,
}))

vi.mock("@/components/schedule/ScheduleWorkoutModal", () => ({
	default: ({ teamId }: { teamId: string }) =>
		`Schedule modal for team: ${teamId}`,
}))

const mockParams = {
	teamId: "test-team-id",
}

describe("AdminDashboardPage", () => {
	const originalNodeEnv = process.env.NODE_ENV

	beforeEach(() => {
		vi.clearAllMocks()
		// Reset NODE_ENV for each test
		process.env.NODE_ENV = originalNodeEnv
	})

	afterEach(() => {
		process.env.NODE_ENV = originalNodeEnv
	})

	it("should redirect when user lacks admin permissions", async () => {
		vi.mocked(hasTeamPermission).mockResolvedValue(false)

		await AdminDashboardPage({
			params: Promise.resolve(mockParams),
		})

		expect(hasTeamPermission).toHaveBeenCalledWith(
			"test-team-id",
			"schedule_workouts",
		)
		expect(redirect).toHaveBeenCalledWith("/dashboard/teams/test-team-id")
	})

	it("should not redirect when user has permissions", async () => {
		vi.mocked(hasTeamPermission).mockResolvedValue(true)

		await AdminDashboardPage({
			params: Promise.resolve(mockParams),
		})

		expect(hasTeamPermission).toHaveBeenCalledWith(
			"test-team-id",
			"schedule_workouts",
		)
		expect(redirect).not.toHaveBeenCalled()
	})

	it("should log in development environment", async () => {
		vi.stubEnv("NODE_ENV", "development")
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		vi.mocked(hasTeamPermission).mockResolvedValue(true)

		await AdminDashboardPage({
			params: Promise.resolve(mockParams),
		})

		expect(consoleSpy).toHaveBeenCalledWith(
			"[AdminDashboard] Loading admin dashboard for teamId: test-team-id",
		)
		consoleSpy.mockRestore()
	})

	it("should not log in production environment", async () => {
		vi.stubEnv("NODE_ENV", "production")
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		vi.mocked(hasTeamPermission).mockResolvedValue(true)

		await AdminDashboardPage({
			params: Promise.resolve(mockParams),
		})

		expect(consoleSpy).not.toHaveBeenCalled()
		consoleSpy.mockRestore()
	})
})
