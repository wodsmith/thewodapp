import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { ZSAError } from "@repo/zsa"
import { createTestSession } from "@repo/test-utils/factories"

// Mock server-only before importing the module under test
vi.mock("server-only", () => ({}))

// Mock auth module
vi.mock("@/utils/auth", () => ({
	requireVerifiedEmail: vi.fn(),
}))

// Mock the db schema module for ROLES_ENUM
vi.mock("@/db/schema", () => ({
	ROLES_ENUM: {
		ADMIN: "admin",
		USER: "user",
	},
}))

// Import after mocks are set up
import { requireTeamPermissionOrAdmin, hasTeamPermission } from "@/utils/team-auth"
import { requireVerifiedEmail } from "@/utils/auth"

describe("requireTeamPermissionOrAdmin", () => {
	const teamId = "team-123"
	const permission = "edit_components"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("returns session for site admin regardless of team", async () => {
		// Arrange: Create a site admin session
		const adminSession = createTestSession({
			userId: "admin-user-123",
			teamId: "different-team-999", // Admin is NOT a member of the target team
			role: "admin", // Site admin role
			permissions: [], // No team permissions at all
		})

		vi.mocked(requireVerifiedEmail).mockResolvedValue(adminSession)

		// Act: Call requireTeamPermissionOrAdmin with a team the admin is NOT a member of
		const result = await requireTeamPermissionOrAdmin(teamId, permission)

		// Assert: Should return session without checking team permission
		expect(result).toEqual(adminSession)
		expect(requireVerifiedEmail).toHaveBeenCalledTimes(1)
		// hasTeamPermission should NOT be called since admin bypass kicks in
	})

	it("returns session for user with team permission", async () => {
		// Arrange: Create a regular user session with the required permission
		const userSession = createTestSession({
			userId: "user-123",
			teamId: teamId,
			role: "user",
			permissions: [permission, "access_dashboard"],
		})

		vi.mocked(requireVerifiedEmail).mockResolvedValue(userSession)

		// Act
		const result = await requireTeamPermissionOrAdmin(teamId, permission)

		// Assert
		expect(result).toEqual(userSession)
		// requireVerifiedEmail is called twice: once by requireTeamPermissionOrAdmin
		// and once by hasTeamPermission (which it delegates to for non-admin users)
		expect(requireVerifiedEmail).toHaveBeenCalled()
	})

	it("throws FORBIDDEN for user without team permission", async () => {
		// Arrange: Create a regular user session WITHOUT the required permission
		const userSession = createTestSession({
			userId: "user-123",
			teamId: teamId,
			role: "user",
			permissions: ["access_dashboard"], // Missing the required permission
		})

		vi.mocked(requireVerifiedEmail).mockResolvedValue(userSession)

		// Act & Assert
		await expect(
			requireTeamPermissionOrAdmin(teamId, permission)
		).rejects.toThrow(ZSAError)

		try {
			await requireTeamPermissionOrAdmin(teamId, permission)
		} catch (error) {
			expect(error).toBeInstanceOf(ZSAError)
			expect((error as ZSAError).code).toBe("FORBIDDEN")
			expect((error as ZSAError).message).toBe(
				"You don't have the required permission in this team"
			)
		}
	})

	it("throws FORBIDDEN for user not in the target team", async () => {
		// Arrange: User is in a different team than the one being checked
		const userSession = createTestSession({
			userId: "user-123",
			teamId: "other-team-456", // Different team
			role: "user",
			permissions: [permission], // Has permission in their team, but not the target team
		})

		vi.mocked(requireVerifiedEmail).mockResolvedValue(userSession)

		// Act & Assert
		await expect(
			requireTeamPermissionOrAdmin(teamId, permission)
		).rejects.toThrow(ZSAError)

		try {
			await requireTeamPermissionOrAdmin(teamId, permission)
		} catch (error) {
			expect(error).toBeInstanceOf(ZSAError)
			expect((error as ZSAError).code).toBe("FORBIDDEN")
		}
	})

	it("throws NOT_AUTHORIZED when not authenticated", async () => {
		// Arrange: requireVerifiedEmail returns null (not authenticated)
		vi.mocked(requireVerifiedEmail).mockResolvedValue(null)

		// Act & Assert
		await expect(
			requireTeamPermissionOrAdmin(teamId, permission)
		).rejects.toThrow(ZSAError)

		try {
			await requireTeamPermissionOrAdmin(teamId, permission)
		} catch (error) {
			expect(error).toBeInstanceOf(ZSAError)
			expect((error as ZSAError).code).toBe("NOT_AUTHORIZED")
			expect((error as ZSAError).message).toBe("Not authenticated")
		}
	})

	it("admin bypass works even when user has no teams", async () => {
		// Arrange: Site admin with no team memberships at all
		const adminSession = createTestSession({
			userId: "admin-user-123",
			role: "admin",
			teams: [], // No teams at all
		})

		vi.mocked(requireVerifiedEmail).mockResolvedValue(adminSession)

		// Act
		const result = await requireTeamPermissionOrAdmin(teamId, permission)

		// Assert: Should still return session because admin role bypasses all team checks
		expect(result).toEqual(adminSession)
	})
})

describe("hasTeamPermission", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("returns true when user has the permission in the team", async () => {
		const teamId = "team-123"
		const permission = "edit_components"

		const session = createTestSession({
			userId: "user-123",
			teamId: teamId,
			permissions: [permission, "access_dashboard"],
		})

		vi.mocked(requireVerifiedEmail).mockResolvedValue(session)

		const result = await hasTeamPermission(teamId, permission)

		expect(result).toBe(true)
	})

	it("returns false when user lacks the permission", async () => {
		const teamId = "team-123"
		const permission = "delete_components"

		const session = createTestSession({
			userId: "user-123",
			teamId: teamId,
			permissions: ["access_dashboard", "edit_components"], // Missing delete_components
		})

		vi.mocked(requireVerifiedEmail).mockResolvedValue(session)

		const result = await hasTeamPermission(teamId, permission)

		expect(result).toBe(false)
	})

	it("returns false when user is not in the team", async () => {
		const targetTeamId = "team-123"
		const permission = "edit_components"

		const session = createTestSession({
			userId: "user-123",
			teamId: "different-team-456", // Different team
			permissions: [permission],
		})

		vi.mocked(requireVerifiedEmail).mockResolvedValue(session)

		const result = await hasTeamPermission(targetTeamId, permission)

		expect(result).toBe(false)
	})

	it("returns false when not authenticated", async () => {
		vi.mocked(requireVerifiedEmail).mockResolvedValue(null)

		const result = await hasTeamPermission("team-123", "edit_components")

		expect(result).toBe(false)
	})
})
