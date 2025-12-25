import {beforeEach, afterEach, describe, it, expect, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
import {TEAM_PERMISSIONS} from '@/db/schema'
import {
  getCompetitionDivisionFeesFn,
  updateCompetitionFeeConfigFn,
  updateDivisionFeeFn,
} from '@/server-fns/commerce'

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Mock auth
const mockSession = {
  userId: 'user-123',
  user: {email: 'test@example.com'},
  teams: [
    {
      id: 'team-123',
      permissions: [
        TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
        TEAM_PERMISSIONS.ACCESS_DASHBOARD,
      ],
    },
  ],
}

vi.mock('@/utils/auth', () => ({
  getSessionFromCookie: vi.fn(() => Promise.resolve(mockSession)),
  requireVerifiedEmail: vi.fn(() => Promise.resolve(mockSession)),
}))

// Mock TanStack createServerFn to make server functions directly callable in tests
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let handlerFn: any
    return {
      inputValidator: () => ({
        handler: (fn: any) => {
          handlerFn = fn
          // Return a callable that directly invokes the handler
          return handlerFn
        },
      }),
    }
  },
}))

// Test data
const testCompetitionId = 'comp-123'
const testDivisionId = 'div-456'
const testOrganizingTeamId = 'team-123'

// Mock competition object
const mockCompetition = {
  id: testCompetitionId,
  name: 'Test Competition',
  organizingTeamId: testOrganizingTeamId,
  defaultRegistrationFeeCents: 5000,
  platformFeePercentage: null,
  platformFeeFixed: null,
  passStripeFeesToCustomer: false,
  passPlatformFeesToCustomer: true,
}

// Mock division fees
const mockDivisionFees = [
  {
    divisionId: 'div-1',
    feeCents: 4000,
    division: {label: 'Rx'},
  },
  {
    divisionId: 'div-2',
    feeCents: 3500,
    division: {label: 'Scaled'},
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.reset()

  // Register tables for query API
  mockDb.registerTable('competitionsTable')
  mockDb.registerTable('competitionDivisionsTable')
})

afterEach(() => {
  vi.clearAllMocks()
})

// Helper to set up the chain mock with limit support
function mockChainWithLimit(values: unknown[]) {
  const limitMock = mockDb.getChainMock().limit as any
  limitMock.mockResolvedValueOnce(values)
}

describe('commerce server functions', () => {
  describe('getCompetitionDivisionFeesFn', () => {
    it('should return division fees and default fee for a competition', async () => {
      // Mock competitionDivisionsTable.findMany
      mockDb.query.competitionDivisionsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue(mockDivisionFees),
      }

      // Mock competitionsTable.findFirst
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      }

      const result = await getCompetitionDivisionFeesFn({
        data: {competitionId: testCompetitionId},
      })

      expect(result).toBeDefined()
      expect(result.defaultFeeCents).toBe(5000)
      expect(result.divisionFees).toHaveLength(2)
      expect(result.divisionFees[0]).toEqual({
        divisionId: 'div-1',
        divisionLabel: 'Rx',
        feeCents: 4000,
      })
    })

    it('should return 0 as default fee when competition has no default set', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue({
          ...mockCompetition,
          defaultRegistrationFeeCents: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      mockDb.query.competitionDivisionsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await getCompetitionDivisionFeesFn({
        data: {competitionId: testCompetitionId},
      })

      expect(result.defaultFeeCents).toBe(0)
      expect(result.divisionFees).toHaveLength(0)
    })

    it('should return empty division fees when no divisions configured', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      }

      mockDb.query.competitionDivisionsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await getCompetitionDivisionFeesFn({
        data: {competitionId: testCompetitionId},
      })

      expect(result.divisionFees).toHaveLength(0)
    })

    it('should handle null division label gracefully', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      }

      mockDb.query.competitionDivisionsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          {
            divisionId: 'div-1',
            feeCents: 4000,
            division: null,
          },
        ]),
      }

      const result = await getCompetitionDivisionFeesFn({
        data: {competitionId: testCompetitionId},
      })

      expect(result.divisionFees[0].divisionLabel).toBeUndefined()
    })
  })

  describe('updateCompetitionFeeConfigFn', () => {
    it('should successfully update competition fee config with valid input', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      }

      const result = await updateCompetitionFeeConfigFn({
        data: {
          competitionId: testCompetitionId,
          defaultRegistrationFeeCents: 7500,
          platformFeePercentage: 3,
          platformFeeFixed: 250,
          passStripeFeesToCustomer: true,
          passPlatformFeesToCustomer: false,
        },
      })

      expect(result).toEqual({success: true})
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should require authentication', async () => {
      const {requireVerifiedEmail} = await import('@/utils/auth')
      vi.mocked(requireVerifiedEmail).mockResolvedValueOnce(null)

      await expect(
        updateCompetitionFeeConfigFn({
          data: {
            competitionId: testCompetitionId,
          },
        }),
      ).rejects.toThrow('Unauthorized')
    })

    it('should throw when competition not found', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        updateCompetitionFeeConfigFn({
          data: {
            competitionId: 'nonexistent-comp',
          },
        }),
      ).rejects.toThrow('Competition not found')
    })

    it('should throw when user lacks permission', async () => {
      // Session with no permissions for the team
      const noPermSession = {
        userId: 'user-123',
        user: {email: 'test@example.com'},
        teams: [
          {
            id: 'different-team',
            permissions: [],
          },
        ],
      }

      const {getSessionFromCookie} = await import('@/utils/auth')
      vi.mocked(getSessionFromCookie).mockResolvedValueOnce(noPermSession as any)

      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      }

      await expect(
        updateCompetitionFeeConfigFn({
          data: {
            competitionId: testCompetitionId,
          },
        }),
      ).rejects.toThrow('Missing required permission')
    })

    it('should allow null values for optional fee settings', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      }

      const result = await updateCompetitionFeeConfigFn({
        data: {
          competitionId: testCompetitionId,
          platformFeePercentage: null,
          platformFeeFixed: null,
        },
      })

      expect(result).toEqual({success: true})
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('updateDivisionFeeFn', () => {
    it('should successfully create a new division fee', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      }

      mockDb.query.competitionDivisionsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await updateDivisionFeeFn({
        data: {
          competitionId: testCompetitionId,
          divisionId: testDivisionId,
          feeCents: 4500,
        },
      })

      expect(result).toEqual({success: true})
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should update an existing division fee', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      }

      mockDb.query.competitionDivisionsTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'existing-fee-id',
          competitionId: testCompetitionId,
          divisionId: testDivisionId,
          feeCents: 3000,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await updateDivisionFeeFn({
        data: {
          competitionId: testCompetitionId,
          divisionId: testDivisionId,
          feeCents: 4500,
        },
      })

      expect(result).toEqual({success: true})
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should delete division fee when feeCents is null', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      }

      const result = await updateDivisionFeeFn({
        data: {
          competitionId: testCompetitionId,
          divisionId: testDivisionId,
          feeCents: null,
        },
      })

      expect(result).toEqual({success: true})
      expect(mockDb.delete).toHaveBeenCalled()
    })

    it('should require authentication', async () => {
      const {requireVerifiedEmail} = await import('@/utils/auth')
      vi.mocked(requireVerifiedEmail).mockResolvedValueOnce(null)

      await expect(
        updateDivisionFeeFn({
          data: {
            competitionId: testCompetitionId,
            divisionId: testDivisionId,
            feeCents: 5000,
          },
        }),
      ).rejects.toThrow('Unauthorized')
    })

    it('should throw when competition not found', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        updateDivisionFeeFn({
          data: {
            competitionId: 'nonexistent-comp',
            divisionId: testDivisionId,
            feeCents: 5000,
          },
        }),
      ).rejects.toThrow('Competition not found')
    })

    it('should handle zero fee (making division free)', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      }

      mockDb.query.competitionDivisionsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await updateDivisionFeeFn({
        data: {
          competitionId: testCompetitionId,
          divisionId: testDivisionId,
          feeCents: 0,
        },
      })

      expect(result).toEqual({success: true})
      // Should insert, not delete - 0 is a valid fee (free)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    describe('updateCompetitionFeeConfig edge cases', () => {
      it('should handle updating all boolean flags together', async () => {
        mockDb.query.competitionsTable = {
          findFirst: vi.fn().mockResolvedValue(mockCompetition),
          findMany: vi.fn().mockResolvedValue([mockCompetition]),
        }

        const result = await updateCompetitionFeeConfigFn({
          data: {
            competitionId: testCompetitionId,
            passStripeFeesToCustomer: true,
            passPlatformFeesToCustomer: false,
          },
        })

        expect(result).toEqual({success: true})
        expect(mockDb.update).toHaveBeenCalled()
      })
    })
  })

  describe('Integration scenarios', () => {
    it('should support typical organizer workflow: set default fee, then override division', async () => {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([mockCompetition]),
      }

      mockDb.query.competitionDivisionsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      // First: update competition default fee
      const feeConfigResult = await updateCompetitionFeeConfigFn({
        data: {
          competitionId: testCompetitionId,
          defaultRegistrationFeeCents: 7500,
        },
      })
      expect(feeConfigResult.success).toBe(true)

      // Second: add division-specific override
      const divisionResult = await updateDivisionFeeFn({
        data: {
          competitionId: testCompetitionId,
          divisionId: testDivisionId,
          feeCents: 6000,
        },
      })
      expect(divisionResult.success).toBe(true)
    })
  })
})
