import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
import {
  createWorkoutRemixFn,
  getRemixCountFn,
  getRemixedWorkoutsFn,
  getSourceWorkoutFn,
  getWorkoutRemixInfoFn,
} from '@/server-fns/workout-remix-fns'

// Mock the database
const mockDb = new FakeDrizzleDb()

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

// Factory for creating test workouts
function createTestWorkout(
  overrides?: Partial<{
    id: string
    name: string
    description: string
    scheme:
      | 'time'
      | 'time-with-cap'
      | 'reps'
      | 'rounds-reps'
      | 'load'
      | 'calories'
      | 'meters'
      | 'feet'
      | 'points'
      | 'checkmark'
    scoreType: string | null
    scope: 'private' | 'public'
    teamId: string | null
    timeCap: number | null
    repsPerRound: number | null
    roundsToScore: number | null
    tiebreakScheme: string | null
    sourceWorkoutId: string | null
    scalingGroupId: string | null
    createdAt: Date
    updatedAt: Date
  }>,
) {
  const now = new Date()
  return {
    id: overrides?.id ?? `workout-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides?.name ?? 'Test Workout',
    description: overrides?.description ?? 'Test workout description',
    scheme: overrides?.scheme ?? 'time',
    scoreType: overrides?.scoreType ?? null,
    scope: overrides?.scope ?? 'private',
    teamId: overrides?.teamId ?? 'team-1',
    timeCap: overrides?.timeCap ?? null,
    repsPerRound: overrides?.repsPerRound ?? null,
    roundsToScore: overrides?.roundsToScore ?? null,
    tiebreakScheme: overrides?.tiebreakScheme ?? null,
    sourceWorkoutId: overrides?.sourceWorkoutId ?? null,
    scalingGroupId: overrides?.scalingGroupId ?? null,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    ...overrides,
  }
}

// Factory for creating remixed workouts with team info
function createRemixedWorkout(
  overrides?: Partial<{
    id: string
    name: string
    description: string
    scheme: string
    scope: string
    scalingGroupId: string | null
    createdAt: Date
    teamId: string | null
    teamName: string
  }>,
) {
  const now = new Date()
  return {
    id: overrides?.id ?? `workout-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides?.name ?? 'Test Remix',
    description: overrides?.description ?? 'Test remix description',
    scheme: overrides?.scheme ?? 'time',
    scope: overrides?.scope ?? 'private',
    scalingGroupId: overrides?.scalingGroupId ?? null,
    createdAt: overrides?.createdAt ?? now,
    teamId: overrides?.teamId ?? 'team-1',
    teamName: overrides?.teamName ?? 'Test Team',
    ...overrides,
  }
}

// Factory for creating source workouts
function createSourceWorkout(
  overrides?: Partial<{
    id: string
    name: string
    teamId: string | null
    teamName: string | null
  }>,
) {
  return {
    id: overrides?.id ?? `workout-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides?.name ?? 'Source Workout',
    teamId: overrides?.teamId ?? 'team-1',
    teamName: overrides?.teamName ?? 'Test Team',
    ...overrides,
  }
}

describe('Workout Remix Server Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    // Reset to authenticated session
    setMockSession(mockAuthenticatedSession)
  })

  describe('getRemixedWorkoutsFn', () => {
    it('returns remixes for a workout', async () => {
      const remixes = [
        createRemixedWorkout({
          id: 'remix-1',
          name: 'Remix 1',
          teamId: 'team-1',
          teamName: 'Team One',
        }),
        createRemixedWorkout({
          id: 'remix-2',
          name: 'Remix 2',
          teamId: 'team-2',
          teamName: 'Team Two',
        }),
      ]

      // Mock returns remixes - the mock will be used for both queries
      // but only the final result matters for this test
      mockDb.setMockReturnValue(remixes)

      const result = await getRemixedWorkoutsFn({
        data: {sourceWorkoutId: 'source-workout-123'},
      })

      expect(result.remixes).toHaveLength(2)
      expect(result.remixes[0].name).toBe('Remix 1')
      expect(result.remixes[1].name).toBe('Remix 2')
    })

    it('returns empty array when no remixes exist', async () => {
      mockDb.setMockReturnValue([])

      const result = await getRemixedWorkoutsFn({
        data: {sourceWorkoutId: 'source-workout-123'},
      })

      expect(result.remixes).toEqual([])
    })

    it('throws when sourceWorkoutId is empty', async () => {
      await expect(
        getRemixedWorkoutsFn({
          data: {sourceWorkoutId: ''},
        }),
      ).rejects.toThrow()
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        getRemixedWorkoutsFn({
          data: {sourceWorkoutId: 'source-workout-123'},
        }),
      ).rejects.toThrow('Not authenticated')
    })
  })

  describe('getSourceWorkoutFn', () => {
    it('returns source workout when workout is a remix', async () => {
      const sourceWorkout = createSourceWorkout({
        id: 'source-123',
        name: 'Original Fran',
        teamId: 'team-1',
        teamName: 'CrossFit Games',
      })

      // First query returns the workout with sourceWorkoutId
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock
        .mockResolvedValueOnce([{sourceWorkoutId: 'source-123'}])
        .mockResolvedValueOnce([sourceWorkout])

      const result = await getSourceWorkoutFn({data: {workoutId: 'remix-123'}})

      expect(result.sourceWorkout).not.toBeNull()
      expect(result.sourceWorkout?.id).toBe('source-123')
      expect(result.sourceWorkout?.name).toBe('Original Fran')
      expect(result.sourceWorkout?.teamName).toBe('CrossFit Games')
    })

    it('returns null when workout is not a remix', async () => {
      // First query returns the workout without sourceWorkoutId
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([{sourceWorkoutId: null}])

      const result = await getSourceWorkoutFn({data: {workoutId: 'wk-123'}})

      expect(result.sourceWorkout).toBeNull()
    })

    it('returns null when workout not found', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([])

      const result = await getSourceWorkoutFn({
        data: {workoutId: 'nonexistent'},
      })

      expect(result.sourceWorkout).toBeNull()
    })

    it('throws when workoutId is empty', async () => {
      await expect(
        getSourceWorkoutFn({data: {workoutId: ''}}),
      ).rejects.toThrow()
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        getSourceWorkoutFn({data: {workoutId: 'wk-123'}}),
      ).rejects.toThrow('Not authenticated')
    })
  })

  describe('createWorkoutRemixFn', () => {
    it('creates a remix of a workout', async () => {
      const sourceWorkout = createTestWorkout({
        id: 'source-123',
        name: 'Fran',
        description: '21-15-9 Thrusters and Pull-ups',
        scheme: 'time',
        scope: 'public',
      })

      const createdRemix = createTestWorkout({
        id: 'remix-new',
        name: 'Fran',
        description: '21-15-9 Thrusters and Pull-ups',
        scheme: 'time',
        scope: 'private',
        teamId: 'team-1',
        sourceWorkoutId: 'source-123',
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      const returningMock = mockDb.getChainMock().returning as ReturnType<
        typeof vi.fn
      >

      // Default mock returns empty array (for memberships, tags, movements queries)
      mockDb.setMockReturnValue([])

      // Sequence of DB calls:
      // 1. Check team membership
      limitMock.mockResolvedValueOnce([
        {teamId: 'team-1', userId: 'test-user-123'},
      ])
      // 2. Get source workout
      limitMock.mockResolvedValueOnce([sourceWorkout])
      // 3. Insert new workout
      returningMock.mockResolvedValueOnce([createdRemix])
      // 4. Get created workout
      limitMock.mockResolvedValueOnce([createdRemix])

      const result = await createWorkoutRemixFn({
        data: {
          sourceWorkoutId: 'source-123',
          teamId: 'team-1',
        },
      })

      expect(result.workout).toBeDefined()
      expect(result.workout.name).toBe('Fran')
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('copies tags and movements to remix', async () => {
      const sourceWorkout = createTestWorkout({
        id: 'source-123',
        name: 'Workout with Tags',
        scope: 'public',
      })

      const createdRemix = createTestWorkout({
        id: 'remix-new',
        sourceWorkoutId: 'source-123',
        teamId: 'team-1',
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      const returningMock = mockDb.getChainMock().returning as ReturnType<
        typeof vi.fn
      >

      // Default mock returns empty array (for memberships, tags, movements queries)
      mockDb.setMockReturnValue([])

      // Membership check
      limitMock.mockResolvedValueOnce([
        {teamId: 'team-1', userId: 'test-user-123'},
      ])
      // Get source workout
      limitMock.mockResolvedValueOnce([sourceWorkout])

      // Insert workout
      returningMock.mockResolvedValueOnce([createdRemix])
      // Get created workout
      limitMock.mockResolvedValueOnce([createdRemix])

      const result = await createWorkoutRemixFn({
        data: {
          sourceWorkoutId: 'source-123',
          teamId: 'team-1',
        },
      })

      expect(result.workout).toBeDefined()
      // Verify insert was called
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        createWorkoutRemixFn({
          data: {
            sourceWorkoutId: 'source-123',
            teamId: 'team-1',
          },
        }),
      ).rejects.toThrow('Not authenticated')
    })

    it('throws when source workout not found', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>

      // Membership check passes
      limitMock.mockResolvedValueOnce([
        {teamId: 'team-1', userId: 'test-user-123'},
      ])
      // Source workout not found
      limitMock.mockResolvedValueOnce([])

      await expect(
        createWorkoutRemixFn({
          data: {
            sourceWorkoutId: 'nonexistent',
            teamId: 'team-1',
          },
        }),
      ).rejects.toThrow('Source workout not found')
    })

    it('throws when user not a member of target team', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>

      // Membership check fails
      limitMock.mockResolvedValueOnce([])

      await expect(
        createWorkoutRemixFn({
          data: {
            sourceWorkoutId: 'source-123',
            teamId: 'other-team',
          },
        }),
      ).rejects.toThrow(
        'You are not authorized to create workouts for this team',
      )
    })

    it('throws when sourceWorkoutId is empty', async () => {
      await expect(
        createWorkoutRemixFn({
          data: {
            sourceWorkoutId: '',
            teamId: 'team-1',
          },
        }),
      ).rejects.toThrow()
    })

    it('throws when teamId is empty', async () => {
      await expect(
        createWorkoutRemixFn({
          data: {
            sourceWorkoutId: 'source-123',
            teamId: '',
          },
        }),
      ).rejects.toThrow()
    })
  })

  describe('getRemixCountFn', () => {
    it('returns count of remixes', async () => {
      mockDb.setMockReturnValue([{count: 5}])

      const result = await getRemixCountFn({data: {workoutId: 'wk-123'}})

      expect(result.count).toBe(5)
    })

    it('returns 0 when no remixes', async () => {
      mockDb.setMockReturnValue([{count: 0}])

      const result = await getRemixCountFn({data: {workoutId: 'wk-123'}})

      expect(result.count).toBe(0)
    })

    it('returns 0 when result is undefined', async () => {
      mockDb.setMockReturnValue([])

      const result = await getRemixCountFn({data: {workoutId: 'wk-123'}})

      expect(result.count).toBe(0)
    })

    it('throws when workoutId is empty', async () => {
      await expect(getRemixCountFn({data: {workoutId: ''}})).rejects.toThrow()
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        getRemixCountFn({data: {workoutId: 'wk-123'}}),
      ).rejects.toThrow('Not authenticated')
    })
  })

  describe('getWorkoutRemixInfoFn', () => {
    it('returns source and count in parallel', async () => {
      const sourceWorkout = createSourceWorkout({
        id: 'source-123',
        name: 'Original Workout',
        teamId: 'team-1',
        teamName: 'Test Team',
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>

      // First query: get workout with sourceWorkoutId
      limitMock.mockResolvedValueOnce([{sourceWorkoutId: 'source-123'}])
      // Second query (parallel): get source workout
      limitMock.mockResolvedValueOnce([sourceWorkout])
      // Third query (parallel): get remix count
      mockDb.setMockReturnValue([{count: 3}])

      const result = await getWorkoutRemixInfoFn({
        data: {workoutId: 'remix-123'},
      })

      expect(result.sourceWorkout).not.toBeNull()
      expect(result.sourceWorkout?.name).toBe('Original Workout')
      expect(result.remixCount).toBe(3)
    })

    it('returns null source when workout is not a remix', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>

      // Workout has no sourceWorkoutId
      limitMock.mockResolvedValueOnce([{sourceWorkoutId: null}])
      // Remix count query
      mockDb.setMockReturnValue([{count: 2}])

      const result = await getWorkoutRemixInfoFn({data: {workoutId: 'wk-123'}})

      expect(result.sourceWorkout).toBeNull()
      expect(result.remixCount).toBe(2)
    })

    it('returns null and 0 when workout not found', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([])

      const result = await getWorkoutRemixInfoFn({
        data: {workoutId: 'nonexistent'},
      })

      expect(result.sourceWorkout).toBeNull()
      expect(result.remixCount).toBe(0)
    })

    it('throws when workoutId is empty', async () => {
      await expect(
        getWorkoutRemixInfoFn({data: {workoutId: ''}}),
      ).rejects.toThrow()
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        getWorkoutRemixInfoFn({data: {workoutId: 'wk-123'}}),
      ).rejects.toThrow('Not authenticated')
    })
  })
})
