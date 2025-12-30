import {beforeEach, describe, expect, it, vi} from 'vitest'
import {getWorkoutLeaderboardFn} from '@/server-fns/workout-leaderboard-fns'

// Create query results that we can control per test
let instancesResult: unknown[] = []
let scoresResult: unknown[] = []
let queryCallCount = 0

// Create a mock db that returns different results for different query calls
const mockDb = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  orderBy: vi.fn(() => mockDb),
  innerJoin: vi.fn(() => mockDb),
  leftJoin: vi.fn(() => mockDb),
  // Make it thenable - first call returns instances, subsequent calls return scores
  then: (resolve: (value: unknown) => void) => {
    queryCallCount++
    if (queryCallCount === 1) {
      resolve(instancesResult)
      return Promise.resolve(instancesResult)
    }
    resolve(scoresResult)
    return Promise.resolve(scoresResult)
  },
}

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Create test sessions
const mockAuthenticatedSession = {
  userId: 'test-user-123',
  user: {
    id: 'test-user-123',
    email: 'test@example.com',
  },
  teams: [
    {
      id: 'team-1',
      permissions: ['manage_programming'],
    },
  ],
}

// Mock auth - default to authenticated
vi.mock('@/utils/auth', () => ({
  getSessionFromCookie: vi.fn(() => Promise.resolve(mockAuthenticatedSession)),
}))

// Mock TanStack createServerFn to make server functions directly callable in tests
// This mock validates input before calling handler
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    return {
      handler: (fn: ReturnType<typeof vi.fn>) => {
        return fn
      },
      inputValidator: (validator: (data: unknown) => unknown) => ({
        handler: (fn: (ctx: {data: unknown}) => Promise<unknown>) => {
          // Return a wrapper that validates input then calls handler
          return async (ctx: {data: unknown}) => {
            // Run validation - will throw on invalid input
            const validatedData = validator(ctx.data)
            return fn({data: validatedData})
          }
        },
      }),
    }
  },
}))

// Import mocked getSessionFromCookie so we can change its behavior in tests
import {getSessionFromCookie} from '@/utils/auth'

// Helper to set mock session with proper type coercion
const setMockSession = (session: unknown) => {
  vi.mocked(getSessionFromCookie).mockResolvedValue(
    session as Awaited<ReturnType<typeof getSessionFromCookie>>,
  )
}

// Helper to set mock query results
const setMockResults = (instances: unknown[], scores: unknown[]) => {
  instancesResult = instances
  scoresResult = scores
  queryCallCount = 0
}

// Factory for creating scheduled workout instances
function createScheduledInstance(
  overrides?: Partial<{
    id: string
    teamId: string
    workoutId: string
    scheduledDate: Date
  }>,
) {
  return {
    id: overrides?.id ?? `instance-${Math.random().toString(36).slice(2, 8)}`,
    teamId: overrides?.teamId ?? 'team-1',
    workoutId: overrides?.workoutId ?? 'workout-1',
    scheduledDate: overrides?.scheduledDate ?? new Date(),
    ...overrides,
  }
}

// Factory for creating workout scores
function createScore(
  overrides?: Partial<{
    scoreId: string
    userId: string
    scoreValue: number | null
    scheme: string
    scoreType: string | null
    asRx: boolean
    scheduledWorkoutInstanceId: string
    userName: string
    userLastName: string
    scalingLabel: string | null
  }>,
) {
  return {
    scoreId:
      overrides?.scoreId ?? `score-${Math.random().toString(36).slice(2, 8)}`,
    userId: overrides?.userId ?? 'user-1',
    scoreValue: overrides?.scoreValue ?? 120000, // 2 minutes in ms
    scheme: overrides?.scheme ?? 'time',
    scoreType: overrides?.scoreType ?? null,
    asRx: overrides?.asRx ?? true,
    scheduledWorkoutInstanceId:
      overrides?.scheduledWorkoutInstanceId ?? 'instance-1',
    userName: overrides?.userName ?? 'John',
    userLastName: overrides?.userLastName ?? 'Doe',
    scalingLabel: overrides?.scalingLabel ?? null,
    ...overrides,
  }
}

describe('Workout Leaderboard Server Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock results
    instancesResult = []
    scoresResult = []
    queryCallCount = 0
    // Reset to authenticated session
    setMockSession(mockAuthenticatedSession)
  })

  describe('getWorkoutLeaderboardFn', () => {
    it('returns leaderboards for scheduled instances', async () => {
      const instances = [
        createScheduledInstance({
          id: 'instance-1',
          workoutId: 'workout-1',
          scheduledDate: new Date('2025-01-15'),
        }),
      ]

      const scores = [
        createScore({
          scoreId: 'score-1',
          userId: 'user-1',
          scoreValue: 120000, // 2:00
          scheduledWorkoutInstanceId: 'instance-1',
          userName: 'John',
          userLastName: 'Doe',
          asRx: true,
        }),
        createScore({
          scoreId: 'score-2',
          userId: 'user-2',
          scoreValue: 150000, // 2:30
          scheduledWorkoutInstanceId: 'instance-1',
          userName: 'Jane',
          userLastName: 'Smith',
          asRx: true,
        }),
      ]

      setMockResults(instances, scores)

      const result = await getWorkoutLeaderboardFn({
        data: {workoutId: 'workout-1', teamId: 'team-1'},
      })

      expect(result.leaderboards).toHaveLength(1)
      expect(result.leaderboards[0].entries).toHaveLength(2)
      expect(result.leaderboards[0].instanceId).toBe('instance-1')
    })

    it('returns empty array when no instances exist', async () => {
      setMockResults([], [])

      const result = await getWorkoutLeaderboardFn({
        data: {workoutId: 'workout-1', teamId: 'team-1'},
      })

      expect(result.leaderboards).toEqual([])
    })

    it('returns empty entries when no scores exist', async () => {
      const instances = [
        createScheduledInstance({
          id: 'instance-1',
          workoutId: 'workout-1',
          scheduledDate: new Date('2025-01-15'),
        }),
      ]

      setMockResults(instances, [])

      const result = await getWorkoutLeaderboardFn({
        data: {workoutId: 'workout-1', teamId: 'team-1'},
      })

      // Instances with no scores are skipped
      expect(result.leaderboards).toEqual([])
    })

    it('sorts by Rx status first, then score', async () => {
      const instances = [
        createScheduledInstance({
          id: 'instance-1',
          workoutId: 'workout-1',
          scheduledDate: new Date('2025-01-15'),
        }),
      ]

      const scores = [
        createScore({
          scoreId: 'score-1',
          userId: 'user-1',
          scoreValue: 180000, // 3:00 - scaled but faster
          scheduledWorkoutInstanceId: 'instance-1',
          userName: 'Scaled',
          userLastName: 'Fast',
          asRx: false, // Scaled
        }),
        createScore({
          scoreId: 'score-2',
          userId: 'user-2',
          scoreValue: 240000, // 4:00 - Rx but slower
          scheduledWorkoutInstanceId: 'instance-1',
          userName: 'Rx',
          userLastName: 'Slow',
          asRx: true, // Rx
        }),
      ]

      setMockResults(instances, scores)

      const result = await getWorkoutLeaderboardFn({
        data: {workoutId: 'workout-1', teamId: 'team-1'},
      })

      // Rx should be ranked first even though slower
      expect(result.leaderboards[0].entries[0].userName).toBe('Rx Slow')
      expect(result.leaderboards[0].entries[0].asRx).toBe(true)
      expect(result.leaderboards[0].entries[1].userName).toBe('Scaled Fast')
      expect(result.leaderboards[0].entries[1].asRx).toBe(false)
    })

    it('sorts time-based scores ascending', async () => {
      const instances = [
        createScheduledInstance({
          id: 'instance-1',
          workoutId: 'workout-1',
          scheduledDate: new Date('2025-01-15'),
        }),
      ]

      const scores = [
        createScore({
          scoreId: 'score-1',
          userId: 'user-1',
          scoreValue: 180000, // 3:00
          scheduledWorkoutInstanceId: 'instance-1',
          userName: 'Second',
          userLastName: 'Place',
          scheme: 'time',
          asRx: true,
        }),
        createScore({
          scoreId: 'score-2',
          userId: 'user-2',
          scoreValue: 120000, // 2:00
          scheduledWorkoutInstanceId: 'instance-1',
          userName: 'First',
          userLastName: 'Place',
          scheme: 'time',
          asRx: true,
        }),
      ]

      setMockResults(instances, scores)

      const result = await getWorkoutLeaderboardFn({
        data: {workoutId: 'workout-1', teamId: 'team-1'},
      })

      // Lower time should be first
      expect(result.leaderboards[0].entries[0].userName).toBe('First Place')
      expect(result.leaderboards[0].entries[0].displayScore).toBe('2:00')
      expect(result.leaderboards[0].entries[1].userName).toBe('Second Place')
      expect(result.leaderboards[0].entries[1].displayScore).toBe('3:00')
    })

    it('sorts rep-based scores descending', async () => {
      const instances = [
        createScheduledInstance({
          id: 'instance-1',
          workoutId: 'workout-1',
          scheduledDate: new Date('2025-01-15'),
        }),
      ]

      const scores = [
        createScore({
          scoreId: 'score-1',
          userId: 'user-1',
          scoreValue: 100,
          scheduledWorkoutInstanceId: 'instance-1',
          userName: 'Second',
          userLastName: 'Place',
          scheme: 'reps',
          asRx: true,
        }),
        createScore({
          scoreId: 'score-2',
          userId: 'user-2',
          scoreValue: 150,
          scheduledWorkoutInstanceId: 'instance-1',
          userName: 'First',
          userLastName: 'Place',
          scheme: 'reps',
          asRx: true,
        }),
      ]

      setMockResults(instances, scores)

      const result = await getWorkoutLeaderboardFn({
        data: {workoutId: 'workout-1', teamId: 'team-1'},
      })

      // Higher reps should be first
      expect(result.leaderboards[0].entries[0].userName).toBe('First Place')
      expect(result.leaderboards[0].entries[0].displayScore).toBe('150 reps')
      expect(result.leaderboards[0].entries[1].userName).toBe('Second Place')
      expect(result.leaderboards[0].entries[1].displayScore).toBe('100 reps')
    })

    it('throws when workoutId is empty', async () => {
      await expect(
        getWorkoutLeaderboardFn({
          data: {workoutId: '', teamId: 'team-1'},
        }),
      ).rejects.toThrow()
    })

    it('throws when teamId is empty', async () => {
      await expect(
        getWorkoutLeaderboardFn({
          data: {workoutId: 'workout-1', teamId: ''},
        }),
      ).rejects.toThrow()
    })

    it('groups scores by instance date', async () => {
      const instances = [
        createScheduledInstance({
          id: 'instance-1',
          workoutId: 'workout-1',
          scheduledDate: new Date('2025-01-15'),
        }),
        createScheduledInstance({
          id: 'instance-2',
          workoutId: 'workout-1',
          scheduledDate: new Date('2025-01-22'),
        }),
      ]

      const scores = [
        createScore({
          scoreId: 'score-1',
          userId: 'user-1',
          scoreValue: 120000,
          scheduledWorkoutInstanceId: 'instance-1',
          userName: 'Week1',
          userLastName: 'User',
        }),
        createScore({
          scoreId: 'score-2',
          userId: 'user-2',
          scoreValue: 130000,
          scheduledWorkoutInstanceId: 'instance-2',
          userName: 'Week2',
          userLastName: 'User',
        }),
      ]

      setMockResults(instances, scores)

      const result = await getWorkoutLeaderboardFn({
        data: {workoutId: 'workout-1', teamId: 'team-1'},
      })

      expect(result.leaderboards).toHaveLength(2)
      expect(result.leaderboards[0].instanceId).toBe('instance-1')
      expect(result.leaderboards[0].entries[0].userName).toBe('Week1 User')
      expect(result.leaderboards[1].instanceId).toBe('instance-2')
      expect(result.leaderboards[1].entries[0].userName).toBe('Week2 User')
    })
  })
})
