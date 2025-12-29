import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
import {
  createMovementFn,
  getAllMovementsFn,
  getMovementByIdFn,
  getWorkoutsByMovementIdFn,
} from '@/server-fns/movement-fns'

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

// Factory for creating test movements
function createMovement(
  overrides?: Partial<{
    id: string
    name: string
    type: 'weightlifting' | 'gymnastic' | 'monostructural'
    createdAt: Date
    updatedAt: Date
  }>,
) {
  const now = new Date()
  return {
    id: overrides?.id ?? `movement-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides?.name ?? 'Test Movement',
    type: overrides?.type ?? 'weightlifting',
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    ...overrides,
  }
}

// Factory for creating test workouts
function createTestWorkout(
  overrides?: Partial<{
    id: string
    name: string
    description: string
    scheme: string
    teamId: string | null
  }>,
) {
  return {
    id: overrides?.id ?? `workout-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides?.name ?? 'Test Workout',
    description: overrides?.description ?? 'Test workout description',
    scheme: overrides?.scheme ?? 'time',
    teamId: overrides?.teamId ?? null,
    ...overrides,
  }
}

describe('Movement Server Functions (TanStack)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    // Reset to authenticated session
    setMockSession(mockAuthenticatedSession)
  })

  describe('getAllMovementsFn', () => {
    it('returns all movements when authenticated', async () => {
      const movements = [
        createMovement({id: 'mv-1', name: 'Clean', type: 'weightlifting'}),
        createMovement({id: 'mv-2', name: 'Pull-up', type: 'gymnastic'}),
        createMovement({id: 'mv-3', name: 'Run', type: 'monostructural'}),
      ]

      mockDb.setMockReturnValue(movements)

      const result = await getAllMovementsFn()

      expect(result.movements).toHaveLength(3)
      expect(result.movements).toEqual(movements)
      expect(mockDb.select).toHaveBeenCalled()
      expect(mockDb.from).toHaveBeenCalled()
    })

    it('returns empty array when no movements exist', async () => {
      mockDb.setMockReturnValue([])

      const result = await getAllMovementsFn()

      expect(result.movements).toEqual([])
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(getAllMovementsFn()).rejects.toThrow('Not authenticated')
    })

    it('throws when session has no userId', async () => {
      setMockSession({userId: null, user: null, teams: []})

      await expect(getAllMovementsFn()).rejects.toThrow('Not authenticated')
    })
  })

  describe('createMovementFn', () => {
    it('creates a movement with valid input', async () => {
      const created = createMovement({
        id: 'mv-new',
        name: 'Power Clean',
        type: 'weightlifting',
      })

      // createMovementFn does insert() then select().from().where().limit(1)
      // The limit() returns the mock chain which resolves to mockReturnValue
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([created])

      const result = await createMovementFn({
        data: {
          name: 'Power Clean',
          type: 'weightlifting',
        },
      })

      expect(result.movement).toEqual(created)
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('creates a gymnastic movement', async () => {
      const created = createMovement({
        id: 'mv-gym',
        name: 'Muscle-up',
        type: 'gymnastic',
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([created])

      const result = await createMovementFn({
        data: {
          name: 'Muscle-up',
          type: 'gymnastic',
        },
      })

      expect(result.movement.type).toBe('gymnastic')
    })

    it('creates a monostructural movement', async () => {
      const created = createMovement({
        id: 'mv-mono',
        name: 'Double Under',
        type: 'monostructural',
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([created])

      const result = await createMovementFn({
        data: {
          name: 'Double Under',
          type: 'monostructural',
        },
      })

      expect(result.movement.type).toBe('monostructural')
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        createMovementFn({
          data: {
            name: 'Test Movement',
            type: 'weightlifting',
          },
        }),
      ).rejects.toThrow('Not authenticated')
    })

    it('throws when name is empty', async () => {
      // The zod validation should reject empty names
      await expect(
        createMovementFn({
          data: {
            name: '',
            type: 'weightlifting',
          },
        }),
      ).rejects.toThrow()
    })

    it('throws when type is invalid', async () => {
      await expect(
        createMovementFn({
          data: {
            name: 'Test Movement',
            type: 'invalid-type' as 'weightlifting',
          },
        }),
      ).rejects.toThrow()
    })
  })

  describe('getMovementByIdFn', () => {
    it('returns movement by ID', async () => {
      const movement = createMovement({
        id: 'mv-123',
        name: 'Snatch',
        type: 'weightlifting',
      })

      // getMovementByIdFn uses .select().from().where().limit(1)
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([movement])

      // Note: the actual schema uses 'id' not 'movementId'
      const result = await getMovementByIdFn({data: {id: 'mv-123'}})

      expect(result.movement).toEqual(movement)
      expect(mockDb.select).toHaveBeenCalled()
      expect(mockDb.from).toHaveBeenCalled()
    })

    it('returns null when movement not found', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([])

      const result = await getMovementByIdFn({data: {id: 'nonexistent'}})

      expect(result.movement).toBeNull()
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(getMovementByIdFn({data: {id: 'mv-123'}})).rejects.toThrow(
        'Not authenticated',
      )
    })

    it('throws when id is empty', async () => {
      await expect(getMovementByIdFn({data: {id: ''}})).rejects.toThrow()
    })
  })

  describe('getWorkoutsByMovementIdFn', () => {
    it('returns workouts that use the movement', async () => {
      const workoutMovementRows = [
        {workoutId: 'wk-1', movementId: 'mv-thruster'},
        {workoutId: 'wk-2', movementId: 'mv-thruster'},
      ]

      const workouts = [
        createTestWorkout({id: 'wk-1', name: 'Fran'}),
        createTestWorkout({id: 'wk-2', name: 'Grace'}),
      ]

      // First query: get workout_movements
      // Second query: get workouts
      // Third query: get tags (innerJoin)
      // Fourth query: get movements (innerJoin)
      mockDb.setMockReturnValue(workoutMovementRows)
      const whereMock = mockDb.getChainMock().where as ReturnType<typeof vi.fn>
      whereMock
        .mockResolvedValueOnce(workoutMovementRows) // workout_movements
        .mockResolvedValueOnce(workouts) // workouts
        .mockResolvedValueOnce([]) // tags
        .mockResolvedValueOnce([]) // all movements for workouts

      const result = await getWorkoutsByMovementIdFn({
        data: {movementId: 'mv-thruster'},
      })

      expect(result.workouts).toHaveLength(2)
      expect(result.workouts[0].name).toBe('Fran')
      expect(result.workouts[1].name).toBe('Grace')
    })

    it('returns empty array when no workouts use the movement', async () => {
      // Return empty workout_movements
      mockDb.setMockReturnValue([])

      const result = await getWorkoutsByMovementIdFn({
        data: {movementId: 'mv-unused'},
      })

      expect(result.workouts).toEqual([])
    })

    it('returns empty array for non-existent movement', async () => {
      mockDb.setMockReturnValue([])

      const result = await getWorkoutsByMovementIdFn({
        data: {movementId: 'nonexistent'},
      })

      expect(result.workouts).toEqual([])
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        getWorkoutsByMovementIdFn({data: {movementId: 'mv-123'}}),
      ).rejects.toThrow('Not authenticated')
    })

    it('throws when movementId is empty', async () => {
      await expect(
        getWorkoutsByMovementIdFn({data: {movementId: ''}}),
      ).rejects.toThrow()
    })

    it('includes tags and movements in returned workouts', async () => {
      const workoutMovementRows = [{workoutId: 'wk-1', movementId: 'mv-clean'}]
      const workouts = [createTestWorkout({id: 'wk-1', name: 'Clean Complex'})]
      const tags = [
        {workoutId: 'wk-1', tagId: 'tag-1', tagName: 'Olympic Lifting'},
      ]
      const movements = [
        {
          workoutId: 'wk-1',
          movementId: 'mv-clean',
          movementName: 'Clean',
          movementType: 'weightlifting' as const,
        },
      ]

      const whereMock = mockDb.getChainMock().where as ReturnType<typeof vi.fn>
      whereMock
        .mockResolvedValueOnce(workoutMovementRows)
        .mockResolvedValueOnce(workouts)
        .mockResolvedValueOnce(tags)
        .mockResolvedValueOnce(movements)

      const result = await getWorkoutsByMovementIdFn({
        data: {movementId: 'mv-clean'},
      })

      expect(result.workouts).toHaveLength(1)
      expect(result.workouts[0].tags).toHaveLength(1)
      expect(result.workouts[0].tags[0].name).toBe('Olympic Lifting')
      expect(result.workouts[0].movements).toHaveLength(1)
      expect(result.workouts[0].movements[0].name).toBe('Clean')
    })
  })
})
