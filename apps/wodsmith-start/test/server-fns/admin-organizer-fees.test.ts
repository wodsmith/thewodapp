import {beforeEach, afterEach, describe, it, expect, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
import {
  updateOrganizerFeeFn,
  getOrganizerFeeFn,
} from '@/server-fns/admin-team-fns'

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Mock admin session
const mockAdminSession = {
  userId: 'admin-user-123',
  user: {email: 'admin@example.com', role: 'ADMIN'},
  teams: [],
}

vi.mock('@/utils/auth', () => ({
  requireAdmin: vi.fn(() => Promise.resolve(mockAdminSession)),
}))

// Mock TanStack createServerFn to make server functions directly callable in tests
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let handlerFn: any
    const chainable = {
      inputValidator: () => ({
        handler: (fn: any) => {
          handlerFn = fn
          return handlerFn
        },
      }),
      handler: (fn: any) => {
        handlerFn = fn
        return handlerFn
      },
    }
    return chainable
  },
}))

// Test data
const testTeamId = 'team-123'
const testTeamName = 'Test Gym'

const mockTeam = {
  id: testTeamId,
  name: testTeamName,
  organizerFeePercentage: null,
  organizerFeeFixed: null,
}

const mockFoundingOrganizerTeam = {
  id: testTeamId,
  name: testTeamName,
  organizerFeePercentage: 250, // 2.5%
  organizerFeeFixed: 200, // $2.00
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.reset()
  mockDb.registerTable('teamTable')
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Admin Organizer Fee Functions', () => {
  describe('getOrganizerFeeFn', () => {
    it('should return team fee settings with no custom fee', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(mockTeam),
        findMany: vi.fn().mockResolvedValue([mockTeam]),
      }

      const result = await getOrganizerFeeFn({
        data: {teamId: testTeamId},
      })

      expect(result.teamId).toBe(testTeamId)
      expect(result.teamName).toBe(testTeamName)
      expect(result.organizerFeePercentage).toBeNull()
      expect(result.organizerFeeFixed).toBeNull()
      expect(result.hasCustomFee).toBe(false)
    })

    it('should return team fee settings with founding organizer rate', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(mockFoundingOrganizerTeam),
        findMany: vi.fn().mockResolvedValue([mockFoundingOrganizerTeam]),
      }

      const result = await getOrganizerFeeFn({
        data: {teamId: testTeamId},
      })

      expect(result.teamId).toBe(testTeamId)
      expect(result.organizerFeePercentage).toBe(250)
      expect(result.organizerFeeFixed).toBe(200)
      expect(result.hasCustomFee).toBe(true)
    })

    it('should throw when team not found', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        getOrganizerFeeFn({
          data: {teamId: 'nonexistent-team'},
        }),
      ).rejects.toThrow('Team not found')
    })

    it('should require admin authentication', async () => {
      const {requireAdmin} = await import('@/utils/auth')
      vi.mocked(requireAdmin).mockResolvedValueOnce(null)

      await expect(
        getOrganizerFeeFn({
          data: {teamId: testTeamId},
        }),
      ).rejects.toThrow('Not authorized - admin access required')
    })

    it('should detect hasCustomFee when only percentage is set', async () => {
      const teamWithPartialOverride = {
        ...mockTeam,
        organizerFeePercentage: 250,
        organizerFeeFixed: null,
      }

      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(teamWithPartialOverride),
        findMany: vi.fn().mockResolvedValue([teamWithPartialOverride]),
      }

      const result = await getOrganizerFeeFn({
        data: {teamId: testTeamId},
      })

      expect(result.hasCustomFee).toBe(true)
    })

    it('should detect hasCustomFee when only fixed fee is set', async () => {
      const teamWithPartialOverride = {
        ...mockTeam,
        organizerFeePercentage: null,
        organizerFeeFixed: 300,
      }

      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(teamWithPartialOverride),
        findMany: vi.fn().mockResolvedValue([teamWithPartialOverride]),
      }

      const result = await getOrganizerFeeFn({
        data: {teamId: testTeamId},
      })

      expect(result.hasCustomFee).toBe(true)
    })
  })

  describe('updateOrganizerFeeFn', () => {
    it('should set founding organizer fee rate', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(mockTeam),
        findMany: vi.fn().mockResolvedValue([mockTeam]),
      }

      const result = await updateOrganizerFeeFn({
        data: {
          teamId: testTeamId,
          organizerFeePercentage: 250, // 2.5%
          organizerFeeFixed: 200, // $2.00
        },
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('2.5%')
      expect(result.message).toContain('$2.00')
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should reset to standard platform fee when null', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(mockFoundingOrganizerTeam),
        findMany: vi.fn().mockResolvedValue([mockFoundingOrganizerTeam]),
      }

      const result = await updateOrganizerFeeFn({
        data: {
          teamId: testTeamId,
          organizerFeePercentage: null,
          organizerFeeFixed: null,
        },
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('Reset')
      expect(result.message).toContain('standard platform fee')
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should throw when team not found', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        updateOrganizerFeeFn({
          data: {
            teamId: 'nonexistent-team',
            organizerFeePercentage: 250,
            organizerFeeFixed: 200,
          },
        }),
      ).rejects.toThrow('Team not found')
    })

    it('should require admin authentication', async () => {
      const {requireAdmin} = await import('@/utils/auth')
      vi.mocked(requireAdmin).mockResolvedValueOnce(null)

      await expect(
        updateOrganizerFeeFn({
          data: {
            teamId: testTeamId,
            organizerFeePercentage: 250,
            organizerFeeFixed: 200,
          },
        }),
      ).rejects.toThrow('Not authorized - admin access required')
    })

    it('should allow setting only percentage (partial override)', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(mockTeam),
        findMany: vi.fn().mockResolvedValue([mockTeam]),
      }

      const result = await updateOrganizerFeeFn({
        data: {
          teamId: testTeamId,
          organizerFeePercentage: 300, // 3%
          organizerFeeFixed: null,
        },
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('3.0%')
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should handle 0% fee (free platform fee)', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(mockTeam),
        findMany: vi.fn().mockResolvedValue([mockTeam]),
      }

      const result = await updateOrganizerFeeFn({
        data: {
          teamId: testTeamId,
          organizerFeePercentage: 0,
          organizerFeeFixed: 0,
        },
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('0.0%')
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('Integration scenarios', () => {
    it('should support typical admin workflow: check fee, set founding rate, verify', async () => {
      // Step 1: Check initial fee (no custom rate)
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(mockTeam),
        findMany: vi.fn().mockResolvedValue([mockTeam]),
      }

      const initialFee = await getOrganizerFeeFn({
        data: {teamId: testTeamId},
      })
      expect(initialFee.hasCustomFee).toBe(false)

      // Step 2: Set founding organizer rate
      const updateResult = await updateOrganizerFeeFn({
        data: {
          teamId: testTeamId,
          organizerFeePercentage: 250,
          organizerFeeFixed: 200,
        },
      })
      expect(updateResult.success).toBe(true)

      // Step 3: Verify the rate was set
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(mockFoundingOrganizerTeam),
        findMany: vi.fn().mockResolvedValue([mockFoundingOrganizerTeam]),
      }

      const updatedFee = await getOrganizerFeeFn({
        data: {teamId: testTeamId},
      })
      expect(updatedFee.hasCustomFee).toBe(true)
      expect(updatedFee.organizerFeePercentage).toBe(250)
      expect(updatedFee.organizerFeeFixed).toBe(200)
    })

    it('should support resetting founding organizer back to standard rate', async () => {
      // Start with founding organizer rate
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(mockFoundingOrganizerTeam),
        findMany: vi.fn().mockResolvedValue([mockFoundingOrganizerTeam]),
      }

      const initialFee = await getOrganizerFeeFn({
        data: {teamId: testTeamId},
      })
      expect(initialFee.hasCustomFee).toBe(true)

      // Reset to standard rate
      const resetResult = await updateOrganizerFeeFn({
        data: {
          teamId: testTeamId,
          organizerFeePercentage: null,
          organizerFeeFixed: null,
        },
      })
      expect(resetResult.success).toBe(true)
      expect(resetResult.message).toContain('Reset')

      // Verify reset
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(mockTeam),
        findMany: vi.fn().mockResolvedValue([mockTeam]),
      }

      const resetFee = await getOrganizerFeeFn({
        data: {teamId: testTeamId},
      })
      expect(resetFee.hasCustomFee).toBe(false)
    })
  })
})
