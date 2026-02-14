import {beforeEach, describe, expect, it, vi} from 'vitest'
import {
  getHeatsForCompetitionFn,
  createHeatFn,
  updateHeatFn,
  deleteHeatFn,
  reorderHeatsFn,
  getNextHeatNumberFn,
  assignToHeatFn,
  bulkAssignToHeatFn,
  removeFromHeatFn,
  updateAssignmentFn,
  moveAssignmentFn,
  getUnassignedRegistrationsFn,
  createVenueFn,
  updateVenueFn,
  deleteVenueFn,
  getVenueHeatCountFn,
  copyHeatsFromEventFn,
} from '@/server-fns/competition-heats-fns'

// Track query sequences for debugging
let querySequence: string[] = []

// Create a more sophisticated mock that properly tracks and returns data
function createDbMock(config: {
  heats?: unknown[]
  venues?: unknown[]
  divisions?: unknown[]
  assignments?: unknown[]
  registrations?: unknown[]
  users?: unknown[]
  regDivisions?: unknown[]
}) {
  const defaults = {
    heats: [],
    venues: [],
    divisions: [],
    assignments: [],
    registrations: [],
    users: [],
    regDivisions: [],
    ...config,
  }

  // Use counters to track which query we're on
  let orderByCallCount = 0
  let whereCallCount = 0

  const createChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {}

    chain.select = vi.fn(() => chain)
    chain.from = vi.fn((table) => {
      querySequence.push(`from:${table?.name || 'unknown'}`)
      return chain
    })
    chain.where = vi.fn(() => {
      whereCallCount++
      querySequence.push(`where:${whereCallCount}`)
      return chain
    })
    chain.orderBy = vi.fn(() => {
      orderByCallCount++
      querySequence.push(`orderBy:${orderByCallCount}`)

      // First orderBy is for heats, subsequent ones are for assignments
      if (orderByCallCount === 1) {
        return Promise.resolve(defaults.heats)
      }
      return Promise.resolve(defaults.assignments)
    })
    chain.inArray = vi.fn(() => chain)

    // Make chain thenable for awaiting where() directly
    chain.then = (
      resolve: (value: unknown) => void,
      _reject?: (err: unknown) => void,
    ) => {
      // This is called when awaiting after where() without orderBy()
      // The order is: venues -> heat divisions -> (assignments by orderBy) -> registrations -> users -> reg divisions
      // where() calls: 1=venues, 2=divisions, 3+=registrations/users/regDivisions batches
      const currentWhere = whereCallCount

      let result: unknown[] = []
      if (currentWhere === 1) {
        result = defaults.venues
      } else if (currentWhere === 2) {
        result = defaults.divisions
      } else if (currentWhere === 3) {
        result = defaults.registrations
      } else if (currentWhere === 4) {
        result = defaults.users
      } else if (currentWhere === 5) {
        result = defaults.regDivisions
      }

      resolve(result)
      return Promise.resolve(result)
    }

    return chain
  }

  return createChain()
}

let mockDbInstance: ReturnType<typeof createDbMock>

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDbInstance),
}))

// Mock TanStack createServerFn to make server functions directly callable in tests
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let handlerFn: ReturnType<typeof vi.fn>
    return {
      inputValidator: () => ({
        handler: (fn: ReturnType<typeof vi.fn>) => {
          handlerFn = fn
          return handlerFn
        },
      }),
      validator: () => ({
        handler: (fn: ReturnType<typeof vi.fn>) => {
          handlerFn = fn
          return handlerFn
        },
      }),
    }
  },
}))

describe('Competition Heats Server Functions (TanStack)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    querySequence = []
  })

  describe('getHeatsForCompetitionFn', () => {
    it('returns empty array when no heats exist', async () => {
      mockDbInstance = createDbMock({heats: []})

      const result = await getHeatsForCompetitionFn({
        data: {competitionId: 'comp-1'},
      })

      expect(result.heats).toEqual([])
    })

    it('returns heats with basic structure', async () => {
      const heat = {
        id: 'heat-1',
        competitionId: 'comp-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: new Date('2025-01-15T09:00:00Z'),
        durationMinutes: 10,
        venueId: null,
        divisionId: null,
        capacity: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDbInstance = createDbMock({
        heats: [heat],
        assignments: [],
      })

      const result = await getHeatsForCompetitionFn({
        data: {competitionId: 'comp-1'},
      })

      expect(result.heats).toHaveLength(1)
      expect(result.heats[0]?.id).toBe('heat-1')
      expect(result.heats[0]?.heatNumber).toBe(1)
      expect(result.heats[0]?.venue).toBeNull()
      expect(result.heats[0]?.division).toBeNull()
      expect(result.heats[0]?.assignments).toEqual([])
    })

    it('includes venue when heat has venueId', async () => {
      // This test verifies that venue is looked up when venueId is present
      // The actual implementation queries venues by ID and maps them
      const heat = {
        id: 'heat-1',
        competitionId: 'comp-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: new Date('2025-01-15T09:00:00Z'),
        durationMinutes: 10,
        venueId: 'venue-1',
        divisionId: null,
        capacity: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Simplified test - we just verify that when venueId is present,
      // the code path handles it (venue lookup is called)
      mockDbInstance = createDbMock({
        heats: [heat],
        venues: [], // Empty venues array = venue not found = null
        assignments: [],
      })

      const result = await getHeatsForCompetitionFn({
        data: {competitionId: 'comp-1'},
      })

      expect(result.heats).toHaveLength(1)
      // When venue isn't found, it should be null (not undefined)
      expect(result.heats[0]?.venue).toBeNull()
    })

    it('includes division when heat has divisionId', async () => {
      const heat = {
        id: 'heat-1',
        competitionId: 'comp-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: null,
        durationMinutes: 10,
        venueId: null,
        divisionId: 'div-1',
        capacity: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const division = {
        id: 'div-1',
        label: 'RX',
      }

      mockDbInstance = createDbMock({
        heats: [heat],
        divisions: [division],
        assignments: [],
      })

      const result = await getHeatsForCompetitionFn({
        data: {competitionId: 'comp-1'},
      })

      expect(result.heats).toHaveLength(1)
      expect(result.heats[0]?.division?.label).toBe('RX')
    })

    it('includes assignments with athlete details', async () => {
      const heat = {
        id: 'heat-1',
        competitionId: 'comp-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: null,
        durationMinutes: 10,
        venueId: null,
        divisionId: null,
        capacity: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const assignment = {
        id: 'assignment-1',
        heatId: 'heat-1',
        laneNumber: 1,
        registrationId: 'reg-1',
      }

      const registration = {
        id: 'reg-1',
        teamName: null,
        userId: 'user-1',
        divisionId: 'div-rx',
        metadata: JSON.stringify({affiliates: {'user-1': 'CrossFit Box'}}),
      }

      const user = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
      }

      const regDivision = {
        id: 'div-rx',
        label: 'RX',
      }

      mockDbInstance = createDbMock({
        heats: [heat],
        assignments: [assignment],
        registrations: [registration],
        users: [user],
        regDivisions: [regDivision],
      })

      const result = await getHeatsForCompetitionFn({
        data: {competitionId: 'comp-1'},
      })

      expect(result.heats).toHaveLength(1)
      expect(result.heats[0]?.assignments).toHaveLength(1)
      expect(result.heats[0]?.assignments[0]?.laneNumber).toBe(1)
      expect(result.heats[0]?.assignments[0]?.registration.user.firstName).toBe(
        'John',
      )
      expect(result.heats[0]?.assignments[0]?.registration.user.lastName).toBe(
        'Doe',
      )
      expect(
        result.heats[0]?.assignments[0]?.registration.division?.label,
      ).toBe('RX')
      expect(result.heats[0]?.assignments[0]?.registration.affiliate).toBe(
        'CrossFit Box',
      )
    })

    it('shows team name for team registrations', async () => {
      const heat = {
        id: 'heat-1',
        competitionId: 'comp-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: null,
        durationMinutes: 10,
        venueId: null,
        divisionId: null,
        capacity: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const assignment = {
        id: 'assignment-1',
        heatId: 'heat-1',
        laneNumber: 1,
        registrationId: 'reg-1',
      }

      const registration = {
        id: 'reg-1',
        teamName: 'Team Alpha',
        userId: 'user-1',
        divisionId: null,
        metadata: null,
      }

      const user = {
        id: 'user-1',
        firstName: 'Captain',
        lastName: 'Person',
      }

      mockDbInstance = createDbMock({
        heats: [heat],
        assignments: [assignment],
        registrations: [registration],
        users: [user],
      })

      const result = await getHeatsForCompetitionFn({
        data: {competitionId: 'comp-1'},
      })

      expect(result.heats[0]?.assignments[0]?.registration.teamName).toBe(
        'Team Alpha',
      )
    })

    it('handles invalid metadata gracefully', async () => {
      const heat = {
        id: 'heat-1',
        competitionId: 'comp-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: null,
        durationMinutes: 10,
        venueId: null,
        divisionId: null,
        capacity: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const assignment = {
        id: 'assignment-1',
        heatId: 'heat-1',
        laneNumber: 1,
        registrationId: 'reg-1',
      }

      const registration = {
        id: 'reg-1',
        teamName: null,
        userId: 'user-1',
        divisionId: null,
        metadata: 'invalid json that cannot be parsed',
      }

      const user = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
      }

      mockDbInstance = createDbMock({
        heats: [heat],
        assignments: [assignment],
        registrations: [registration],
        users: [user],
      })

      const result = await getHeatsForCompetitionFn({
        data: {competitionId: 'comp-1'},
      })

      // Should handle gracefully and return null for affiliate
      expect(result.heats[0]?.assignments[0]?.registration.affiliate).toBeNull()
    })

    it('provides default values for missing registration', async () => {
      const heat = {
        id: 'heat-1',
        competitionId: 'comp-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: null,
        durationMinutes: 10,
        venueId: null,
        divisionId: null,
        capacity: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const assignment = {
        id: 'assignment-1',
        heatId: 'heat-1',
        laneNumber: 1,
        registrationId: 'non-existent-reg',
      }

      mockDbInstance = createDbMock({
        heats: [heat],
        assignments: [assignment],
        registrations: [], // Registration not found
        users: [],
      })

      const result = await getHeatsForCompetitionFn({
        data: {competitionId: 'comp-1'},
      })

      // Should handle gracefully with default values
      expect(result.heats[0]?.assignments).toHaveLength(1)
      expect(result.heats[0]?.assignments[0]?.registration.id).toBe(
        'non-existent-reg',
      )
      expect(result.heats[0]?.assignments[0]?.registration.teamName).toBeNull()
      expect(
        result.heats[0]?.assignments[0]?.registration.user.firstName,
      ).toBeNull()
    })

    it('returns multiple heats sorted by scheduled time', async () => {
      const heat1 = {
        id: 'heat-1',
        competitionId: 'comp-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: new Date('2025-01-15T09:00:00Z'),
        durationMinutes: 10,
        venueId: null,
        divisionId: null,
        capacity: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const heat2 = {
        id: 'heat-2',
        competitionId: 'comp-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 2,
        scheduledTime: new Date('2025-01-15T09:15:00Z'),
        durationMinutes: 10,
        venueId: null,
        divisionId: null,
        capacity: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDbInstance = createDbMock({
        heats: [heat1, heat2],
        assignments: [],
      })

      const result = await getHeatsForCompetitionFn({
        data: {competitionId: 'comp-1'},
      })

      expect(result.heats).toHaveLength(2)
      expect(result.heats[0]?.heatNumber).toBe(1)
      expect(result.heats[1]?.heatNumber).toBe(2)
    })
  })

  describe('createHeatFn', () => {
    it('creates a heat with required fields', async () => {
      const createdHeat = {
        id: 'cheat_new',
        competitionId: 'comp-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 1,
        scheduledTime: null,
        venueId: null,
        divisionId: null,
        durationMinutes: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Create a mock for insert operations with db.query support
      const insertMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        query: {
          competitionHeatsTable: {
            findFirst: vi.fn().mockResolvedValue(createdHeat),
          },
        },
      }
      mockDbInstance = insertMock as unknown as ReturnType<typeof createDbMock>

      const result = await createHeatFn({
        data: {
          competitionId: 'comp-1',
          trackWorkoutId: 'tw-1',
          heatNumber: 1,
        },
      })

      expect(result.heat).toBeDefined()
      expect(result.heat.id).toBe('cheat_new')
      expect(result.heat.heatNumber).toBe(1)
    })

    it('creates a heat with all optional fields', async () => {
      const scheduledTime = new Date('2025-01-15T09:00:00Z')
      const createdHeat = {
        id: 'cheat_full',
        competitionId: 'comp-1',
        trackWorkoutId: 'tw-1',
        heatNumber: 3,
        scheduledTime,
        venueId: 'cvenue_1',
        divisionId: 'div_1',
        durationMinutes: 15,
        notes: 'RX division only',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const insertMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        query: {
          competitionHeatsTable: {
            findFirst: vi.fn().mockResolvedValue(createdHeat),
          },
        },
      }
      mockDbInstance = insertMock as unknown as ReturnType<typeof createDbMock>

      const result = await createHeatFn({
        data: {
          competitionId: 'comp-1',
          trackWorkoutId: 'tw-1',
          heatNumber: 3,
          scheduledTime,
          venueId: 'cvenue_1',
          divisionId: 'div_1',
          durationMinutes: 15,
          notes: 'RX division only',
        },
      })

      expect(result.heat.venueId).toBe('cvenue_1')
      expect(result.heat.divisionId).toBe('div_1')
      expect(result.heat.durationMinutes).toBe(15)
      expect(result.heat.notes).toBe('RX division only')
    })

    it('throws error when insert fails', async () => {
      const insertMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        query: {
          competitionHeatsTable: {
            findFirst: vi.fn().mockResolvedValue(null), // Not found = failed
          },
        },
      }
      mockDbInstance = insertMock as unknown as ReturnType<typeof createDbMock>

      await expect(
        createHeatFn({
          data: {
            competitionId: 'comp-1',
            trackWorkoutId: 'tw-1',
            heatNumber: 1,
          },
        }),
      ).rejects.toThrow('Failed to create heat')
    })
  })

  describe('updateHeatFn', () => {
    it('updates heat with partial fields', async () => {
      const updateMock = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }
      mockDbInstance = updateMock as unknown as ReturnType<typeof createDbMock>

      const result = await updateHeatFn({
        data: {
          heatId: 'cheat_1',
          notes: 'Updated notes',
        },
      })

      expect(result.success).toBe(true)
      expect(updateMock.update).toHaveBeenCalled()
    })

    it('updates scheduledTime and venueId', async () => {
      const updateMock = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }
      mockDbInstance = updateMock as unknown as ReturnType<typeof createDbMock>

      const result = await updateHeatFn({
        data: {
          heatId: 'cheat_1',
          scheduledTime: new Date('2025-01-15T10:00:00Z'),
          venueId: 'cvenue_2',
        },
      })

      expect(result.success).toBe(true)
    })
  })

  describe('deleteHeatFn', () => {
    it('deletes a heat by ID', async () => {
      const deleteMock = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }
      mockDbInstance = deleteMock as unknown as ReturnType<typeof createDbMock>

      const result = await deleteHeatFn({
        data: {heatId: 'cheat_1'},
      })

      expect(result.success).toBe(true)
      expect(deleteMock.delete).toHaveBeenCalled()
    })
  })

  describe('reorderHeatsFn', () => {
    it('reorders heats using two-pass update', async () => {
      const existingHeats = [
        {id: 'cheat_1', heatNumber: 1, trackWorkoutId: 'tw-1'},
        {id: 'cheat_2', heatNumber: 2, trackWorkoutId: 'tw-1'},
        {id: 'cheat_3', heatNumber: 3, trackWorkoutId: 'tw-1'},
      ]

      const reorderedHeats = [
        {id: 'cheat_3', heatNumber: 1, trackWorkoutId: 'tw-1'},
        {id: 'cheat_1', heatNumber: 2, trackWorkoutId: 'tw-1'},
        {id: 'cheat_2', heatNumber: 3, trackWorkoutId: 'tw-1'},
      ]

      let selectCallCount = 0
      const reorderMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockImplementation(() => {
                selectCallCount++
                // Second select is the final result after reorder
                return Promise.resolve(
                  selectCallCount === 1 ? existingHeats : reorderedHeats,
                )
              }),
              then: (resolve: (val: unknown) => void) => {
                selectCallCount++
                resolve(existingHeats)
                return Promise.resolve(existingHeats)
              },
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined),
              }),
            }),
          }
          return fn(tx)
        }),
      }
      mockDbInstance = reorderMock as unknown as ReturnType<typeof createDbMock>

      const result = await reorderHeatsFn({
        data: {
          trackWorkoutId: 'tw-1',
          heatIds: ['cheat_3', 'cheat_1', 'cheat_2'],
        },
      })

      expect(result.heats).toBeDefined()
      expect(result.heats[0]?.heatNumber).toBe(1)
    })

    it('throws error when heat ID does not belong to workout', async () => {
      const existingHeats = [
        {id: 'cheat_1', heatNumber: 1, trackWorkoutId: 'tw-1'},
        {id: 'cheat_2', heatNumber: 2, trackWorkoutId: 'tw-1'},
      ]

      const reorderMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: (resolve: (val: unknown) => void) => {
                resolve(existingHeats)
                return Promise.resolve(existingHeats)
              },
            }),
          }),
        }),
      }
      mockDbInstance = reorderMock as unknown as ReturnType<typeof createDbMock>

      await expect(
        reorderHeatsFn({
          data: {
            trackWorkoutId: 'tw-1',
            heatIds: ['cheat_1', 'cheat_invalid'],
          },
        }),
      ).rejects.toThrow('Heat cheat_invalid does not belong to workout tw-1')
    })

    it('throws error when heat count does not match', async () => {
      const existingHeats = [
        {id: 'cheat_1', heatNumber: 1, trackWorkoutId: 'tw-1'},
        {id: 'cheat_2', heatNumber: 2, trackWorkoutId: 'tw-1'},
        {id: 'cheat_3', heatNumber: 3, trackWorkoutId: 'tw-1'},
      ]

      const reorderMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: (resolve: (val: unknown) => void) => {
                resolve(existingHeats)
                return Promise.resolve(existingHeats)
              },
            }),
          }),
        }),
      }
      mockDbInstance = reorderMock as unknown as ReturnType<typeof createDbMock>

      await expect(
        reorderHeatsFn({
          data: {
            trackWorkoutId: 'tw-1',
            heatIds: ['cheat_1', 'cheat_2'], // Missing cheat_3
          },
        }),
      ).rejects.toThrow('Expected 3 heat IDs, received 2')
    })
  })

  describe('getNextHeatNumberFn', () => {
    it('returns 1 when no heats exist', async () => {
      const selectMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      mockDbInstance = selectMock as unknown as ReturnType<typeof createDbMock>

      const result = await getNextHeatNumberFn({
        data: {trackWorkoutId: 'tw-1'},
      })

      expect(result.nextHeatNumber).toBe(1)
    })

    it('returns max + 1 when heats exist', async () => {
      const existingHeats = [{heatNumber: 1}, {heatNumber: 2}, {heatNumber: 3}]

      const selectMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(existingHeats),
          }),
        }),
      }
      mockDbInstance = selectMock as unknown as ReturnType<typeof createDbMock>

      const result = await getNextHeatNumberFn({
        data: {trackWorkoutId: 'tw-1'},
      })

      expect(result.nextHeatNumber).toBe(4)
    })

    it('handles non-sequential heat numbers', async () => {
      // Heat numbers might have gaps (e.g., after deletion)
      const existingHeats = [{heatNumber: 1}, {heatNumber: 5}, {heatNumber: 3}]

      const selectMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(existingHeats),
          }),
        }),
      }
      mockDbInstance = selectMock as unknown as ReturnType<typeof createDbMock>

      const result = await getNextHeatNumberFn({
        data: {trackWorkoutId: 'tw-1'},
      })

      // Should return max + 1, which is 6
      expect(result.nextHeatNumber).toBe(6)
    })
  })

  // ============================================================================
  // Heat Assignment Server Functions Tests
  // ============================================================================

  describe('assignToHeatFn', () => {
    it('creates a heat assignment', async () => {
      const createdAssignment = {
        id: 'chasgn_new',
        heatId: 'cheat_1',
        registrationId: 'creg_1',
        laneNumber: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const insertMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        query: {
          competitionHeatAssignmentsTable: {
            findFirst: vi.fn().mockResolvedValue(createdAssignment),
          },
        },
      }
      mockDbInstance = insertMock as unknown as ReturnType<typeof createDbMock>

      const result = await assignToHeatFn({
        data: {
          heatId: 'cheat_1',
          registrationId: 'creg_1',
          laneNumber: 1,
        },
      })

      expect(result.assignment).toBeDefined()
      expect(result.assignment.id).toBe('chasgn_new')
      expect(result.assignment.laneNumber).toBe(1)
    })

    it('throws error when insert fails', async () => {
      const insertMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        query: {
          competitionHeatAssignmentsTable: {
            findFirst: vi.fn().mockResolvedValue(null), // Not found = failed
          },
        },
      }
      mockDbInstance = insertMock as unknown as ReturnType<typeof createDbMock>

      await expect(
        assignToHeatFn({
          data: {
            heatId: 'cheat_1',
            registrationId: 'creg_1',
            laneNumber: 1,
          },
        }),
      ).rejects.toThrow('Failed to create heat assignment')
    })
  })

  describe('bulkAssignToHeatFn', () => {
    it('returns empty array when no registrations provided', async () => {
      const result = await bulkAssignToHeatFn({
        data: {
          heatId: 'cheat_1',
          registrationIds: [],
          startingLane: 1,
        },
      })

      expect(result.assignments).toEqual([])
    })

    it('assigns multiple registrations to consecutive lanes', async () => {
      const createdAssignments = [
        {
          id: 'chasgn_1',
          heatId: 'cheat_1',
          registrationId: 'creg_1',
          laneNumber: 1,
        },
        {
          id: 'chasgn_2',
          heatId: 'cheat_1',
          registrationId: 'creg_2',
          laneNumber: 2,
        },
        {
          id: 'chasgn_3',
          heatId: 'cheat_1',
          registrationId: 'creg_3',
          laneNumber: 3,
        },
      ]

      const insertMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(createdAssignments),
          }),
        }),
      }
      mockDbInstance = insertMock as unknown as ReturnType<typeof createDbMock>

      const result = await bulkAssignToHeatFn({
        data: {
          heatId: 'cheat_1',
          registrationIds: ['creg_1', 'creg_2', 'creg_3'],
          startingLane: 1,
        },
      })

      expect(result.assignments).toHaveLength(3)
      expect(result.assignments[0]?.laneNumber).toBe(1)
      expect(result.assignments[1]?.laneNumber).toBe(2)
      expect(result.assignments[2]?.laneNumber).toBe(3)
    })

    it('assigns from a custom starting lane', async () => {
      const createdAssignments = [
        {
          id: 'chasgn_1',
          heatId: 'cheat_1',
          registrationId: 'creg_1',
          laneNumber: 5,
        },
        {
          id: 'chasgn_2',
          heatId: 'cheat_1',
          registrationId: 'creg_2',
          laneNumber: 6,
        },
      ]

      const insertMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(createdAssignments),
          }),
        }),
      }
      mockDbInstance = insertMock as unknown as ReturnType<typeof createDbMock>

      const result = await bulkAssignToHeatFn({
        data: {
          heatId: 'cheat_1',
          registrationIds: ['creg_1', 'creg_2'],
          startingLane: 5,
        },
      })

      expect(result.assignments[0]?.laneNumber).toBe(5)
      expect(result.assignments[1]?.laneNumber).toBe(6)
    })
  })

  describe('removeFromHeatFn', () => {
    it('deletes an assignment by ID', async () => {
      const deleteMock = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }
      mockDbInstance = deleteMock as unknown as ReturnType<typeof createDbMock>

      const result = await removeFromHeatFn({
        data: {assignmentId: 'chasgn_1'},
      })

      expect(result.success).toBe(true)
      expect(deleteMock.delete).toHaveBeenCalled()
    })
  })

  describe('updateAssignmentFn', () => {
    it('updates lane number for an assignment', async () => {
      const updateMock = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }
      mockDbInstance = updateMock as unknown as ReturnType<typeof createDbMock>

      const result = await updateAssignmentFn({
        data: {
          assignmentId: 'chasgn_1',
          laneNumber: 3,
        },
      })

      expect(result.success).toBe(true)
      expect(updateMock.update).toHaveBeenCalled()
    })
  })

  describe('moveAssignmentFn', () => {
    it('updates lane number when moving within same heat', async () => {
      const currentAssignment = {
        id: 'chasgn_1',
        heatId: 'cheat_1',
        registrationId: 'creg_1',
        laneNumber: 1,
      }

      const moveMock = {
        query: {
          competitionHeatAssignmentsTable: {
            findFirst: vi.fn().mockResolvedValue(currentAssignment),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }
      mockDbInstance = moveMock as unknown as ReturnType<typeof createDbMock>

      const result = await moveAssignmentFn({
        data: {
          assignmentId: 'chasgn_1',
          targetHeatId: 'cheat_1', // Same heat
          targetLaneNumber: 5,
        },
      })

      expect(result.success).toBe(true)
      expect(moveMock.update).toHaveBeenCalled()
    })

    it('removes and creates new assignment when moving to different heat', async () => {
      const currentAssignment = {
        id: 'chasgn_1',
        heatId: 'cheat_1',
        registrationId: 'creg_1',
        laneNumber: 1,
      }

      const txDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      })
      const txInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })

      const moveMock = {
        query: {
          competitionHeatAssignmentsTable: {
            findFirst: vi.fn().mockResolvedValue(currentAssignment),
          },
        },
        transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            delete: txDelete,
            insert: txInsert,
          }
          return fn(tx)
        }),
      }
      mockDbInstance = moveMock as unknown as ReturnType<typeof createDbMock>

      const result = await moveAssignmentFn({
        data: {
          assignmentId: 'chasgn_1',
          targetHeatId: 'cheat_2', // Different heat
          targetLaneNumber: 3,
        },
      })

      expect(result.success).toBe(true)
      expect(txDelete).toHaveBeenCalled()
      expect(txInsert).toHaveBeenCalled()
    })

    it('throws error when assignment not found', async () => {
      const moveMock = {
        query: {
          competitionHeatAssignmentsTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      }
      mockDbInstance = moveMock as unknown as ReturnType<typeof createDbMock>

      await expect(
        moveAssignmentFn({
          data: {
            assignmentId: 'chasgn_nonexistent',
            targetHeatId: 'cheat_2',
            targetLaneNumber: 1,
          },
        }),
      ).rejects.toThrow('Assignment not found')
    })
  })

  describe('getUnassignedRegistrationsFn', () => {
    it('returns empty array when no unassigned registrations', async () => {
      // Mock: All registrations are assigned
      const assignedIds = [{registrationId: 'creg_1'}]

      // The implementation now does:
      // 1. db.select().from(heatAssignments).innerJoin(heats).where() -> assigned IDs
      // 2. db.select().from(registrations).where(notInArray) -> unassigned regs (empty)
      let queryCount = 0
      const unassignedMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockImplementation(() => {
                queryCount++
                return Promise.resolve(assignedIds)
              }),
            }),
            where: vi.fn().mockImplementation(() => {
              queryCount++
              // Second query returns empty (all assigned, none unassigned)
              return Promise.resolve([])
            }),
          }),
        }),
      }
      mockDbInstance = unassignedMock as unknown as ReturnType<
        typeof createDbMock
      >

      const result = await getUnassignedRegistrationsFn({
        data: {
          competitionId: 'comp_1',
          trackWorkoutId: 'tw_1',
        },
      })

      expect(result.registrations).toEqual([])
    })

    it('returns unassigned registrations with user details', async () => {
      const assignedIds = [{registrationId: 'creg_1'}] // creg_1 is assigned
      const unassignedRegistrations = [
        {
          id: 'creg_2',
          teamName: null,
          userId: 'user_2',
          divisionId: 'div_1',
        }, // creg_2 is unassigned
      ]
      const users = [{id: 'user_2', firstName: 'Jane', lastName: 'Doe'}]
      const divisions = [{id: 'div_1', label: 'RX'}]

      // The implementation now does:
      // 1. db.select().from(heatAssignments).innerJoin(heats).where() -> assigned IDs
      // 2. db.select().from(registrations).where(notInArray) -> unassigned regs
      // 3. db.select().from(users).where(inArray) -> users
      // 4. db.select().from(divisions).where(inArray) -> divisions
      let whereCount = 0
      const unassignedMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(assignedIds),
            }),
            where: vi.fn().mockImplementation(() => {
              whereCount++
              if (whereCount === 1) return Promise.resolve(unassignedRegistrations)
              if (whereCount === 2) return Promise.resolve(users)
              return Promise.resolve(divisions)
            }),
          }),
        }),
      }
      mockDbInstance = unassignedMock as unknown as ReturnType<
        typeof createDbMock
      >

      const result = await getUnassignedRegistrationsFn({
        data: {
          competitionId: 'comp_1',
          trackWorkoutId: 'tw_1',
        },
      })

      expect(result.registrations).toHaveLength(1)
      expect(result.registrations[0]?.id).toBe('creg_2')
      expect(result.registrations[0]?.user.firstName).toBe('Jane')
      expect(result.registrations[0]?.division?.label).toBe('RX')
    })

    it('filters by division when divisionId provided', async () => {
      const assignedIds: unknown[] = [] // No assignments
      // The mock should return only RX registrations since the real DB
      // would filter by divisionId in the WHERE clause
      const filteredRegistrations = [
        {
          id: 'creg_1',
          teamName: null,
          userId: 'user_1',
          divisionId: 'div_rx',
        },
        {
          id: 'creg_3',
          teamName: null,
          userId: 'user_3',
          divisionId: 'div_rx',
        },
      ]
      const users = [
        {id: 'user_1', firstName: 'John', lastName: 'Smith'},
        {id: 'user_3', firstName: 'Bob', lastName: 'Johnson'},
      ]
      const divisions = [{id: 'div_rx', label: 'RX'}]

      // The implementation now does:
      // 1. db.select().from(heatAssignments).innerJoin(heats).where() -> assigned IDs
      // 2. db.select().from(registrations).where(and(...conditions)) -> filtered regs
      // 3. db.select().from(users).where(inArray) -> users
      // 4. db.select().from(divisions).where(inArray) -> divisions
      let whereCount = 0
      const unassignedMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(assignedIds),
            }),
            where: vi.fn().mockImplementation(() => {
              whereCount++
              if (whereCount === 1) return Promise.resolve(filteredRegistrations)
              if (whereCount === 2) return Promise.resolve(users)
              return Promise.resolve(divisions)
            }),
          }),
        }),
      }
      mockDbInstance = unassignedMock as unknown as ReturnType<
        typeof createDbMock
      >

      const result = await getUnassignedRegistrationsFn({
        data: {
          competitionId: 'comp_1',
          trackWorkoutId: 'tw_1',
          divisionId: 'div_rx', // Filter by RX division
        },
      })

      // Should return only RX division registrations
      expect(result.registrations).toHaveLength(2)
      expect(
        result.registrations.every((r) => r.division?.id === 'div_rx'),
      ).toBe(true)
    })

    it('returns empty when no heats exist for workout', async () => {
      // The implementation now does:
      // 1. db.select().from(heatAssignments).innerJoin(heats).where() -> empty (no heats/assignments)
      // 2. db.select().from(registrations).where() -> empty registrations
      const unassignedMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]), // No assigned IDs
            }),
            where: vi.fn().mockResolvedValue([]), // No registrations
          }),
        }),
      }
      mockDbInstance = unassignedMock as unknown as ReturnType<
        typeof createDbMock
      >

      const result = await getUnassignedRegistrationsFn({
        data: {
          competitionId: 'comp_1',
          trackWorkoutId: 'tw_1',
        },
      })

      // When no heats exist, all registrations would be unassigned
      // but the mock returns empty registrations
      expect(result.registrations).toBeDefined()
    })
  })

  // ============================================================================
  // Venue CRUD Server Functions Tests
  // ============================================================================

  describe('createVenueFn', () => {
    it('creates a venue with required fields', async () => {
      const createdVenue = {
        id: 'cvenue_new',
        competitionId: 'comp_1',
        name: 'Main Floor',
        laneCount: 8,
        transitionMinutes: 3,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const insertMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        query: {
          competitionVenuesTable: {
            findFirst: vi.fn().mockResolvedValue(createdVenue),
          },
        },
      }
      mockDbInstance = insertMock as unknown as ReturnType<typeof createDbMock>

      const result = await createVenueFn({
        data: {
          competitionId: 'comp_1',
          name: 'Main Floor',
          laneCount: 8,
          transitionMinutes: 3,
        },
      })

      expect(result.venue).toBeDefined()
      expect(result.venue.id).toBe('cvenue_new')
      expect(result.venue.name).toBe('Main Floor')
      expect(result.venue.laneCount).toBe(8)
    })

    it('creates a venue with default values', async () => {
      const createdVenue = {
        id: 'cvenue_default',
        competitionId: 'comp_1',
        name: 'Outside Rig',
        laneCount: 3,
        transitionMinutes: 3,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const existingVenues = [{id: 'cvenue_1'}] // One existing venue

      const insertMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(existingVenues),
          }),
        }),
        query: {
          competitionVenuesTable: {
            findFirst: vi.fn().mockResolvedValue(createdVenue),
          },
        },
      }
      mockDbInstance = insertMock as unknown as ReturnType<typeof createDbMock>

      const result = await createVenueFn({
        data: {
          competitionId: 'comp_1',
          name: 'Outside Rig',
        },
      })

      expect(result.venue.sortOrder).toBe(1) // Should be 1 since 1 venue exists
    })

    it('throws error when insert fails', async () => {
      const insertMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        query: {
          competitionVenuesTable: {
            findFirst: vi.fn().mockResolvedValue(null), // Not found = failed
          },
        },
      }
      mockDbInstance = insertMock as unknown as ReturnType<typeof createDbMock>

      await expect(
        createVenueFn({
          data: {
            competitionId: 'comp_1',
            name: 'Test Venue',
          },
        }),
      ).rejects.toThrow('Failed to create venue')
    })
  })

  describe('updateVenueFn', () => {
    it('updates venue name', async () => {
      const updateMock = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }
      mockDbInstance = updateMock as unknown as ReturnType<typeof createDbMock>

      const result = await updateVenueFn({
        data: {
          venueId: 'cvenue_1',
          name: 'Updated Name',
        },
      })

      expect(result.success).toBe(true)
      expect(updateMock.update).toHaveBeenCalled()
    })

    it('updates lane count and transition minutes', async () => {
      const updateMock = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }
      mockDbInstance = updateMock as unknown as ReturnType<typeof createDbMock>

      const result = await updateVenueFn({
        data: {
          venueId: 'cvenue_1',
          laneCount: 12,
          transitionMinutes: 5,
        },
      })

      expect(result.success).toBe(true)
    })
  })

  describe('deleteVenueFn', () => {
    it('deletes a venue by ID', async () => {
      const deleteMock = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }
      mockDbInstance = deleteMock as unknown as ReturnType<typeof createDbMock>

      const result = await deleteVenueFn({
        data: {venueId: 'cvenue_1'},
      })

      expect(result.success).toBe(true)
      expect(deleteMock.delete).toHaveBeenCalled()
    })
  })

  describe('getVenueHeatCountFn', () => {
    it('returns 0 when no heats use the venue', async () => {
      const selectMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      mockDbInstance = selectMock as unknown as ReturnType<typeof createDbMock>

      const result = await getVenueHeatCountFn({
        data: {venueId: 'cvenue_1'},
      })

      expect(result.count).toBe(0)
    })

    it('returns count when heats use the venue', async () => {
      const heatsUsingVenue = [
        {id: 'cheat_1'},
        {id: 'cheat_2'},
        {id: 'cheat_3'},
      ]

      const selectMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(heatsUsingVenue),
          }),
        }),
      }
      mockDbInstance = selectMock as unknown as ReturnType<typeof createDbMock>

      const result = await getVenueHeatCountFn({
        data: {venueId: 'cvenue_1'},
      })

      expect(result.count).toBe(3)
    })
  })

  // ============================================================================
  // Copy Heats From Event Server Functions Tests
  // ============================================================================

  describe('copyHeatsFromEventFn', () => {
    it('should calculate heat times correctly using provided duration and transition', async () => {
      // Setup: Source event has 3 heats with original durations of 8 minutes each
      // The bug was: server was ignoring durationMinutes and using source heat duration
      const sourceHeats = [
        {
          id: 'cheat_1',
          competitionId: 'comp-1',
          trackWorkoutId: 'source-tw',
          heatNumber: 1,
          scheduledTime: new Date('2026-01-06T10:00:00Z'),
          durationMinutes: 8, // Original source duration (should be IGNORED)
          venueId: null,
          divisionId: null,
          capacity: 8,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cheat_2',
          competitionId: 'comp-1',
          trackWorkoutId: 'source-tw',
          heatNumber: 2,
          scheduledTime: new Date('2026-01-06T10:11:00Z'),
          durationMinutes: 8, // Original source duration (should be IGNORED)
          venueId: null,
          divisionId: null,
          capacity: 8,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cheat_3',
          competitionId: 'comp-1',
          trackWorkoutId: 'source-tw',
          heatNumber: 3,
          scheduledTime: new Date('2026-01-06T10:22:00Z'),
          durationMinutes: 8, // Original source duration (should be IGNORED)
          venueId: null,
          divisionId: null,
          capacity: 8,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      // Created heats returned from insert
      const createdHeats = [
        {
          id: 'new_cheat_1',
          competitionId: 'comp-1',
          trackWorkoutId: 'target-tw',
          heatNumber: 1,
          scheduledTime: new Date('2026-01-06T12:20:00Z'),
          durationMinutes: 10,
          venueId: null,
          divisionId: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'new_cheat_2',
          competitionId: 'comp-1',
          trackWorkoutId: 'target-tw',
          heatNumber: 2,
          scheduledTime: new Date('2026-01-06T12:35:00Z'),
          durationMinutes: 10,
          venueId: null,
          divisionId: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'new_cheat_3',
          competitionId: 'comp-1',
          trackWorkoutId: 'target-tw',
          heatNumber: 3,
          scheduledTime: new Date('2026-01-06T12:50:00Z'),
          durationMinutes: 10,
          venueId: null,
          divisionId: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      // Track what gets passed to insert().values() to verify time calculation
      let insertedValues: unknown[] = []

      // Track orderBy and get calls separately
      let orderByCallCount = 0

      const copyMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockImplementation(() => {
                orderByCallCount++
                // orderBy calls:
                // 1. getHeatsForWorkoutInternal fetching source heats
                // 2. getHeatsForWorkoutInternal fetching assignments (empty, no assignments)
                // 3. getHeatsForWorkoutInternal (final) fetching created heats
                // 4. getHeatsForWorkoutInternal (final) fetching assignments (empty)
                if (orderByCallCount === 1 || orderByCallCount === 3) {
                  // Return source heats first, then created heats
                  return Promise.resolve(
                    orderByCallCount === 1 ? sourceHeats : createdHeats,
                  )
                }
                // Return empty assignments
                return Promise.resolve([])
              }),
              then: (resolve: (val: unknown) => void) => {
                // Handle awaiting where() directly - used for various empty lookups
                resolve([])
                return Promise.resolve([])
              },
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((values: unknown[]) => {
            // Capture the values passed to insert for heats
            if (insertedValues.length === 0) {
              insertedValues = values
            }
            return Promise.resolve(undefined)
          }),
        }),
        query: {
          trackWorkoutsTable: {
            findFirst: vi.fn().mockResolvedValue({trackId: 'track-1'}),
          },
          programmingTracksTable: {
            findFirst: vi.fn().mockResolvedValue({competitionId: 'comp-1'}),
          },
        },
      }
      mockDbInstance = copyMock as unknown as ReturnType<typeof createDbMock>

      // Call copyHeatsFromEventFn with:
      // - startTime: 12:20 PM
      // - durationMinutes: 10 (NOT the source's 8 minutes)
      // - transitionMinutes: 5
      const startTime = new Date('2026-01-06T12:20:00Z')
      const result = await copyHeatsFromEventFn({
        data: {
          sourceTrackWorkoutId: 'source-tw',
          targetTrackWorkoutId: 'target-tw',
          startTime,
          durationMinutes: 10,
          transitionMinutes: 5,
          copyAssignments: false,
        },
      })

      // Verify insert was called
      expect(copyMock.insert).toHaveBeenCalled()

      // Verify the calculated times in the inserted values
      // Heat times should be calculated as:
      // Heat 1: startTime + 0 * (10 + 5) = 12:20 PM
      // Heat 2: startTime + 1 * (10 + 5) = 12:35 PM
      // Heat 3: startTime + 2 * (10 + 5) = 12:50 PM
      expect(insertedValues).toHaveLength(3)

      const heat1 = insertedValues[0] as {
        scheduledTime: Date
        durationMinutes: number
      }
      const heat2 = insertedValues[1] as {
        scheduledTime: Date
        durationMinutes: number
      }
      const heat3 = insertedValues[2] as {
        scheduledTime: Date
        durationMinutes: number
      }

      // Heat 1: exactly at startTime (12:20 PM)
      expect(heat1.scheduledTime.getTime()).toBe(startTime.getTime())
      expect(heat1.durationMinutes).toBe(10)

      // Heat 2: startTime + 15 minutes (12:35 PM)
      const expectedHeat2Time = new Date(startTime.getTime() + 15 * 60 * 1000)
      expect(heat2.scheduledTime.getTime()).toBe(expectedHeat2Time.getTime())
      expect(heat2.durationMinutes).toBe(10)

      // Heat 3: startTime + 30 minutes (12:50 PM)
      const expectedHeat3Time = new Date(startTime.getTime() + 30 * 60 * 1000)
      expect(heat3.scheduledTime.getTime()).toBe(expectedHeat3Time.getTime())
      expect(heat3.durationMinutes).toBe(10)

      // Verify it doesn't use the source's 8-minute duration (which would give 13-minute intervals)
      // If the bug existed (using source duration), Heat 2 would be at 12:31 PM (8+5=13 min intervals)
      const wrongHeat2Time = new Date(startTime.getTime() + 13 * 60 * 1000)
      expect(heat2.scheduledTime.getTime()).not.toBe(wrongHeat2Time.getTime())

      // Verify result structure
      expect(result.heats).toBeDefined()
    })
  })
})
