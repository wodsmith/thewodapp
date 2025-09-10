import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { canUserEditWorkout, shouldCreateRemix, getWorkoutPermissions } from "@/utils/workout-permissions"
import { requireVerifiedEmail } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"
import { getDd } from "@/db"
import { eq } from "drizzle-orm"
import { workouts } from "@/db/schema"
import type { Session } from "@/types"

// Mock the dependencies
vi.mock("@/utils/auth", () => ({
	requireVerifiedEmail: vi.fn(),
}))

vi.mock("@/utils/team-auth", () => ({
	hasTeamPermission: vi.fn(),
}))

vi.mock("@/db", () => ({
	getDd: vi.fn(() => ({
		query: {
			workouts: {
				findFirst: vi.fn(),
			},
		},
	})),
}))

vi.mock("@/db/schema", () => ({
	workouts: {},
	TEAM_PERMISSIONS: {
		EDIT_COMPONENTS: "edit_components",
	},
}))

vi.mock("drizzle-orm", () => ({
	eq: vi.fn(),
}))

describe("workout-permissions", () => {
	const mockSession: Session = {
		user: {
			id: "user-123",
			email: "test@example.com",
			name: "Test User",
			emailVerified: true,
		},
		teams: [
			{
				id: "team-123",
				name: "Test Team",
				isPersonalTeam: 0,
			},
		],
	}

	const mockWorkout = {
		id: "workout-123",
		teamId: "team-123",
		sourceWorkoutId: null,
		sourceTrackId: null,
		scope: "public" as const,
	}

	const mockRemixWorkout = {
		id: "workout-456",
		teamId: "team-123",
		sourceWorkoutId: "workout-123",
		sourceTrackId: null,
		scope: "private" as const,
	}

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup default mocks
		vi.mocked(requireVerifiedEmail).mockResolvedValue(mockSession)
		vi.mocked(hasTeamPermission).mockResolvedValue(true)

		const mockFindFirst = vi.fn()
		const mockDb = vi.mocked(getDd)()
		mockDb.query.workouts.findFirst = mockFindFirst
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("canUserEditWorkout", () => {
		it("should return true for workout owned by user's team with edit permissions", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue(mockWorkout)

			const result = await canUserEditWorkout("workout-123")

			expect(result).toBe(true)
			expect(mockDb.query.workouts.findFirst).toHaveBeenCalledWith({
				where: expect.any(Function),
				columns: {
					id: true,
					teamId: true,
					sourceWorkoutId: true,
					sourceTrackId: true,
					scope: true,
				},
			})
		})

		it("should return false if user is not authenticated", async () => {
			vi.mocked(requireVerifiedEmail).mockResolvedValue(null)

			const result = await canUserEditWorkout("workout-123")

			expect(result).toBe(false)
			expect(requireVerifiedEmail).toHaveBeenCalled()
		})

		it("should return false if workout doesn't exist", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue(null)

			const result = await canUserEditWorkout("workout-123")

			expect(result).toBe(false)
		})

		it("should return false if workout doesn't belong to a team", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue({
				...mockWorkout,
				teamId: null,
			})

			const result = await canUserEditWorkout("workout-123")

			expect(result).toBe(false)
		})

		it("should return false if user is not a team member", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue({
				...mockWorkout,
				teamId: "different-team",
			})

			const result = await canUserEditWorkout("workout-123")

			expect(result).toBe(false)
		})

		it("should return false if user lacks edit permissions", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue(mockWorkout)
			vi.mocked(hasTeamPermission).mockResolvedValue(false)

			const result = await canUserEditWorkout("workout-123")

			expect(result).toBe(false)
			expect(hasTeamPermission).toHaveBeenCalledWith("team-123", "edit_components")
		})

		it("should return false if workout is already a remix", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue(mockRemixWorkout)

			const result = await canUserEditWorkout("workout-456")

			expect(result).toBe(false)
		})
	})

	describe("shouldCreateRemix", () => {
		it("should return true if user is not authenticated", async () => {
			vi.mocked(requireVerifiedEmail).mockResolvedValue(null)

			const result = await shouldCreateRemix("workout-123")

			expect(result).toBe(true)
		})

		it("should return true if workout doesn't exist", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue(null)

			const result = await shouldCreateRemix("workout-123")

			expect(result).toBe(true)
		})

		it("should return true if workout doesn't belong to a team", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue({
				...mockWorkout,
				teamId: null,
			})

			const result = await shouldCreateRemix("workout-123")

			expect(result).toBe(true)
		})

		it("should return true if user is not a team member", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue({
				...mockWorkout,
				teamId: "different-team",
			})

			const result = await shouldCreateRemix("workout-123")

			expect(result).toBe(true)
		})

		it("should return true if user lacks edit permissions", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue(mockWorkout)
			vi.mocked(hasTeamPermission).mockResolvedValue(false)

			const result = await shouldCreateRemix("workout-123")

			expect(result).toBe(true)
			expect(hasTeamPermission).toHaveBeenCalledWith("team-123", "edit_components")
		})

		it("should return true if workout is already a remix", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue(mockRemixWorkout)

			const result = await shouldCreateRemix("workout-456")

			expect(result).toBe(true)
		})

		it("should return false if user can edit directly", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue(mockWorkout)
			vi.mocked(hasTeamPermission).mockResolvedValue(true)

			const result = await shouldCreateRemix("workout-123")

			expect(result).toBe(false)
		})
	})

	describe("getWorkoutPermissions", () => {
		it("should return comprehensive permissions for editable workout", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue(mockWorkout)
			vi.mocked(hasTeamPermission).mockResolvedValue(true)

			const result = await getWorkoutPermissions("workout-123")

			expect(result).toEqual({
				canEdit: true,
				canRemix: false,
				reason: "User has direct edit permissions for this workout",
			})
		})

		it("should return remix permissions for non-editable workout", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue(mockRemixWorkout)
			vi.mocked(hasTeamPermission).mockResolvedValue(true)

			const result = await getWorkoutPermissions("workout-456")

			expect(result).toEqual({
				canEdit: false,
				canRemix: true,
				reason: "User should create a remix instead of editing directly",
			})
		})

		it("should handle edge case where neither edit nor remix is possible", async () => {
			const mockDb = vi.mocked(getDd)()
			mockDb.query.workouts.findFirst.mockResolvedValue(null)

			const result = await getWorkoutPermissions("workout-999")

			expect(result.canEdit).toBe(false)
			expect(result.canRemix).toBe(true)
			expect(result.reason).toBe("User should create a remix instead of editing directly")
		})
	})
})
