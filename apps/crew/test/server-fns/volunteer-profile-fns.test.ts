import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
import {createTeamMembership} from '@repo/test-utils'
import {updateVolunteerProfileFn} from '@/server-fns/volunteer-profile-fns'

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Create test sessions
const mockVolunteerSession = {
  userId: 'volunteer-user-123',
  user: {
    id: 'volunteer-user-123',
    email: 'volunteer@example.com',
  },
  teams: [],
}

const mockOtherUserSession = {
  userId: 'other-user-123',
  user: {
    id: 'other-user-123',
    email: 'other@example.com',
  },
  teams: [],
}

const mockMembership = createTeamMembership({
  id: 'tmem_volunteer123',
  teamId: 'team-123',
  userId: 'volunteer-user-123',
  roleId: 'volunteer',
  metadata: JSON.stringify({
    volunteerRoleTypes: ['judge'],
    availability: 'morning',
    credentials: 'L1 Judge',
  }),
})

// Mock auth
vi.mock('@/utils/auth', () => ({
  getSessionFromCookie: vi.fn(() => Promise.resolve(mockVolunteerSession)),
}))

// Mock TanStack createServerFn to make server functions directly callable in tests
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    return {
      inputValidator: () => ({
        handler: (fn: any) => {
          // Return a callable that directly invokes the handler
          return fn
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

describe('updateVolunteerProfileFn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    // Register table for query API
    mockDb.registerTable('teamMembershipTable')
    // Reset to default session
    setMockSession(mockVolunteerSession)
  })

  describe('successful operations', () => {
    it('should accept valid morning availability', async () => {
      // Mock the query to find the membership
      mockDb.setMockSingleValue(mockMembership)

      const result = await updateVolunteerProfileFn({
        data: {
          membershipId: 'tmem_volunteer123',
          competitionSlug: 'test-competition',
          availability: 'morning',
        },
      })

      expect(result.success).toBe(true)
    })

    it('should accept valid afternoon availability', async () => {
      mockDb.setMockSingleValue(mockMembership)

      const result = await updateVolunteerProfileFn({
        data: {
          membershipId: 'tmem_volunteer123',
          competitionSlug: 'test-competition',
          availability: 'afternoon',
        },
      })

      expect(result.success).toBe(true)
    })

    it('should accept valid all_day availability', async () => {
      mockDb.setMockSingleValue(mockMembership)

      const result = await updateVolunteerProfileFn({
        data: {
          membershipId: 'tmem_volunteer123',
          competitionSlug: 'test-competition',
          availability: 'all_day',
        },
      })

      expect(result.success).toBe(true)
    })
  })

  describe('authentication', () => {
    it('should reject unauthenticated users', async () => {
      setMockSession(null)

      await expect(
        updateVolunteerProfileFn({
          data: {
            membershipId: 'tmem_volunteer123',
            competitionSlug: 'test-competition',
            availability: 'morning',
          },
        }),
      ).rejects.toThrow('NOT_AUTHORIZED: You must be logged in')
    })
  })

  describe('authorization', () => {
    it('should reject updates to memberships owned by other users', async () => {
      // User trying to update someone else's membership
      setMockSession(mockOtherUserSession)
      mockDb.setMockSingleValue(mockMembership)

      await expect(
        updateVolunteerProfileFn({
          data: {
            membershipId: 'tmem_volunteer123',
            competitionSlug: 'test-competition',
            availability: 'morning',
          },
        }),
      ).rejects.toThrow('FORBIDDEN: You can only update your own profile')
    })

    it('should allow updates to own membership', async () => {
      mockDb.setMockSingleValue(mockMembership)

      const result = await updateVolunteerProfileFn({
        data: {
          membershipId: 'tmem_volunteer123',
          competitionSlug: 'test-competition',
          availability: 'all_day',
        },
      })

      expect(result.success).toBe(true)
    })
  })

  describe('membership not found', () => {
    it('should return NOT_FOUND when membership does not exist', async () => {
      mockDb.setMockSingleValue(null)

      await expect(
        updateVolunteerProfileFn({
          data: {
            membershipId: 'tmem_nonexistent',
            competitionSlug: 'test-competition',
            availability: 'morning',
          },
        }),
      ).rejects.toThrow('NOT_FOUND: Membership not found')
    })
  })

  describe('metadata updates', () => {
    it('should update availability in metadata', async () => {
      mockDb.setMockSingleValue(mockMembership)

      const result = await updateVolunteerProfileFn({
        data: {
          membershipId: 'tmem_volunteer123',
          competitionSlug: 'test-competition',
          availability: 'afternoon',
        },
      })

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should update credentials in metadata', async () => {
      mockDb.setMockSingleValue(mockMembership)

      const result = await updateVolunteerProfileFn({
        data: {
          membershipId: 'tmem_volunteer123',
          competitionSlug: 'test-competition',
          credentials: 'L2 Judge, EMT Certified',
        },
      })

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should update availabilityNotes in metadata', async () => {
      mockDb.setMockSingleValue(mockMembership)

      const result = await updateVolunteerProfileFn({
        data: {
          membershipId: 'tmem_volunteer123',
          competitionSlug: 'test-competition',
          availabilityNotes: 'Can only work Saturday morning',
        },
      })

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should update multiple fields at once', async () => {
      mockDb.setMockSingleValue(mockMembership)

      const result = await updateVolunteerProfileFn({
        data: {
          membershipId: 'tmem_volunteer123',
          competitionSlug: 'test-competition',
          availability: 'all_day',
          credentials: 'L1 Judge',
          availabilityNotes: 'Available both days',
        },
      })

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should handle membership with null metadata', async () => {
      mockDb.setMockSingleValue({
        ...mockMembership,
        metadata: null,
      })

      const result = await updateVolunteerProfileFn({
        data: {
          membershipId: 'tmem_volunteer123',
          competitionSlug: 'test-competition',
          availability: 'morning',
        },
      })

      expect(result.success).toBe(true)
    })
  })
})
