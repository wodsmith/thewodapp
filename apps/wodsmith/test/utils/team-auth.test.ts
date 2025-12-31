import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { ZSAError } from "@repo/zsa"
import { createTestSession } from "@repo/test-utils/factories"

// Mock server-only before importing the module under test
vi.mock("server-only", () => ({}))

// In-memory cookie store for testing
const mockCookieStore = new Map<string, { value: string; options?: Record<string, unknown> }>()

// Mock next/headers cookies
vi.mock("next/headers", () => ({
	cookies: vi.fn(() => Promise.resolve({
		get: (name: string) => {
			const cookie = mockCookieStore.get(name)
			return cookie ? { value: cookie.value } : undefined
		},
		set: (name: string, value: string, options?: Record<string, unknown>) => {
			mockCookieStore.set(name, { value, options })
		},
		delete: (name: string) => {
			mockCookieStore.delete(name)
		},
	})),
}))

// Mock auth module - partial mock that preserves real implementations
vi.mock("@/utils/auth", async (importOriginal) => {
	const actual = await importOriginal() as Record<string, unknown>
	return {
		...actual,
		requireVerifiedEmail: vi.fn(),
		getSessionFromCookie: vi.fn(),
	}
})

// Mock the db schema module for ROLES_ENUM and TEAM_PERMISSIONS
vi.mock("@/db/schema", () => ({
	ROLES_ENUM: {
		ADMIN: "admin",
		USER: "user",
	},
	TEAM_PERMISSIONS: {
		ACCESS_DASHBOARD: "access_dashboard",
		CREATE_COMPONENTS: "create_components",
		EDIT_COMPONENTS: "edit_components",
		DELETE_COMPONENTS: "delete_components",
	},
}))

// Mock constants
vi.mock("@/constants", () => ({
	ACTIVE_TEAM_COOKIE_NAME: "active-team",
	SESSION_COOKIE_NAME: "session",
}))

// Mock is-prod
vi.mock("@/utils/is-prod", () => ({
	default: false,
}))

// Import after mocks are set up
import { requireTeamPermissionOrAdmin, hasTeamPermission } from "@/utils/team-auth"
import { requireVerifiedEmail, getSessionFromCookie } from "@/utils/auth"
import { TEAM_PERMISSIONS } from "@/db/schema"

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

// ============================================================================
// Team Context Cookie Utilities Tests
// These test the cookie-based team context management functions from auth.ts
// ============================================================================

describe("getActiveTeamFromCookie", () => {
	// Dynamic import to get fresh module with mocks
	let getActiveTeamFromCookie: () => Promise<string | null>

	beforeEach(async () => {
		mockCookieStore.clear()
		vi.clearAllMocks()
		// Fresh import to get the real implementation with mocked dependencies
		const authModule = await import("@/utils/auth")
		getActiveTeamFromCookie = authModule.getActiveTeamFromCookie
	})

	afterEach(() => {
		mockCookieStore.clear()
		vi.clearAllMocks()
	})

	it("returns null when no active team cookie is set", async () => {
		// Arrange: Cookie store is empty (cleared in beforeEach)

		// Act
		const result = await getActiveTeamFromCookie()

		// Assert
		expect(result).toBeNull()
	})

	it("returns the team ID from the active team cookie", async () => {
		// Arrange: Set the active team cookie
		const expectedTeamId = "team-active-123"
		mockCookieStore.set("active-team", { value: expectedTeamId })

		// Act
		const result = await getActiveTeamFromCookie()

		// Assert
		expect(result).toBe(expectedTeamId)
	})

	it("returns the exact cookie value without modification", async () => {
		// Arrange: Set a team ID with special characters (CUID format)
		const teamId = "clj2k3l4m0000abcd1234efgh"
		mockCookieStore.set("active-team", { value: teamId })

		// Act
		const result = await getActiveTeamFromCookie()

		// Assert
		expect(result).toBe(teamId)
	})
})

describe("setActiveTeamCookie", () => {
	let setActiveTeamCookie: (teamId: string) => Promise<void>

	beforeEach(async () => {
		mockCookieStore.clear()
		vi.clearAllMocks()
		const authModule = await import("@/utils/auth")
		setActiveTeamCookie = authModule.setActiveTeamCookie
	})

	afterEach(() => {
		mockCookieStore.clear()
		vi.clearAllMocks()
	})

	it("sets the active team cookie with the provided team ID", async () => {
		// Arrange
		const teamId = "team-new-456"

		// Act
		await setActiveTeamCookie(teamId)

		// Assert
		const cookie = mockCookieStore.get("active-team")
		expect(cookie).toBeDefined()
		expect(cookie?.value).toBe(teamId)
	})

	it("sets cookie with httpOnly flag for security", async () => {
		// Arrange
		const teamId = "team-secure-789"

		// Act
		await setActiveTeamCookie(teamId)

		// Assert
		const cookie = mockCookieStore.get("active-team")
		expect(cookie?.options?.httpOnly).toBe(true)
	})

	it("sets cookie with sameSite lax for CSRF protection", async () => {
		// Arrange
		const teamId = "team-lax-101"

		// Act
		await setActiveTeamCookie(teamId)

		// Assert
		const cookie = mockCookieStore.get("active-team")
		expect(cookie?.options?.sameSite).toBe("lax")
	})

	it("sets cookie with path / for global access", async () => {
		// Arrange
		const teamId = "team-global-102"

		// Act
		await setActiveTeamCookie(teamId)

		// Assert
		const cookie = mockCookieStore.get("active-team")
		expect(cookie?.options?.path).toBe("/")
	})

	it("overwrites existing cookie when switching teams", async () => {
		// Arrange: Set initial team
		const initialTeamId = "team-old-001"
		const newTeamId = "team-new-002"
		mockCookieStore.set("active-team", { value: initialTeamId })

		// Act: Switch to new team
		await setActiveTeamCookie(newTeamId)

		// Assert: Cookie should have new value
		const cookie = mockCookieStore.get("active-team")
		expect(cookie?.value).toBe(newTeamId)
	})
})

describe("deleteActiveTeamCookie", () => {
	let deleteActiveTeamCookie: () => Promise<void>

	beforeEach(async () => {
		mockCookieStore.clear()
		vi.clearAllMocks()
		const authModule = await import("@/utils/auth")
		deleteActiveTeamCookie = authModule.deleteActiveTeamCookie
	})

	afterEach(() => {
		mockCookieStore.clear()
		vi.clearAllMocks()
	})

	it("removes the active team cookie", async () => {
		// Arrange: Set a cookie first
		mockCookieStore.set("active-team", { value: "team-to-delete" })
		expect(mockCookieStore.get("active-team")).toBeDefined()

		// Act
		await deleteActiveTeamCookie()

		// Assert
		expect(mockCookieStore.get("active-team")).toBeUndefined()
	})

	it("is idempotent - calling when no cookie exists does not throw", async () => {
		// Arrange: Ensure no cookie exists
		expect(mockCookieStore.get("active-team")).toBeUndefined()

		// Act & Assert: Should not throw
		await expect(deleteActiveTeamCookie()).resolves.not.toThrow()
	})
})

describe("setActiveTeamAction", () => {
	// Import the server action
	let setActiveTeamAction: (params: { input: { teamId: string } }) => Promise<{ success: boolean; teamId: string; teamName: string }>

	beforeEach(async () => {
		mockCookieStore.clear()
		vi.clearAllMocks()
		// Import the action module
		const teamActionsModule = await import("@/actions/team-actions")
		setActiveTeamAction = async (params) => {
			const [result, error] = await teamActionsModule.setActiveTeamAction(params.input)
			if (error) throw error
			return result as { success: boolean; teamId: string; teamName: string }
		}
	})

	afterEach(() => {
		mockCookieStore.clear()
		vi.clearAllMocks()
	})

	it("sets cookie and returns success when user is member with ACCESS_DASHBOARD", async () => {
		// Arrange
		const teamId = "team-valid-123"
		const session = createTestSession({
			userId: "user-123",
			teamId: teamId,
			permissions: ["access_dashboard", "edit_components"],
		})
		// Ensure the team name is set correctly
		session.teams = session.teams?.map(t => 
			t.id === teamId ? { ...t, name: "Valid Team" } : t
		)

		vi.mocked(requireVerifiedEmail).mockResolvedValue(session)

		// Act
		const result = await setActiveTeamAction({ input: { teamId } })

		// Assert
		expect(result.success).toBe(true)
		expect(result.teamId).toBe(teamId)
		expect(mockCookieStore.get("active-team")?.value).toBe(teamId)
	})

	it("throws FORBIDDEN when user is not a member of the team", async () => {
		// Arrange
		const session = createTestSession({
			userId: "user-123",
			teamId: "team-other-456", // User is in a different team
			permissions: ["access_dashboard"],
		})

		vi.mocked(requireVerifiedEmail).mockResolvedValue(session)

		// Act & Assert
		await expect(
			setActiveTeamAction({ input: { teamId: "team-not-member-789" } })
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You are not a member of this team",
		})
	})

	it("throws FORBIDDEN when user lacks ACCESS_DASHBOARD permission", async () => {
		// Arrange: User is in team but without access_dashboard
		const teamId = "team-no-access-123"
		const session = createTestSession({
			userId: "user-123",
			teamId: teamId,
			permissions: ["edit_components"], // Missing access_dashboard
		})

		vi.mocked(requireVerifiedEmail).mockResolvedValue(session)

		// Act & Assert
		await expect(
			setActiveTeamAction({ input: { teamId } })
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not have permission to access this team",
		})
	})

	it("throws NOT_AUTHORIZED when session has no teams", async () => {
		// Arrange
		const session = createTestSession({
			userId: "user-123",
			teams: undefined, // No teams array
		})

		vi.mocked(requireVerifiedEmail).mockResolvedValue(session)

		// Act & Assert
		await expect(
			setActiveTeamAction({ input: { teamId: "any-team" } })
		).rejects.toMatchObject({
			code: "NOT_AUTHORIZED",
			message: "No teams found in session",
		})
	})
})

describe("Team Context Integration - Team Switching", () => {
	let getActiveTeamFromCookie: () => Promise<string | null>
	let setActiveTeamCookie: (teamId: string) => Promise<void>

	beforeEach(async () => {
		mockCookieStore.clear()
		vi.clearAllMocks()
		const authModule = await import("@/utils/auth")
		getActiveTeamFromCookie = authModule.getActiveTeamFromCookie
		setActiveTeamCookie = authModule.setActiveTeamCookie
	})

	afterEach(() => {
		mockCookieStore.clear()
		vi.clearAllMocks()
	})

	it("cookie correctly reflects team switch from Team A to Team B", async () => {
		// Arrange: Start with Team A active
		const teamA = "team-a-111"
		const teamB = "team-b-222"
		await setActiveTeamCookie(teamA)

		// Verify initial state
		expect(await getActiveTeamFromCookie()).toBe(teamA)

		// Act: Switch to Team B
		await setActiveTeamCookie(teamB)

		// Assert: Cookie now reflects Team B
		expect(await getActiveTeamFromCookie()).toBe(teamB)
	})

	it("cookie persists across multiple read operations", async () => {
		// Arrange
		const teamId = "team-persistent-333"
		await setActiveTeamCookie(teamId)

		// Act: Multiple reads
		const read1 = await getActiveTeamFromCookie()
		const read2 = await getActiveTeamFromCookie()
		const read3 = await getActiveTeamFromCookie()

		// Assert: All reads return same value
		expect(read1).toBe(teamId)
		expect(read2).toBe(teamId)
		expect(read3).toBe(teamId)
	})

	it("supports switching between multiple teams in sequence", async () => {
		// Arrange
		const teams = ["team-1", "team-2", "team-3", "team-4"]

		// Act & Assert: Switch through all teams
		for (const team of teams) {
			await setActiveTeamCookie(team)
			expect(await getActiveTeamFromCookie()).toBe(team)
		}

		// Final state should be last team
		expect(await getActiveTeamFromCookie()).toBe("team-4")
	})
})
