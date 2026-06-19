import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
import {
  submitLogFn,
  updateLogFn,
  getLogByIdFn,
  getScoreRoundsFn,
  getLogsByUserFn,
  getWorkoutScoresFn,
  getScalingLevelsFn,
  createLogFn,
} from '@/server-fns/log-fns'

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
    scalingGroupId: string | null
  }>,
) {
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
    scalingGroupId: overrides?.scalingGroupId ?? null,
    ...overrides,
  }
}

// Factory for creating test scores
function createTestScore(
  overrides?: Partial<{
    id: string
    userId: string
    teamId: string
    workoutId: string
    scheme: string
    scoreType: string
    scoreValue: number | null
    status: string
    scalingLevelId: string | null
    asRx: boolean
    notes: string | null
    recordedAt: Date
    createdAt: Date
    updatedAt: Date
    workoutName: string
    scalingLevelLabel: string | null
    scalingLevelPosition: number | null
  }>,
) {
  const now = new Date()
  return {
    id: overrides?.id ?? `score-${Math.random().toString(36).slice(2, 8)}`,
    userId: overrides?.userId ?? 'test-user-123',
    teamId: overrides?.teamId ?? 'team-1',
    workoutId: overrides?.workoutId ?? 'workout-1',
    scheme: overrides?.scheme ?? 'time',
    scoreType: overrides?.scoreType ?? 'min',
    scoreValue: overrides?.scoreValue ?? 300000, // 5:00 in milliseconds
    status: overrides?.status ?? 'scored',
    scalingLevelId: overrides?.scalingLevelId ?? 'level-rx',
    asRx: overrides?.asRx ?? true,
    notes: overrides?.notes ?? null,
    recordedAt: overrides?.recordedAt ?? now,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    workoutName: overrides?.workoutName ?? 'Test Workout',
    scalingLevelLabel: overrides?.scalingLevelLabel ?? 'Rx',
    scalingLevelPosition: overrides?.scalingLevelPosition ?? 0,
    ...overrides,
  }
}

// Factory for creating test scaling levels
function createTestScalingLevel(
  overrides?: Partial<{
    id: string
    label: string
    position: number
    scalingGroupId: string
  }>,
) {
  return {
    id: overrides?.id ?? `level-${Math.random().toString(36).slice(2, 8)}`,
    label: overrides?.label ?? 'Rx',
    position: overrides?.position ?? 0,
    scalingGroupId: overrides?.scalingGroupId ?? 'group-1',
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
    status: string | null
    secondaryValue: number | null
    notes: string | null
  }>,
) {
  return {
    id: overrides?.id ?? `scrd-${Math.random().toString(36).slice(2, 8)}`,
    scoreId: overrides?.scoreId ?? 'score-1',
    roundNumber: overrides?.roundNumber ?? 1,
    value: overrides?.value ?? 100,
    status: overrides?.status ?? null,
    secondaryValue: overrides?.secondaryValue ?? null,
    notes: overrides?.notes ?? null,
    ...overrides,
  }
}

describe('Log Server Functions (TanStack)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    // Reset to authenticated session
    setMockSession(mockAuthenticatedSession)
  })

  describe('submitLogFn', () => {
    it('submits a time score successfully', async () => {
      const workout = createTestWorkout({
        id: 'wk-1',
        scheme: 'time',
        scalingGroupId: 'group-1',
      })

      const scalingLevel = createTestScalingLevel({id: 'level-rx'})
      const scalingGroup = {id: 'group-1', isSystem: 1}

      // Mock the database calls in sequence
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock
        .mockResolvedValueOnce([workout]) // Get workout
        .mockResolvedValueOnce([scalingGroup]) // Get scaling group (fallback)
        .mockResolvedValueOnce([scalingLevel]) // Get scaling level

      const result = await submitLogFn({
        data: {
          workoutId: 'wk-1',
          teamId: 'team-1',
          date: '2025-01-15',
          score: '5:00',
          asRx: true,
        },
      })

      expect(result.success).toBe(true)
      expect(result.scoreId).toBeDefined()
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('submits a reps score successfully', async () => {
      const workout = createTestWorkout({
        id: 'wk-amrap',
        scheme: 'reps',
        scalingGroupId: 'group-1',
      })

      const scalingLevel = createTestScalingLevel({id: 'level-rx'})

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock
        .mockResolvedValueOnce([workout])
        .mockResolvedValueOnce([{id: 'group-1', isSystem: 1}])
        .mockResolvedValueOnce([scalingLevel])

      const result = await submitLogFn({
        data: {
          workoutId: 'wk-amrap',
          teamId: 'team-1',
          date: '2025-01-15',
          score: '150',
          asRx: true,
        },
      })

      expect(result.success).toBe(true)
      expect(result.scoreId).toBeDefined()
    })

    it('submits a load score successfully', async () => {
      const workout = createTestWorkout({
        id: 'wk-load',
        scheme: 'load',
        scalingGroupId: 'group-1',
      })

      const scalingLevel = createTestScalingLevel({id: 'level-rx'})

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock
        .mockResolvedValueOnce([workout])
        .mockResolvedValueOnce([{id: 'group-1', isSystem: 1}])
        .mockResolvedValueOnce([scalingLevel])

      const result = await submitLogFn({
        data: {
          workoutId: 'wk-load',
          teamId: 'team-1',
          date: '2025-01-15',
          score: '225lb',
          asRx: true,
        },
      })

      expect(result.success).toBe(true)
      expect(result.scoreId).toBeDefined()
    })

    it('submits multi-round scores successfully', async () => {
      const workout = createTestWorkout({
        id: 'wk-multi',
        scheme: 'reps',
        roundsToScore: 3,
        scalingGroupId: 'group-1',
      })

      const scalingLevel = createTestScalingLevel({id: 'level-rx'})

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock
        .mockResolvedValueOnce([workout])
        .mockResolvedValueOnce([{id: 'group-1', isSystem: 1}])
        .mockResolvedValueOnce([scalingLevel])

      const result = await submitLogFn({
        data: {
          workoutId: 'wk-multi',
          teamId: 'team-1',
          date: '2025-01-15',
          score: '',
          asRx: true,
          roundScores: [{score: '50'}, {score: '45'}, {score: '40'}],
        },
      })

      expect(result.success).toBe(true)
      expect(result.scoreId).toBeDefined()
      // Should have called insert twice: once for score, once for rounds
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('throws when workout not found', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([]) // No workout found

      await expect(
        submitLogFn({
          data: {
            workoutId: 'nonexistent',
            teamId: 'team-1',
            date: '2025-01-15',
            score: '5:00',
            asRx: true,
          },
        }),
      ).rejects.toThrow('Workout not found')
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        submitLogFn({
          data: {
            workoutId: 'wk-1',
            teamId: 'team-1',
            date: '2025-01-15',
            score: '5:00',
            asRx: true,
          },
        }),
      ).rejects.toThrow('Not authenticated')
    })

    it('throws when workoutId is empty', async () => {
      await expect(
        submitLogFn({
          data: {
            workoutId: '',
            teamId: 'team-1',
            date: '2025-01-15',
            score: '5:00',
            asRx: true,
          },
        }),
      ).rejects.toThrow()
    })

    it('throws when teamId is empty', async () => {
      await expect(
        submitLogFn({
          data: {
            workoutId: 'wk-1',
            teamId: '',
            date: '2025-01-15',
            score: '5:00',
            asRx: true,
          },
        }),
      ).rejects.toThrow()
    })

    it('throws when date is empty', async () => {
      await expect(
        submitLogFn({
          data: {
            workoutId: 'wk-1',
            teamId: 'team-1',
            date: '',
            score: '5:00',
            asRx: true,
          },
        }),
      ).rejects.toThrow()
    })

    it('throws when single score is empty for non-multi-round workout', async () => {
      const workout = createTestWorkout({
        id: 'wk-1',
        scheme: 'time',
        scalingGroupId: 'group-1',
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([workout])

      await expect(
        submitLogFn({
          data: {
            workoutId: 'wk-1',
            teamId: 'team-1',
            date: '2025-01-15',
            score: '',
            asRx: true,
          },
        }),
      ).rejects.toThrow('Score is required')
    })

    it('uses provided scaling level ID', async () => {
      const workout = createTestWorkout({
        id: 'wk-1',
        scheme: 'time',
        scalingGroupId: 'group-1',
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([workout])

      const result = await submitLogFn({
        data: {
          workoutId: 'wk-1',
          teamId: 'team-1',
          date: '2025-01-15',
          score: '5:00',
          asRx: false,
          scalingLevelId: 'custom-level',
        },
      })

      expect(result.success).toBe(true)
    })

    it('includes notes when provided', async () => {
      const workout = createTestWorkout({
        id: 'wk-1',
        scheme: 'time',
        scalingGroupId: 'group-1',
      })

      const scalingLevel = createTestScalingLevel({id: 'level-rx'})

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock
        .mockResolvedValueOnce([workout])
        .mockResolvedValueOnce([{id: 'group-1', isSystem: 1}])
        .mockResolvedValueOnce([scalingLevel])

      const result = await submitLogFn({
        data: {
          workoutId: 'wk-1',
          teamId: 'team-1',
          date: '2025-01-15',
          score: '5:00',
          asRx: true,
          notes: 'Felt strong today!',
        },
      })

      expect(result.success).toBe(true)
    })
  })

  describe('updateLogFn', () => {
    it('updates score value successfully', async () => {
      const existingScore = createTestScore({
        id: 'score-1',
        userId: 'test-user-123',
        scheme: 'time',
        scoreType: 'min',
      })

      const updatedScore = {...existingScore, scoreValue: 240000}

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([existingScore])

      // Source uses db.query.scoresTable.findFirst() after update
      mockDb.registerTable('scoresTable')
      mockDb.setMockSingleValue(updatedScore)

      const result = await updateLogFn({
        data: {
          id: 'score-1',
          scoreValue: 240000, // 4:00
        },
      })

      expect(result.score).toEqual(updatedScore)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('updates notes successfully', async () => {
      const existingScore = createTestScore({
        id: 'score-1',
        userId: 'test-user-123',
      })

      const updatedScore = {...existingScore, notes: 'Updated notes'}

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([existingScore])

      mockDb.registerTable('scoresTable')
      mockDb.setMockSingleValue(updatedScore)

      const result = await updateLogFn({
        data: {
          id: 'score-1',
          notes: 'Updated notes',
        },
      })

      expect(result.score.notes).toBe('Updated notes')
    })

    it('updates asRx successfully', async () => {
      const existingScore = createTestScore({
        id: 'score-1',
        userId: 'test-user-123',
        asRx: true,
      })

      const updatedScore = {...existingScore, asRx: false}

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([existingScore])

      mockDb.registerTable('scoresTable')
      mockDb.setMockSingleValue(updatedScore)

      const result = await updateLogFn({
        data: {
          id: 'score-1',
          asRx: false,
        },
      })

      expect(result.score.asRx).toBe(false)
    })

    it('updates scaling level successfully', async () => {
      const existingScore = createTestScore({
        id: 'score-1',
        userId: 'test-user-123',
        scalingLevelId: 'level-rx',
      })

      const updatedScore = {...existingScore, scalingLevelId: 'level-scaled'}

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([existingScore])

      mockDb.registerTable('scoresTable')
      mockDb.setMockSingleValue(updatedScore)

      const result = await updateLogFn({
        data: {
          id: 'score-1',
          scalingLevelId: 'level-scaled',
        },
      })

      expect(result.score.scalingLevelId).toBe('level-scaled')
    })

    it('updates date successfully', async () => {
      const existingScore = createTestScore({
        id: 'score-1',
        userId: 'test-user-123',
      })

      const newDate = new Date('2025-01-20')
      const updatedScore = {...existingScore, recordedAt: newDate}

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([existingScore])

      mockDb.registerTable('scoresTable')
      mockDb.setMockSingleValue(updatedScore)

      const result = await updateLogFn({
        data: {
          id: 'score-1',
          date: '2025-01-20',
        },
      })

      expect(result.score).toBeDefined()
    })

    it('updates multi-round scores (deletes old, inserts new)', async () => {
      const existingScore = createTestScore({
        id: 'score-1',
        userId: 'test-user-123',
        scheme: 'reps',
        scoreType: 'max',
      })

      const updatedScore = {...existingScore, scoreValue: 150}

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([existingScore])

      mockDb.registerTable('scoresTable')
      mockDb.setMockSingleValue(updatedScore)

      const result = await updateLogFn({
        data: {
          id: 'score-1',
          roundScores: [{score: '55'}, {score: '50'}, {score: '45'}],
        },
      })

      expect(result.score).toBeDefined()
      // Should have deleted old rounds and inserted new ones
      expect(mockDb.delete).toHaveBeenCalled()
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('throws when score not found', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([])

      await expect(
        updateLogFn({
          data: {
            id: 'nonexistent',
            notes: 'Updated',
          },
        }),
      ).rejects.toThrow('Score not found')
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        updateLogFn({
          data: {
            id: 'score-1',
            notes: 'Updated',
          },
        }),
      ).rejects.toThrow('Not authenticated')
    })

    it("throws when trying to update another user's score", async () => {
      const existingScore = createTestScore({
        id: 'score-1',
        userId: 'other-user-456', // Different user
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([existingScore])

      await expect(
        updateLogFn({
          data: {
            id: 'score-1',
            notes: 'Trying to update',
          },
        }),
      ).rejects.toThrow('Not authorized to update this score')
    })

    it('throws when id is empty', async () => {
      await expect(
        updateLogFn({
          data: {
            id: '',
            notes: 'Updated',
          },
        }),
      ).rejects.toThrow()
    })
  })

  describe('getLogByIdFn', () => {
    it('returns score with workout details', async () => {
      const score = createTestScore({
        id: 'score-1',
        userId: 'test-user-123',
        workoutId: 'wk-1',
        workoutName: 'Fran',
        scalingLevelLabel: 'Rx',
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([score])

      const result = await getLogByIdFn({data: {id: 'score-1'}})

      expect(result.score).toBeDefined()
      expect(result.score?.id).toBe('score-1')
      expect(result.score?.workoutName).toBe('Fran')
    })

    it('returns null when score not found', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([])

      const result = await getLogByIdFn({data: {id: 'nonexistent'}})

      expect(result.score).toBeNull()
    })

    it('allows access for score owner', async () => {
      const score = createTestScore({
        id: 'score-1',
        userId: 'test-user-123',
        teamId: 'team-1',
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([score])

      const result = await getLogByIdFn({data: {id: 'score-1'}})

      expect(result.score).toBeDefined()
    })

    it('allows access for team member', async () => {
      const score = createTestScore({
        id: 'score-1',
        userId: 'other-user-456', // Different user
        teamId: 'team-1', // But same team as authenticated user
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([score])

      const result = await getLogByIdFn({data: {id: 'score-1'}})

      expect(result.score).toBeDefined()
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(getLogByIdFn({data: {id: 'score-1'}})).rejects.toThrow(
        'Not authenticated',
      )
    })

    it('throws when not authorized (different user, different team)', async () => {
      const score = createTestScore({
        id: 'score-1',
        userId: 'other-user-456',
        teamId: 'other-team-2', // Different team
      })

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([score])

      await expect(getLogByIdFn({data: {id: 'score-1'}})).rejects.toThrow(
        'Not authorized to access this score',
      )
    })

    it('throws when id is empty', async () => {
      await expect(getLogByIdFn({data: {id: ''}})).rejects.toThrow()
    })
  })

  describe('getScoreRoundsFn', () => {
    it('returns rounds ordered by round number', async () => {
      const rounds = [
        createTestScoreRound({scoreId: 'score-1', roundNumber: 1, value: 50}),
        createTestScoreRound({scoreId: 'score-1', roundNumber: 2, value: 45}),
        createTestScoreRound({scoreId: 'score-1', roundNumber: 3, value: 40}),
      ]

      mockDb.setMockReturnValue(rounds)

      const result = await getScoreRoundsFn({data: {scoreId: 'score-1'}})

      expect(result.rounds).toHaveLength(3)
      expect(result.rounds[0].roundNumber).toBe(1)
      expect(result.rounds[1].roundNumber).toBe(2)
      expect(result.rounds[2].roundNumber).toBe(3)
    })

    it('returns empty array when no rounds exist', async () => {
      mockDb.setMockReturnValue([])

      const result = await getScoreRoundsFn({data: {scoreId: 'score-1'}})

      expect(result.rounds).toEqual([])
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        getScoreRoundsFn({data: {scoreId: 'score-1'}}),
      ).rejects.toThrow('Not authenticated')
    })

    it('throws when scoreId is empty', async () => {
      await expect(getScoreRoundsFn({data: {scoreId: ''}})).rejects.toThrow()
    })
  })

  describe('getLogsByUserFn', () => {
    it('returns logs with workout names and scaling levels', async () => {
      const logs = [
        createTestScore({
          id: 'score-1',
          userId: 'test-user-123',
          workoutName: 'Fran',
          scalingLevelLabel: 'Rx',
          scheme: 'time',
          scoreValue: 300000,
        }),
        createTestScore({
          id: 'score-2',
          userId: 'test-user-123',
          workoutName: 'Grace',
          scalingLevelLabel: 'Scaled',
          scheme: 'time',
          scoreValue: 420000,
        }),
      ]

      mockDb.setMockReturnValue(logs)

      const result = await getLogsByUserFn({data: {userId: 'test-user-123'}})

      expect(result.logs).toHaveLength(2)
      expect(result.logs[0].workoutName).toBe('Fran')
      expect(result.logs[1].workoutName).toBe('Grace')
    })

    it('includes display score for each log', async () => {
      const logs = [
        createTestScore({
          id: 'score-1',
          userId: 'test-user-123',
          scheme: 'time',
          scoreValue: 300000, // 5:00
          status: 'scored',
        }),
      ]

      mockDb.setMockReturnValue(logs)

      const result = await getLogsByUserFn({data: {userId: 'test-user-123'}})

      expect(result.logs[0].displayScore).toBeDefined()
    })

    it('returns empty array when user has no logs', async () => {
      mockDb.setMockReturnValue([])

      const result = await getLogsByUserFn({data: {userId: 'test-user-123'}})

      expect(result.logs).toEqual([])
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        getLogsByUserFn({data: {userId: 'test-user-123'}}),
      ).rejects.toThrow('Not authenticated')
    })

    it("throws when trying to view another user's logs", async () => {
      await expect(
        getLogsByUserFn({data: {userId: 'other-user-456'}}),
      ).rejects.toThrow('Not authorized to view these logs')
    })

    it('throws when userId is empty', async () => {
      await expect(getLogsByUserFn({data: {userId: ''}})).rejects.toThrow()
    })
  })

  describe('getWorkoutScoresFn', () => {
    it('returns scores with user info', async () => {
      const scores = [
        {
          id: 'score-1',
          userId: 'user-1',
          userName: 'John',
          userAvatar: 'avatar1.png',
          scoreValue: 300000,
          scheme: 'time',
          scalingLabel: 'Rx',
          asRx: true,
          notes: null,
          recordedAt: new Date(),
          status: 'scored',
          sortKey: '123',
          scalingLevelId: 'level-1',
        },
        {
          id: 'score-2',
          userId: 'user-2',
          userName: 'Jane',
          userAvatar: null,
          scoreValue: 360000,
          scheme: 'time',
          scalingLabel: 'Scaled',
          asRx: false,
          notes: 'Good effort',
          recordedAt: new Date(),
          status: 'scored',
          sortKey: '456',
          scalingLevelId: 'level-2',
        },
      ]

      mockDb.setMockReturnValue(scores)

      const result = await getWorkoutScoresFn({
        data: {
          workoutId: 'wk-1',
          teamId: 'team-1',
          limit: 50,
        },
      })

      expect(result.scores).toHaveLength(2)
      expect(result.scores[0].userName).toBe('John')
      expect(result.scores[1].userName).toBe('Jane')
    })

    it('includes decoded display scores', async () => {
      const scores = [
        {
          id: 'score-1',
          userId: 'user-1',
          userName: 'John',
          userAvatar: null,
          scoreValue: 300000, // 5:00
          scheme: 'time',
          scalingLabel: 'Rx',
          asRx: true,
          notes: null,
          recordedAt: new Date(),
          status: 'scored',
          sortKey: '123',
          scalingLevelId: 'level-1',
        },
      ]

      mockDb.setMockReturnValue(scores)

      const result = await getWorkoutScoresFn({
        data: {
          workoutId: 'wk-1',
          teamId: 'team-1',
          limit: 50,
        },
      })

      expect(result.scores[0].displayScore).toBeDefined()
    })

    it('returns empty array when no scores exist', async () => {
      mockDb.setMockReturnValue([])

      const result = await getWorkoutScoresFn({
        data: {
          workoutId: 'wk-1',
          teamId: 'team-1',
          limit: 50,
        },
      })

      expect(result.scores).toEqual([])
    })

    it('respects limit parameter', async () => {
      const scores = [
        {
          id: 'score-1',
          userId: 'user-1',
          userName: 'John',
          userAvatar: null,
          scoreValue: 300000,
          scheme: 'time',
          scalingLabel: 'Rx',
          asRx: true,
          notes: null,
          recordedAt: new Date(),
          status: 'scored',
          sortKey: '123',
          scalingLevelId: 'level-1',
        },
      ]

      mockDb.setMockReturnValue(scores)

      await getWorkoutScoresFn({
        data: {
          workoutId: 'wk-1',
          teamId: 'team-1',
          limit: 10,
        },
      })

      expect(mockDb.getChainMock().limit).toHaveBeenCalled()
    })

    it('throws when workoutId is empty', async () => {
      await expect(
        getWorkoutScoresFn({
          data: {
            workoutId: '',
            teamId: 'team-1',
            limit: 50,
          },
        }),
      ).rejects.toThrow()
    })

    it('throws when teamId is empty', async () => {
      await expect(
        getWorkoutScoresFn({
          data: {
            workoutId: 'wk-1',
            teamId: '',
            limit: 50,
          },
        }),
      ).rejects.toThrow()
    })
  })

  describe('getScalingLevelsFn', () => {
    it("returns levels from workout's scaling group", async () => {
      const workout = createTestWorkout({
        id: 'wk-1',
        scalingGroupId: 'group-custom',
      })

      const levels = [
        createTestScalingLevel({id: 'level-1', label: 'Rx', position: 0}),
        createTestScalingLevel({id: 'level-2', label: 'Scaled', position: 1}),
        createTestScalingLevel({
          id: 'level-3',
          label: 'Foundations',
          position: 2,
        }),
      ]

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([workout])

      mockDb.setMockReturnValue(levels)

      const result = await getScalingLevelsFn({data: {workoutId: 'wk-1'}})

      expect(result.levels).toHaveLength(3)
      expect(result.levels[0].label).toBe('Rx')
      expect(result.levels[1].label).toBe('Scaled')
    })

    it('falls back to system default when workout has no scaling group', async () => {
      const workout = createTestWorkout({
        id: 'wk-1',
        scalingGroupId: null, // No custom group
      })

      const systemGroup = {id: 'system-group', isSystem: 1}
      const levels = [
        createTestScalingLevel({id: 'level-1', label: 'Rx', position: 0}),
        createTestScalingLevel({id: 'level-2', label: 'Scaled', position: 1}),
      ]

      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock
        .mockResolvedValueOnce([workout])
        .mockResolvedValueOnce([systemGroup])

      mockDb.setMockReturnValue(levels)

      const result = await getScalingLevelsFn({data: {workoutId: 'wk-1'}})

      expect(result.levels).toHaveLength(2)
    })

    it('returns empty array when no scaling group available', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock
        .mockResolvedValueOnce([{scalingGroupId: null}]) // Workout with no group
        .mockResolvedValueOnce([]) // No system group either

      const result = await getScalingLevelsFn({data: {workoutId: 'wk-1'}})

      expect(result.levels).toEqual([])
    })

    it('returns empty array when workout not found', async () => {
      const limitMock = mockDb.getChainMock().limit as ReturnType<typeof vi.fn>
      limitMock.mockResolvedValueOnce([]) // No workout

      const result = await getScalingLevelsFn({
        data: {workoutId: 'nonexistent'},
      })

      expect(result.levels).toEqual([])
    })

    it('throws when workoutId is empty', async () => {
      await expect(
        getScalingLevelsFn({data: {workoutId: ''}}),
      ).rejects.toThrow()
    })
  })

  describe('createLogFn', () => {
    it('creates a log with valid input', async () => {
      const newScore = createTestScore({
        id: 'score-new',
        userId: 'test-user-123',
        teamId: 'team-1',
        workoutId: 'wk-1',
        scheme: 'time',
        scoreValue: 300000,
      })

      // Source uses db.query.scoresTable.findFirst() after insert
      mockDb.registerTable('scoresTable')
      mockDb.setMockSingleValue(newScore)

      const result = await createLogFn({
        data: {
          userId: 'test-user-123',
          teamId: 'team-1',
          workoutId: 'wk-1',
          scoreValue: 300000,
          scheme: 'time',
          asRx: true,
        },
      })

      expect(result.score).toEqual(newScore)
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('creates a log with optional fields', async () => {
      const newScore = createTestScore({
        id: 'score-new',
        userId: 'test-user-123',
        notes: 'Test notes',
        scalingLevelId: 'level-scaled',
      })

      mockDb.registerTable('scoresTable')
      mockDb.setMockSingleValue(newScore)

      const result = await createLogFn({
        data: {
          userId: 'test-user-123',
          teamId: 'team-1',
          workoutId: 'wk-1',
          scoreValue: 300000,
          scheme: 'time',
          asRx: false,
          scalingLevelId: 'level-scaled',
          notes: 'Test notes',
        },
      })

      expect(result.score.notes).toBe('Test notes')
      expect(result.score.scalingLevelId).toBe('level-scaled')
    })

    it('creates a log with null scoreValue', async () => {
      const newScore = createTestScore({
        id: 'score-new',
        scoreValue: null,
      })

      mockDb.registerTable('scoresTable')
      mockDb.setMockSingleValue(newScore)

      const result = await createLogFn({
        data: {
          userId: 'test-user-123',
          teamId: 'team-1',
          workoutId: 'wk-1',
          scoreValue: null,
          scheme: 'time',
          asRx: true,
        },
      })

      expect(result.score.scoreValue).toBeNull()
    })

    it('throws when not authenticated', async () => {
      setMockSession(null)

      await expect(
        createLogFn({
          data: {
            userId: 'test-user-123',
            teamId: 'team-1',
            workoutId: 'wk-1',
            scoreValue: 300000,
            scheme: 'time',
            asRx: true,
          },
        }),
      ).rejects.toThrow('Not authenticated')
    })

    it('throws when trying to create log for another user', async () => {
      await expect(
        createLogFn({
          data: {
            userId: 'other-user-456',
            teamId: 'team-1',
            workoutId: 'wk-1',
            scoreValue: 300000,
            scheme: 'time',
            asRx: true,
          },
        }),
      ).rejects.toThrow('Not authorized to create logs for other users')
    })

    it('throws when userId is empty', async () => {
      await expect(
        createLogFn({
          data: {
            userId: '',
            teamId: 'team-1',
            workoutId: 'wk-1',
            scoreValue: 300000,
            scheme: 'time',
            asRx: true,
          },
        }),
      ).rejects.toThrow()
    })

    it('throws when teamId is empty', async () => {
      await expect(
        createLogFn({
          data: {
            userId: 'test-user-123',
            teamId: '',
            workoutId: 'wk-1',
            scoreValue: 300000,
            scheme: 'time',
            asRx: true,
          },
        }),
      ).rejects.toThrow()
    })

    it('throws when workoutId is empty', async () => {
      await expect(
        createLogFn({
          data: {
            userId: 'test-user-123',
            teamId: 'team-1',
            workoutId: '',
            scoreValue: 300000,
            scheme: 'time',
            asRx: true,
          },
        }),
      ).rejects.toThrow()
    })

    it('throws when scheme is empty', async () => {
      await expect(
        createLogFn({
          data: {
            userId: 'test-user-123',
            teamId: 'team-1',
            workoutId: 'wk-1',
            scoreValue: 300000,
            scheme: '',
            asRx: true,
          },
        }),
      ).rejects.toThrow()
    })

    it('throws when creation fails', async () => {
      // Source uses db.query.scoresTable.findFirst() which returns null
      mockDb.registerTable('scoresTable')
      mockDb.setMockSingleValue(null)

      await expect(
        createLogFn({
          data: {
            userId: 'test-user-123',
            teamId: 'team-1',
            workoutId: 'wk-1',
            scoreValue: 300000,
            scheme: 'time',
            asRx: true,
          },
        }),
      ).rejects.toThrow('Failed to create log')
    })
  })
})
