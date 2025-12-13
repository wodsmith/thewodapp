import { createWorkoutAction, createWorkoutRemixAction, updateWorkoutAction } from "@/actions/workout-actions"
import { getDb } from "@/db"
import { teamTable, workouts } from "@/db/schema"
import { beforeAll, expect, test, describe, it, vi, beforeEach, afterEach } from "vitest"
import { requireVerifiedEmail } from "@/utils/auth"
import { canUserEditWorkout, shouldCreateRemix } from "@/utils/workout-permissions"
import { createWorkoutRemix, getWorkoutById, updateWorkout } from "@/server/workouts"
import { hasTeamPermission, requireTeamMembership } from "@/utils/team-auth"
import type { SessionWithMeta } from "@/types"

// Mock the dependencies
vi.mock("@/utils/auth", () => ({
  requireVerifiedEmail: vi.fn(),
}))

vi.mock("@/utils/workout-permissions", () => ({
  canUserEditWorkout: vi.fn(),
  shouldCreateRemix: vi.fn(),
}))

vi.mock("@/utils/team-auth", () => ({
  requireTeamMembership: vi.fn(),
  hasTeamPermission: vi.fn(),
}))

// Mock createWorkout
const mockCreateWorkout = vi.fn()
vi.mock("@/server/workouts", () => ({
  createWorkout: (...args: any[]) => mockCreateWorkout(...args),
  createWorkoutRemix: vi.fn(),
  getWorkoutById: vi.fn(),
  updateWorkout: vi.fn(),
}))

// Mock dynamic imports used by createWorkoutAction
vi.mock("@/server/tags", () => ({
  findOrCreateTag: vi.fn().mockResolvedValue({ id: "tag-123", name: "Test Tag" }),
}))

vi.mock("@/server/programming-tracks", () => ({
  addWorkoutToTrack: vi.fn().mockResolvedValue(undefined),
  getProgrammingTrackById: vi.fn().mockResolvedValue(null),
  createProgrammingTrack: vi.fn().mockResolvedValue({ id: "track-123" }),
}))

vi.mock("@/server/scheduling-service", () => ({
  scheduleWorkoutForTeam: vi.fn().mockResolvedValue(undefined),
  scheduleStandaloneWorkoutForTeam: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/server/scaling-levels", () => ({
  upsertWorkoutScalingDescriptions: vi.fn().mockResolvedValue(undefined),
  getWorkoutScalingDescriptionsWithLevels: vi.fn().mockResolvedValue([]),
  listScalingLevels: vi.fn().mockResolvedValue([]),
  migrateScalingDescriptions: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

const mockSession: SessionWithMeta = {
  id: "session-123",
  userId: "user-123",
  expiresAt: Date.now() + 86400000,
  createdAt: Date.now(),
  isCurrentSession: true,
  user: {
    id: "user-123",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    emailVerified: new Date(),
    role: "user",
    avatar: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    currentCredits: 100,
    lastCreditRefreshAt: null,
  },
  teams: [
    {
      id: "team-123",
      name: "Test Team",
      slug: "test-team",
      isPersonalTeam: false,
      role: {
        id: "member",
        name: "Member",
        isSystemRole: true,
      },
      permissions: ["access_dashboard", "create_components", "edit_components"],
    },
  ],
}

beforeAll(async () => {
  // Skip database setup for now - focus on unit tests
  // In a real test environment, you would set up test database
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireVerifiedEmail).mockResolvedValue(mockSession)

  // Setup default mocks
  vi.mocked(canUserEditWorkout).mockResolvedValue(true)
  vi.mocked(shouldCreateRemix).mockResolvedValue(true)  // Default to allowing remix
  vi.mocked(createWorkoutRemix).mockResolvedValue({ id: "remix-123" } as any)
  vi.mocked(updateWorkout).mockResolvedValue({} as any)
  vi.mocked(getWorkoutById).mockResolvedValue({ id: "workout-123" } as any)

  // Mock createWorkout to return a valid workout
  mockCreateWorkout.mockResolvedValue({
    id: "new-workout-123",
    name: "Test Workout",
    teamId: "team-123",
  })

  // Mock team auth - allow all by default
  vi.mocked(requireTeamMembership).mockResolvedValue(undefined)
  vi.mocked(hasTeamPermission).mockResolvedValue(true)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("workout actions", () => {
  test("should create a workout with a teamId", async () => {
    const workout = {
      name: "Test Workout",
      description: "Test Description",
      scope: "private" as const,
      scheme: "reps" as const,
      repsPerRound: 10,
      roundsToScore: 5,
      sugarId: null,
      tiebreakScheme: null,
      secondaryScheme: null,
    }

    const [data, err] = await createWorkoutAction({
      workout,
      tagIds: [],
      movementIds: [],
      teamId: "team-123",  // Must match mock session team
    })

    expect(err).toBeNull()
    expect(data).toBeDefined()
    expect(data?.data.teamId).toBe("team-123")
  })

  describe("createWorkoutRemixAction", () => {
    it("should successfully create a remix", async () => {
      const mockRemixResult = {
        id: "remix-123",
        name: "Remixed Workout",
        sourceWorkoutId: "source-123",
        teamId: "team-123",  // Match mock session team
      }

      vi.mocked(createWorkoutRemix).mockResolvedValue(mockRemixResult as any)

      const [data, err] = await createWorkoutRemixAction({
        sourceWorkoutId: "source-123",
        teamId: "team-123",  // Must match mock session team
      })

      expect(err).toBeNull()
      expect(data).toBeDefined()
      expect(data?.success).toBe(true)
      expect(data?.data).toEqual(mockRemixResult)
      expect(createWorkoutRemix).toHaveBeenCalledWith({
        sourceWorkoutId: "source-123",
        teamId: "team-123",
      })
    })

    it("should handle remix creation errors", async () => {
      vi.mocked(createWorkoutRemix).mockRejectedValue(new Error("Permission denied"))

      const [data, err] = await createWorkoutRemixAction({
        sourceWorkoutId: "source-123",
        teamId: "team-123",  // Must match mock session team
      })

      expect(data).toBeNull()
      expect(err).toBeDefined()
      // Error is wrapped as "Failed to create workout remix" by the action
      expect(err?.message).toContain("Failed to create workout remix")
    })
  })

  describe("updateWorkoutAction", () => {
    const mockWorkoutUpdate = {
      name: "Updated Workout",
      description: "Updated description",
      scheme: "reps" as const,
      scope: "private" as const,
    }

    it("should update workout directly when user has edit permissions", async () => {
      vi.mocked(canUserEditWorkout).mockResolvedValue(true)
      vi.mocked(updateWorkout).mockResolvedValue({} as any)

      const [data, err] = await updateWorkoutAction({
        id: "workout-123",
        workout: mockWorkoutUpdate,
        tagIds: [],
        movementIds: [],
      })

      expect(err).toBeNull()
      expect(data?.success).toBe(true)
      expect(data?.action).toBe("updated")
      expect(updateWorkout).toHaveBeenCalledWith({
        id: "workout-123",
        workout: mockWorkoutUpdate,
        tagIds: [],
        movementIds: [],
      })
    })

    it("should create remix when user cannot edit directly", async () => {
      const mockRemixResult = {
        id: "remix-123",
        name: "Remixed Workout",
        sourceWorkoutId: "workout-123",
        teamId: "team-123",  // Must match mock session team
      }

      vi.mocked(canUserEditWorkout).mockResolvedValue(false)
      vi.mocked(createWorkoutRemix).mockResolvedValue(mockRemixResult as any)
      vi.mocked(updateWorkout).mockResolvedValue({} as any)

      const [data, err] = await updateWorkoutAction({
        id: "workout-123",
        workout: mockWorkoutUpdate,
        tagIds: [],
        movementIds: [],
      })

      expect(err).toBeNull()
      expect(data?.success).toBe(true)
      expect(data?.action).toBe("remixed")
      expect(data?.data).toEqual(mockRemixResult)
      expect(createWorkoutRemix).toHaveBeenCalledWith({
        sourceWorkoutId: "workout-123",
        teamId: "team-123",  // Uses first team from session
      })
      expect(updateWorkout).toHaveBeenCalledWith({
        id: "remix-123",
        workout: mockWorkoutUpdate,
        tagIds: [],
        movementIds: [],
      })
    })

    it("should throw error when user has no teams", async () => {
      const sessionWithoutTeams = { ...mockSession, teams: [] }
      vi.mocked(requireVerifiedEmail).mockResolvedValue(sessionWithoutTeams)
      vi.mocked(canUserEditWorkout).mockResolvedValue(false)

      const [data, err] = await updateWorkoutAction({
        id: "workout-123",
        workout: mockWorkoutUpdate,
        tagIds: [],
        movementIds: [],
      })

      expect(data).toBeNull()
      expect(err).toBeDefined()
      expect(err?.message).toContain("must be a member of at least one team")
    })

    it("should handle remix creation failure", async () => {
      vi.mocked(canUserEditWorkout).mockResolvedValue(false)
      vi.mocked(createWorkoutRemix).mockResolvedValue(null)

      const [data, err] = await updateWorkoutAction({
        id: "workout-123",
        workout: mockWorkoutUpdate,
        tagIds: [],
        movementIds: [],
      })

      expect(data).toBeNull()
      expect(err).toBeDefined()
      expect(err?.message).toContain("Failed to create workout remix")
    })

    it("should handle authentication errors", async () => {
      vi.mocked(requireVerifiedEmail).mockRejectedValue(
        new Error("Not authenticated")
      )

      const [data, err] = await updateWorkoutAction({
        id: "workout-123",
        workout: mockWorkoutUpdate,
        tagIds: [],
        movementIds: [],
      })

      expect(data).toBeNull()
      expect(err).toBeDefined()
      // Generic errors are caught and converted to "Failed to update workout"
      expect(err?.message).toContain("Failed to update workout")
    })
  })
})
