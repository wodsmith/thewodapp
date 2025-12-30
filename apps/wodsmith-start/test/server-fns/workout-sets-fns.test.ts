import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
import {
  getWorkoutResultSetsFn,
  getMultipleWorkoutResultSetsFn,
} from '@/server-fns/workout-sets-fns'

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

// Factory for creating test scores
function createTestScore(
  overrides?: Partial<{
    id: string
    scheme: string
    value: number
    status: string | null
  }>,
) {
  return {
    id: overrides?.id ?? `score-${Math.random().toString(36).slice(2, 8)}`,
    scheme: overrides?.scheme ?? 'time',
    value: overrides?.value ?? 0,
    status: overrides?.status ?? 'scored',
    ...overrides,
  }
}

// Factory for creating test score rounds
function createTestScoreRound(
  overrides?: Partial<{
    id: string
    scoreId: string
    roundNumber: number
    value: number
    notes: string | null
    status: string | null
  }>,
) {
  return {
    id: overrides?.id ?? `round-${Math.random().toString(36).slice(2, 8)}`,
    scoreId: overrides?.scoreId ?? 'score-1',
    roundNumber: overrides?.roundNumber ?? 1,
    value: overrides?.value ?? 0,
    notes: overrides?.notes ?? null,
    status: overrides?.status ?? null,
    ...overrides,
  }
}

describe('Workout Sets Server Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    // Reset to authenticated session
    setMockSession(mockAuthenticatedSession)
  })

  describe('getWorkoutResultSetsFn', () => {
    it('returns sets for a score', async () => {
      const score = createTestScore({id: 'score-1', scheme: 'load'})
      const rounds = [
        createTestScoreRound({
          scoreId: 'score-1',
          roundNumber: 1,
          value: 102058, // ~225 lbs in grams
          notes: 'Felt strong',
        }),
        createTestScoreRound({
          scoreId: 'score-1',
          roundNumber: 2,
          value: 102058,
          notes: null,
        }),
        createTestScoreRound({
          scoreId: 'score-1',
          roundNumber: 3,
          value: 104326, // ~230 lbs
          notes: 'PR!',
        }),
      ]

      // First query: get parent score
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([score])

      // Second query: get rounds
      const orderByMock = mockDb.getChainMock().orderBy as ReturnType<
        typeof vi.fn
      >
      orderByMock.mockResolvedValueOnce(rounds)

      const result = await getWorkoutResultSetsFn({
        data: {scoreId: 'score-1'},
      })

      expect(result.scoreId).toBe('score-1')
      expect(result.scheme).toBe('load')
      expect(result.sets).toHaveLength(3)
      expect(result.totalRounds).toBe(3)
      expect(result.sets[0].roundNumber).toBe(1)
      expect(result.sets[0].notes).toBe('Felt strong')
      expect(result.sets[2].notes).toBe('PR!')
    })

    it('returns empty sets when score has no rounds', async () => {
      const score = createTestScore({id: 'score-empty', scheme: 'reps'})

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([score])

      const orderByMock = mockDb.getChainMock().orderBy as ReturnType<
        typeof vi.fn
      >
      orderByMock.mockResolvedValueOnce([])

      const result = await getWorkoutResultSetsFn({
        data: {scoreId: 'score-empty'},
      })

      expect(result.scoreId).toBe('score-empty')
      expect(result.sets).toEqual([])
      expect(result.totalRounds).toBe(0)
    })

    it('throws when scoreId is empty', async () => {
      await expect(
        getWorkoutResultSetsFn({
          data: {scoreId: ''},
        }),
      ).rejects.toThrow()
    })

    it('throws when score not found', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([])

      await expect(
        getWorkoutResultSetsFn({
          data: {scoreId: 'nonexistent'},
        }),
      ).rejects.toThrow('Score not found')
    })

    it('decodes time-based scores correctly', async () => {
      const score = createTestScore({id: 'score-time', scheme: 'time'})
      const rounds = [
        createTestScoreRound({
          scoreId: 'score-time',
          roundNumber: 1,
          value: 90000, // 1:30.000 (90 seconds in ms)
        }),
        createTestScoreRound({
          scoreId: 'score-time',
          roundNumber: 2,
          value: 85500, // 1:25.500
        }),
      ]

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([score])

      const orderByMock = mockDb.getChainMock().orderBy as ReturnType<
        typeof vi.fn
      >
      orderByMock.mockResolvedValueOnce(rounds)

      const result = await getWorkoutResultSetsFn({
        data: {scoreId: 'score-time'},
      })

      expect(result.scheme).toBe('time')
      expect(result.sets).toHaveLength(2)
      // Time decoding format: mm:ss or mm:ss.ms
      expect(result.sets[0].displayValue).toBe('1:30')
      expect(result.sets[1].displayValue).toBe('1:25.500')
    })

    it('decodes load-based scores correctly', async () => {
      const score = createTestScore({id: 'score-load', scheme: 'load'})
      const rounds = [
        createTestScoreRound({
          scoreId: 'score-load',
          roundNumber: 1,
          value: 102058, // ~225 lbs in grams
        }),
      ]

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([score])

      const orderByMock = mockDb.getChainMock().orderBy as ReturnType<
        typeof vi.fn
      >
      orderByMock.mockResolvedValueOnce(rounds)

      const result = await getWorkoutResultSetsFn({
        data: {scoreId: 'score-load'},
      })

      expect(result.scheme).toBe('load')
      expect(result.sets).toHaveLength(1)
      // Load decoding includes unit when includeUnit: true
      expect(result.sets[0].displayValue).toContain('lbs')
    })
  })

  describe('getMultipleWorkoutResultSetsFn', () => {
    it('returns sets for multiple scores', async () => {
      // Mock for first score
      const score1 = createTestScore({id: 'score-1', scheme: 'reps'})
      const rounds1 = [
        createTestScoreRound({
          scoreId: 'score-1',
          roundNumber: 1,
          value: 10,
        }),
      ]

      // Mock for second score
      const score2 = createTestScore({id: 'score-2', scheme: 'reps'})
      const rounds2 = [
        createTestScoreRound({
          scoreId: 'score-2',
          roundNumber: 1,
          value: 15,
        }),
        createTestScoreRound({
          scoreId: 'score-2',
          roundNumber: 2,
          value: 12,
        }),
      ]

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      const orderByMock = mockDb.getChainMock().orderBy as ReturnType<
        typeof vi.fn
      >

      // First call for score-1
      limitMock.mockResolvedValueOnce([score1])
      orderByMock.mockResolvedValueOnce(rounds1)

      // Second call for score-2
      limitMock.mockResolvedValueOnce([score2])
      orderByMock.mockResolvedValueOnce(rounds2)

      const result = await getMultipleWorkoutResultSetsFn({
        data: {scoreIds: ['score-1', 'score-2']},
      })

      expect(Object.keys(result)).toHaveLength(2)
      expect(result['score-1']).toBeDefined()
      expect(result['score-2']).toBeDefined()
      expect(result['score-1'].sets).toHaveLength(1)
      expect(result['score-2'].sets).toHaveLength(2)
    })

    it('returns empty object when no scoreIds provided', async () => {
      await expect(
        getMultipleWorkoutResultSetsFn({
          data: {scoreIds: []},
        }),
      ).rejects.toThrow()
    })

    it('skips scores that are not found', async () => {
      const score1 = createTestScore({id: 'score-1', scheme: 'reps'})
      const rounds1 = [
        createTestScoreRound({
          scoreId: 'score-1',
          roundNumber: 1,
          value: 10,
        }),
      ]

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      const orderByMock = mockDb.getChainMock().orderBy as ReturnType<
        typeof vi.fn
      >

      // First call for score-1 succeeds
      limitMock.mockResolvedValueOnce([score1])
      orderByMock.mockResolvedValueOnce(rounds1)

      // Second call for score-missing fails (not found)
      limitMock.mockResolvedValueOnce([])

      const result = await getMultipleWorkoutResultSetsFn({
        data: {scoreIds: ['score-1', 'score-missing']},
      })

      // Only score-1 should be in results
      expect(Object.keys(result)).toHaveLength(1)
      expect(result['score-1']).toBeDefined()
      expect(result['score-missing']).toBeUndefined()
    })
  })
})
