import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock server-only is already handled by vitest alias in vitest.config.ts

// Mock next/navigation
vi.mock("next/navigation", () => ({
	notFound: vi.fn(),
}))

// Mock the auth utility
vi.mock("@/utils/auth", () => ({
	requireAdmin: vi.fn(),
}))

// Mock the competitions server function
vi.mock("@/server/competitions", () => ({
	getAllCompetitionsForAdmin: vi.fn(),
}))

// Mock the PageHeader component to simplify testing
vi.mock("@/components/page-header", () => ({
	PageHeader: ({ items }: { items: Array<{ href: string; label: string }> }) => (
		<nav data-testid="page-header">
			{items.map((item) => (
				<a key={item.href} href={item.href}>
					{item.label}
				</a>
			))}
		</nav>
	),
}))

// Mock the AdminCompetitionsTable to verify props
vi.mock(
	"@/app/(admin)/admin/competitions/_components/admin-competitions-table",
	() => ({
		AdminCompetitionsTable: ({
			competitions,
		}: {
			competitions: unknown[]
		}) => (
			<div data-testid="admin-competitions-table">
				<span data-testid="competitions-count">{competitions.length}</span>
			</div>
		),
	}),
)

describe("Admin Competitions Page", () => {
	const mockSession = {
		id: "session-123",
		userId: "user-123",
		expiresAt: Date.now() + 1000 * 60 * 60,
		createdAt: Date.now(),
		user: {
			id: "user-123",
			email: "admin@example.com",
			firstName: "Admin",
			lastName: "User",
			role: "admin" as const,
		},
	}

	const mockCompetitions = [
		{
			id: "comp-1",
			name: "Summer Throwdown 2025",
			slug: "summer-throwdown-2025",
			description: "Annual summer competition",
			startDate: new Date("2025-07-01"),
			endDate: new Date("2025-07-03"),
			status: "published" as const,
			visibility: "public" as const,
			createdAt: new Date(),
			updatedAt: new Date(),
			organizingTeamId: "team-1",
			competitionTeamId: null,
			groupId: null,
			organizingTeam: { id: "team-1", name: "CrossFit Gym 1", slug: "cf-gym-1" },
			competitionTeam: null,
			group: null,
		},
		{
			id: "comp-2",
			name: "Winter Challenge 2025",
			slug: "winter-challenge-2025",
			description: "Winter fitness challenge",
			startDate: new Date("2025-12-01"),
			endDate: new Date("2025-12-03"),
			status: "draft" as const,
			visibility: "private" as const,
			createdAt: new Date(),
			updatedAt: new Date(),
			organizingTeamId: "team-2",
			competitionTeamId: null,
			groupId: null,
			organizingTeam: { id: "team-2", name: "CrossFit Gym 2", slug: "cf-gym-2" },
			competitionTeam: null,
			group: null,
		},
	]

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should call requireAdmin on page load", async () => {
		const { requireAdmin } = await import("@/utils/auth")
		const { getAllCompetitionsForAdmin } = await import("@/server/competitions")

		vi.mocked(requireAdmin).mockResolvedValue(mockSession)
		vi.mocked(getAllCompetitionsForAdmin).mockResolvedValue(mockCompetitions)

		const AdminCompetitionsPage = (
			await import("@/app/(admin)/admin/competitions/page")
		).default

		await AdminCompetitionsPage()

		expect(requireAdmin).toHaveBeenCalledWith({ doNotThrowError: true })
	})

	it("should call notFound when session is null (not admin)", async () => {
		const { requireAdmin } = await import("@/utils/auth")
		const { notFound } = await import("next/navigation")

		vi.mocked(requireAdmin).mockResolvedValue(null)

		const AdminCompetitionsPage = (
			await import("@/app/(admin)/admin/competitions/page")
		).default

		await AdminCompetitionsPage()

		expect(notFound).toHaveBeenCalled()
	})

	it("should render page with competitions data", async () => {
		const { requireAdmin } = await import("@/utils/auth")
		const { getAllCompetitionsForAdmin } = await import("@/server/competitions")

		vi.mocked(requireAdmin).mockResolvedValue(mockSession)
		vi.mocked(getAllCompetitionsForAdmin).mockResolvedValue(mockCompetitions)

		const AdminCompetitionsPage = (
			await import("@/app/(admin)/admin/competitions/page")
		).default

		const jsx = await AdminCompetitionsPage()
		render(jsx)

		// Verify page title
		expect(screen.getByText("All Competitions")).toBeInTheDocument()

		// Verify description
		expect(
			screen.getByText("Browse and manage competitions from all organizers"),
		).toBeInTheDocument()
	})

	it("should pass competitions to AdminCompetitionsTable", async () => {
		const { requireAdmin } = await import("@/utils/auth")
		const { getAllCompetitionsForAdmin } = await import("@/server/competitions")

		vi.mocked(requireAdmin).mockResolvedValue(mockSession)
		vi.mocked(getAllCompetitionsForAdmin).mockResolvedValue(mockCompetitions)

		const AdminCompetitionsPage = (
			await import("@/app/(admin)/admin/competitions/page")
		).default

		const jsx = await AdminCompetitionsPage()
		render(jsx)

		// Verify table component is rendered with correct number of competitions
		expect(screen.getByTestId("admin-competitions-table")).toBeInTheDocument()
		expect(screen.getByTestId("competitions-count")).toHaveTextContent("2")
	})

	it("should render breadcrumbs with Admin → Competitions path", async () => {
		const { requireAdmin } = await import("@/utils/auth")
		const { getAllCompetitionsForAdmin } = await import("@/server/competitions")

		vi.mocked(requireAdmin).mockResolvedValue(mockSession)
		vi.mocked(getAllCompetitionsForAdmin).mockResolvedValue(mockCompetitions)

		const AdminCompetitionsPage = (
			await import("@/app/(admin)/admin/competitions/page")
		).default

		const jsx = await AdminCompetitionsPage()
		render(jsx)

		// Verify breadcrumbs
		const pageHeader = screen.getByTestId("page-header")
		expect(pageHeader).toBeInTheDocument()

		const adminLink = screen.getByRole("link", { name: "Admin" })
		expect(adminLink).toHaveAttribute("href", "/admin")

		const competitionsLink = screen.getByRole("link", { name: "Competitions" })
		expect(competitionsLink).toHaveAttribute("href", "/admin/competitions")
	})

	it("should fetch all competitions for admin", async () => {
		const { requireAdmin } = await import("@/utils/auth")
		const { getAllCompetitionsForAdmin } = await import("@/server/competitions")

		vi.mocked(requireAdmin).mockResolvedValue(mockSession)
		vi.mocked(getAllCompetitionsForAdmin).mockResolvedValue(mockCompetitions)

		const AdminCompetitionsPage = (
			await import("@/app/(admin)/admin/competitions/page")
		).default

		await AdminCompetitionsPage()

		expect(getAllCompetitionsForAdmin).toHaveBeenCalled()
	})

	it("should handle empty competitions list", async () => {
		const { requireAdmin } = await import("@/utils/auth")
		const { getAllCompetitionsForAdmin } = await import("@/server/competitions")

		vi.mocked(requireAdmin).mockResolvedValue(mockSession)
		vi.mocked(getAllCompetitionsForAdmin).mockResolvedValue([])

		const AdminCompetitionsPage = (
			await import("@/app/(admin)/admin/competitions/page")
		).default

		const jsx = await AdminCompetitionsPage()
		render(jsx)

		// Verify table component receives empty array
		expect(screen.getByTestId("competitions-count")).toHaveTextContent("0")
	})
})
