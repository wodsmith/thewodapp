import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TeamPage from "./page"

// Mock the auth utilities
vi.mock("@/utils/auth", () => ({
	requireVerifiedEmail: vi.fn(),
}))

vi.mock("@/utils/team-auth", () => ({
	hasTeamMembership: vi.fn(),
}))

// Mock the server action
vi.mock("../_actions/team-scheduled-workouts.action", () => ({
	getTeamScheduledWorkoutsAction: vi.fn(),
}))

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
	notFound: vi.fn(),
}))

describe("TeamPage", () => {
	it("renders team page with scheduled workouts", async () => {
		const { requireVerifiedEmail } = await import("@/utils/auth")
		const { hasTeamMembership } = await import("@/utils/team-auth")
		const { getTeamScheduledWorkoutsAction } = await import(
			"../_actions/team-scheduled-workouts.action"
		)

		vi.mocked(requireVerifiedEmail).mockResolvedValue({
			user: { id: "test-user-id" },
			teams: [
				{
					id: "team-1",
					name: "Test Team",
					slug: "test-team",
					role: { name: "Owner", id: "owner", isSystemRole: true },
				},
			],
		} as any)

		vi.mocked(hasTeamMembership).mockResolvedValue({ hasAccess: true })

		vi.mocked(getTeamScheduledWorkoutsAction).mockResolvedValue([
			{
				scheduledWorkouts: [],
				success: true,
			},
			null,
		])

		render(await TeamPage({ params: Promise.resolve({ id: "team-1" }) }))

		// Check for team name in heading
		expect(screen.getByText("TEST TEAM")).toBeInTheDocument()

		// Check for back link
		expect(screen.getByText("Back to Teams")).toBeInTheDocument()

		// Check for scheduled workouts section
		expect(screen.getByText("Scheduled Workouts")).toBeInTheDocument()
	})

	it("shows not found when user doesn't have access", async () => {
		const { requireVerifiedEmail } = await import("@/utils/auth")
		const { hasTeamMembership } = await import("@/utils/team-auth")
		const { notFound } = await import("next/navigation")

		vi.mocked(requireVerifiedEmail).mockResolvedValue({
			user: { id: "test-user-id" },
			teams: [],
		} as any)

		vi.mocked(hasTeamMembership).mockResolvedValue({ hasAccess: false })

		await TeamPage({ params: Promise.resolve({ id: "team-1" }) })

		expect(notFound).toHaveBeenCalled()
	})

	it("redirects when user is not authenticated", async () => {
		const { requireVerifiedEmail } = await import("@/utils/auth")
		const { redirect } = await import("next/navigation")

		vi.mocked(requireVerifiedEmail).mockResolvedValue(null)

		await TeamPage({ params: Promise.resolve({ id: "team-1" }) })

		expect(redirect).toHaveBeenCalledWith("/sign-in")
	})
})
