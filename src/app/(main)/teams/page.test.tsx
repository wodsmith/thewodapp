import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TeamsPage from "./page"

// Mock the auth utility
vi.mock("@/utils/auth", () => ({
	requireVerifiedEmail: vi.fn(),
}))

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
}))

describe("TeamsPage", () => {
	it("renders page with proper team selection and basic layout structure", async () => {
		const { requireVerifiedEmail } = await import("@/utils/auth")
		vi.mocked(requireVerifiedEmail).mockResolvedValue({
			user: { id: "test-user-id" },
		} as any)

		render(await TeamsPage())

		// Check for main heading
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("TEAMS")

		// Check for scheduled workouts section
		expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
			"Scheduled Workouts",
		)

		// Check for descriptive text
		expect(
			screen.getByText("View scheduled workouts for teams you have access to."),
		).toBeInTheDocument()
	})

	it("redirects when user is not authenticated", async () => {
		const { requireVerifiedEmail } = await import("@/utils/auth")
		const { redirect } = await import("next/navigation")

		vi.mocked(requireVerifiedEmail).mockResolvedValue(null)

		await TeamsPage()

		expect(redirect).toHaveBeenCalledWith("/sign-in")
	})
})
