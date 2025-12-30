import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { canUserEditWorkout, shouldCreateRemix, getWorkoutPermissions } from "@/utils/workout-permissions"
import { requireVerifiedEmail } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"
import { getDb } from "@/db"
import { eq } from "drizzle-orm"
import { workouts } from "@/db/schema"
import type { KVSession } from "@/utils/kv-session"
import { createTestSession } from "@repo/test-utils/factories"

// Mock the dependencies
vi.mock("@/utils/auth", () => ({
  requireVerifiedEmail: vi.fn(),
}))

vi.mock("@/utils/team-auth", () => ({
  hasTeamPermission: vi.fn(),
}))

const mockFindFirst = vi.fn()

vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({
    query: {
      workouts: {
        findFirst: mockFindFirst,
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
  const mockSession = createTestSession({
    userId: "user-123",
    teamId: "team-123",
    teamSlug: "test-team",
    user: {
      id: "user-123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      role: "user",
      emailVerified: new Date(),
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentCredits: 100,
      lastCreditRefreshAt: null,
    },
    permissions: ["access_dashboard", "create_components", "edit_components"],
  })

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
    mockFindFirst.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("canUserEditWorkout", () => {
    it("should return true for workout owned by user's team with edit permissions", async () => {
      mockFindFirst.mockResolvedValue(mockWorkout)

      const result = await canUserEditWorkout("workout-123")

      expect(result).toBe(true)
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: undefined,
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
      vi.mocked(requireVerifiedEmail).mockRejectedValue(
        new Error("Not authenticated")
      )

      const result = await canUserEditWorkout("workout-123")

      expect(result).toBe(false)
      expect(requireVerifiedEmail).toHaveBeenCalled()
    })

    it("should return false if workout doesn't exist", async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await canUserEditWorkout("workout-123")

      expect(result).toBe(false)
    })

    it("should return false if workout doesn't belong to a team", async () => {
      mockFindFirst.mockResolvedValue({
        ...mockWorkout,
        teamId: null,
      })

      const result = await canUserEditWorkout("workout-123")

      expect(result).toBe(false)
    })

    it("should return false if user is not a team member", async () => {
      mockFindFirst.mockResolvedValue({
        ...mockWorkout,
        teamId: "different-team",
      })

      const result = await canUserEditWorkout("workout-123")

      expect(result).toBe(false)
    })

    it("should return false if user lacks edit permissions", async () => {
      mockFindFirst.mockResolvedValue(mockWorkout)
      vi.mocked(hasTeamPermission).mockResolvedValue(false)

      const result = await canUserEditWorkout("workout-123")

      expect(result).toBe(false)
      expect(hasTeamPermission).toHaveBeenCalledWith("team-123", "edit_components")
    })

    it("should return true if workout is a remix in user's own team", async () => {
      // Users can edit any workout in their team, including remixes
      mockFindFirst.mockResolvedValue(mockRemixWorkout)

      const result = await canUserEditWorkout("workout-456")

      expect(result).toBe(true)
    })
  })

  describe("shouldCreateRemix", () => {
    it("should return true if user is not authenticated", async () => {
      vi.mocked(requireVerifiedEmail).mockRejectedValue(
        new Error("Not authenticated")
      )

      const result = await shouldCreateRemix("workout-123")

      expect(result).toBe(true)
    })

    it("should return true if workout doesn't exist", async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await shouldCreateRemix("workout-123")

      expect(result).toBe(true)
    })

    it("should return true if workout doesn't belong to a team", async () => {
      mockFindFirst.mockResolvedValue({
        ...mockWorkout,
        teamId: null,
      })

      const result = await shouldCreateRemix("workout-123")

      expect(result).toBe(true)
    })

    it("should return true if user is not a team member", async () => {
      mockFindFirst.mockResolvedValue({
        ...mockWorkout,
        teamId: "different-team",
      })

      const result = await shouldCreateRemix("workout-123")

      expect(result).toBe(true)
    })

    it("should return true if user lacks edit permissions", async () => {
      mockFindFirst.mockResolvedValue(mockWorkout)
      vi.mocked(hasTeamPermission).mockResolvedValue(false)

      const result = await shouldCreateRemix("workout-123")

      expect(result).toBe(true)
      expect(hasTeamPermission).toHaveBeenCalledWith("team-123", "edit_components")
    })

    it("should return false if workout is a remix in user's own team (can edit directly)", async () => {
      // Users can edit remixes in their own team, so no need to create another remix
      mockFindFirst.mockResolvedValue(mockRemixWorkout)

      const result = await shouldCreateRemix("workout-456")

      expect(result).toBe(false)
    })

    it("should return false if user can edit directly", async () => {
      mockFindFirst.mockResolvedValue(mockWorkout)
      vi.mocked(hasTeamPermission).mockResolvedValue(true)

      const result = await shouldCreateRemix("workout-123")

      expect(result).toBe(false)
    })
  })

  describe("getWorkoutPermissions", () => {
    it("should return comprehensive permissions for editable workout", async () => {
      mockFindFirst.mockResolvedValue(mockWorkout)
      vi.mocked(hasTeamPermission).mockResolvedValue(true)

      const result = await getWorkoutPermissions("workout-123")

      expect(result).toEqual({
        canEdit: true,
        canRemix: false,
        reason: "User has direct edit permissions for this workout",
      })
    })

    it("should return edit permissions for remix in user's own team", async () => {
      // Remixes in user's own team can be edited directly
      mockFindFirst.mockResolvedValue(mockRemixWorkout)
      vi.mocked(hasTeamPermission).mockResolvedValue(true)

      const result = await getWorkoutPermissions("workout-456")

      expect(result).toEqual({
        canEdit: true,
        canRemix: false,
        reason: "User has direct edit permissions for this workout",
      })
    })

    it("should handle edge case where neither edit nor remix is possible", async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await getWorkoutPermissions("workout-999")

      expect(result.canEdit).toBe(false)
      expect(result.canRemix).toBe(true)
      expect(result.reason).toBe("User should create a remix instead of editing directly")
    })
  })
})