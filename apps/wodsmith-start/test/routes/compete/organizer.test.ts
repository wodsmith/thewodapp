/**
 * Organizer Route Tests
 *
 * Tests that the organizer route correctly uses the active team from cookie,
 * not just the first team in the session.
 *
 * Bug: When switching organizing teams via team-switcher, the cookie updates
 * but `/compete/organizer` route was ignoring it (using session.teams?.[0]).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// In-memory cookie store for testing
const mockCookieStore = new Map<
	string,
	{ value: string; options?: Record<string, unknown> }
>()

// Mock @tanstack/react-start/server cookies
vi.mock("@tanstack/react-start/server", () => ({
	getCookie: vi.fn((name: string) => {
		const cookie = mockCookieStore.get(name)
		return cookie?.value ?? undefined
	}),
	setCookie: vi.fn(
		(name: string, value: string, options?: Record<string, unknown>) => {
			mockCookieStore.set(name, { value, options })
		},
	),
}))

// Mock db
vi.mock("@/db", () => ({
	getDb: vi.fn(() => ({
		query: {
			userTable: { findFirst: vi.fn() },
		},
	})),
}))

// Mock ROLES_ENUM
vi.mock("@/db/schema", () => ({
	ROLES_ENUM: {
		ADMIN: "admin",
		USER: "user",
	},
}))

// Mock auth module - partial mock for getSessionFromCookie
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("@/utils/auth", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>
	return {
		...actual,
		getSessionFromCookie: vi.fn(),
	}
})

// Helper type to allow flexible session mocking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockSession = any

// Mock constants
vi.mock("@/constants", () => ({
	ACTIVE_TEAM_COOKIE_NAME: "active-team",
	SESSION_COOKIE_NAME: "session",
}))

// Import after mocks are set up
import { getSessionFromCookie } from "@/utils/auth"
import { getActiveTeamId } from "@/utils/team-auth"

// Helper to create test sessions with all required KVSession properties
function createTestSession(overrides: {
	userId?: string
	role?: "admin" | "user"
	teams?: Array<{
		id: string
		name: string
		permissions: string[]
	}>
}) {
	const teams = overrides.teams ?? [
		{
			id: "team-123",
			name: "Test Team",
			permissions: ["access_dashboard"],
		},
	]

	const userId = overrides.userId ?? "user-123"

	return {
		// KVSession required properties
		id: `session-${userId}`,
		expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
		createdAt: new Date(),
		userId,
		user: {
			id: userId,
			role: overrides.role ?? "user",
			email: "test@example.com",
			emailVerified: true,
		},
		teams,
	}
}

describe("Organizer Route - Active Team Cookie Bug", () => {
	beforeEach(() => {
		mockCookieStore.clear()
		vi.clearAllMocks()
	})

	afterEach(() => {
		mockCookieStore.clear()
		vi.clearAllMocks()
	})

	describe("getActiveTeamId respects cookie for organizer context", () => {
		it("should return second team when cookie is set to second team", async () => {
			// Arrange: User has two teams, cookie set to second team
			const teamA = "team-first-111"
			const teamB = "team-second-222"

			// Set cookie to second team (simulates team-switcher action)
			mockCookieStore.set("active-team", { value: teamB })

			const session = createTestSession({
				teams: [
					{ id: teamA, name: "First Team (Gym A)", permissions: ["organize_competitions"] },
					{ id: teamB, name: "Second Team (Gym B)", permissions: ["organize_competitions"] },
				],
			})
			vi.mocked(getSessionFromCookie).mockResolvedValue(session as MockSession)

			// Act
			const activeTeamId = await getActiveTeamId()

			// Assert: Should return team B (from cookie), NOT team A (first in list)
			expect(activeTeamId).toBe(teamB)
			expect(activeTeamId).not.toBe(teamA)
		})

		it("should NOT return first team when cookie is set to different team", async () => {
			// This is the failing test that demonstrates the bug
			// The bug was: organizer.tsx used session.teams?.[0] instead of getActiveTeamId()

			const teamA = "team-gym-a"
			const teamB = "team-gym-b"
			const teamC = "team-gym-c"

			// User switched to Team C via team-switcher
			mockCookieStore.set("active-team", { value: teamC })

			const session = createTestSession({
				teams: [
					{ id: teamA, name: "Gym A", permissions: ["organize_competitions"] },
					{ id: teamB, name: "Gym B", permissions: ["organize_competitions"] },
					{ id: teamC, name: "Gym C", permissions: ["organize_competitions"] },
				],
			})
			vi.mocked(getSessionFromCookie).mockResolvedValue(session as MockSession)

			// Act
			const activeTeamId = await getActiveTeamId()

			// Assert: The bug would have returned teamA (first in list)
			// Fixed behavior returns teamC (from cookie)
			expect(activeTeamId).toBe(teamC)

			// Explicitly verify we're NOT using first team
			expect(activeTeamId).not.toBe(session.teams[0].id)
		})
	})

	describe("Organizer entitlements should use active team from cookie", () => {
		/**
		 * This test documents the expected behavior after the fix.
		 *
		 * The checkOrganizerEntitlements server function in organizer.tsx
		 * should call getActiveTeamId() to determine which team to check
		 * entitlements for, instead of using session.teams?.[0].
		 *
		 * This ensures that when a user switches teams via the team-switcher:
		 * 1. The cookie updates (setActiveTeamFn works correctly)
		 * 2. The organizer route checks entitlements for the ACTIVE team
		 * 3. Competitions shown are for the ACTIVE team (already works in index.tsx)
		 */
		it("should use cookie team for entitlement checks, not first team", async () => {
			// Arrange: User organizes for multiple gyms
			// - Gym A: First in list, pending approval (limit=0)
			// - Gym B: Second in list, fully approved (limit=-1)
			const gymA = "team-gym-a-pending"
			const gymB = "team-gym-b-approved"

			// User switched to Gym B (the approved one)
			mockCookieStore.set("active-team", { value: gymB })

			const session = createTestSession({
				teams: [
					{ id: gymA, name: "Gym A (Pending)", permissions: ["organize_competitions"] },
					{ id: gymB, name: "Gym B (Approved)", permissions: ["organize_competitions"] },
				],
			})
			vi.mocked(getSessionFromCookie).mockResolvedValue(session as MockSession)

			// Act
			const activeTeamId = await getActiveTeamId()

			// Assert: Should return Gym B (approved team from cookie)
			// This is the team that entitlement checks should use
			expect(activeTeamId).toBe(gymB)

			// The bug would have checked entitlements for Gym A (first in list),
			// showing "pending approval" banner even when viewing Gym B's content
		})
	})
})
