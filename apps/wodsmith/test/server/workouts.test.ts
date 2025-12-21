import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { requireVerifiedEmail } from "@/utils/auth"
import { getDb } from "@/db"
import { workouts, workoutTags, workoutMovements } from "@/db/schema"
import { createTestSession } from "@repo/test-utils/factories"

// Mock the dependencies
vi.mock("@/utils/auth", () => ({
  requireVerifiedEmail: vi.fn(),
}))

vi.mock("@/db", () => ({
  getDb: vi.fn(),
}))

vi.mock("@/db/schema", () => ({
  workouts: {},
  workoutTags: {},
  workoutMovements: {},
  programmingTracksTable: {},
  teamTable: {},
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  inArray: vi.fn(),
  isNotNull: vi.fn(),
  and: vi.fn(),
  count: vi.fn(),
  desc: vi.fn(),
  or: vi.fn(),
}))

// Import functions first
import { createWorkoutRemix, getWorkoutById, getUserWorkouts } from "@/server/workouts"

// Mock the server functions individually
const mockCreateWorkoutRemix = vi.fn()
const mockGetWorkoutById = vi.fn()
const mockGetUserWorkouts = vi.fn()

vi.mock("@/server/workouts", () => ({
  createWorkoutRemix: (...args: any[]) => mockCreateWorkoutRemix(...args),
  getWorkoutById: (...args: any[]) => mockGetWorkoutById(...args),
  getUserWorkouts: (...args: any[]) => mockGetUserWorkouts(...args),
}))

describe("workouts server functions", () => {
  const mockSession = createTestSession({
    userId: "user-123",
    teamId: "team-123",
    teamSlug: "test-team",
  })

  const mockSourceWorkout = {
    id: "workout-123",
    name: "Source Workout",
    description: "Original workout description",
    scheme: "reps" as const,
    scope: "public" as const,
    repsPerRound: 10,
    roundsToScore: 5,
    sugarId: null,
    tiebreakScheme: null,
    teamId: "team-456", // Different team
    sourceWorkoutId: null,
    sourceTrackId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    updateCounter: 0,
    tags: [{ id: "tag-1", name: "Strength" }],
    movements: [{ id: "movement-1", name: "Squat", type: "weightlifting" }],
    resultsToday: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    vi.mocked(requireVerifiedEmail).mockResolvedValue(mockSession)
    vi.mocked(getDb).mockReturnValue({
      query: {
        workouts: {
          findFirst: vi.fn(),
        },
      },
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  id: "remix-workout-123",
                  name: "Remixed Workout",
                  scope: "private",
                  teamId: "team-123",
                  sourceWorkoutId: "workout-123",
                }),
              }),
            }),
          }),
        }
        return await callback(tx)
      }),
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("createWorkoutRemix", () => {
    it("should create a remix workout successfully", async () => {
      const mockRemixResult = {
        id: "remix-workout-123",
        name: "Source Workout",
        description: "Original workout description",
        scheme: "reps",
        scope: "private",
        teamId: "team-123",
        sourceWorkoutId: "workout-123",
      }

      mockCreateWorkoutRemix.mockResolvedValue(mockRemixResult)

      const result = await createWorkoutRemix({
        sourceWorkoutId: "workout-123",
        teamId: "team-123",
      })

      expect(result).toBeDefined()
      expect(result?.name).toBe("Source Workout")
      expect(result?.scope).toBe("private")
      expect(result?.sourceWorkoutId).toBe("workout-123")
      expect(result?.teamId).toBe("team-123")
    })

    it("should throw error if user is not authenticated", async () => {
      mockCreateWorkoutRemix.mockRejectedValue(new Error("User must be authenticated"))

      await expect(
        createWorkoutRemix({
          sourceWorkoutId: "workout-123",
          teamId: "team-123",
        })
      ).rejects.toThrow("User must be authenticated")
    })

    it("should throw error if source workout doesn't exist", async () => {
      mockCreateWorkoutRemix.mockRejectedValue(new Error("Source workout not found"))

      await expect(
        createWorkoutRemix({
          sourceWorkoutId: "nonexistent-workout",
          teamId: "team-123",
        })
      ).rejects.toThrow("Source workout not found")
    })

    it("should throw error if user doesn't have permission to view source workout", async () => {
      mockCreateWorkoutRemix.mockRejectedValue(new Error("You don't have permission to view the source workout"))

      await expect(
        createWorkoutRemix({
          sourceWorkoutId: "workout-123",
          teamId: "team-123",
        })
      ).rejects.toThrow("You don't have permission to view the source workout")
    })

    it("should copy tags and movements from source workout", async () => {
      const mockRemixResult = {
        id: "remix-workout-123",
        name: "Source Workout",
        scope: "private",
        teamId: "team-123",
        sourceWorkoutId: "workout-123",
        tags: [{ id: "tag-1", name: "Strength" }],
        movements: [{ id: "movement-1", name: "Squat", type: "weightlifting" }],
      }

      mockCreateWorkoutRemix.mockResolvedValue(mockRemixResult)

      const result = await createWorkoutRemix({
        sourceWorkoutId: "workout-123",
        teamId: "team-123",
      })

      expect(result?.tags).toEqual([{ id: "tag-1", name: "Strength" }])
      expect(result?.movements).toEqual([{ id: "movement-1", name: "Squat", type: "weightlifting" }])
    })
  })

  describe("getUserWorkouts", () => {
    it("should return workouts with remix information", async () => {
      const mockWorkouts = [
        {
          id: "workout-123",
          name: "Original Workout",
          sourceWorkoutId: null,
          teamId: "team-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          updateCounter: 0,
          sourceWorkout: null,
          remixCount: 2,
        },
        {
          id: "workout-456",
          name: "Remix Workout",
          sourceWorkoutId: "workout-123",
          teamId: "team-456",
          createdAt: new Date(),
          updatedAt: new Date(),
          updateCounter: 0,
          sourceWorkout: {
            id: "workout-123",
            name: "Original Workout",
            teamName: "Original Team",
          },
          remixCount: 0,
        },
      ]

      mockGetUserWorkouts.mockResolvedValue(mockWorkouts)

      const result = await getUserWorkouts({ teamId: "team-123" })

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty("sourceWorkout")
      expect(result[0]).toHaveProperty("remixCount")
      expect(result[0].remixCount).toBe(2)
      expect(result[1].sourceWorkout).toBeDefined()
      expect(result[1].sourceWorkout?.name).toBe("Original Workout")
    })

    it("should handle empty workout list", async () => {
      mockGetUserWorkouts.mockResolvedValue([])

      const result = await getUserWorkouts({ teamId: "team-123" })

      expect(result).toEqual([])
    })
  })
})
