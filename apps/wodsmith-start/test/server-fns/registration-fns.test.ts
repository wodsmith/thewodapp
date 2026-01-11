import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Test users
const registeredUserId = 'user-registered-123'
const teamMemberUserId = 'user-team-member-456'
const unauthorizedUserId = 'user-unauthorized-789'

// Mock sessions
const mockRegisteredUserSession = {
  userId: registeredUserId,
  user: {
    id: registeredUserId,
    email: 'registered@example.com',
  },
  teams: [],
}

const mockTeamMemberSession = {
  userId: teamMemberUserId,
  user: {
    id: teamMemberUserId,
    email: 'teammember@example.com',
  },
  teams: [],
}

const mockUnauthorizedSession = {
  userId: unauthorizedUserId,
  user: {
    id: unauthorizedUserId,
    email: 'unauthorized@example.com',
  },
  teams: [],
}

// Mock auth - default to registered user
vi.mock('@/utils/auth', () => ({
  getSessionFromCookie: vi.fn(() => Promise.resolve(mockRegisteredUserSession)),
  requireVerifiedEmail: vi.fn(() => Promise.resolve(mockRegisteredUserSession)),
}))

// Mock TanStack createServerFn to make server functions directly callable
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: (fn: any) => fn,
    }),
  }),
  createServerOnlyFn: (fn: any) => fn,
}))

// Mock cloudflare:workers
vi.mock('cloudflare:workers', () => ({
  env: {
    APP_URL: 'https://test.wodsmith.com',
  },
}))

// Import mocked auth so we can change behavior
import {requireVerifiedEmail} from '@/utils/auth'
import {
  updateRegistrationAffiliateFn,
  getRegistrationDetailsFn,
} from '@/server-fns/registration-fns'

// Helper to set mock session
const setMockSession = (session: unknown) => {
  vi.mocked(requireVerifiedEmail).mockResolvedValue(
    session as Awaited<ReturnType<typeof requireVerifiedEmail>>,
  )
}

// Test data
const testRegistrationId = 'reg-123'
const testCompetitionId = 'comp-456'
const testDivisionId = 'div-789'
const testAthleteTeamId = 'athlete-team-123'
const testPurchaseId = 'purchase-123'

const mockRegistration = {
  id: testRegistrationId,
  userId: registeredUserId,
  competitionId: testCompetitionId,
  divisionId: testDivisionId,
  athleteTeamId: null,
  teamName: null,
  captainUserId: null,
  metadata: null,
  pendingTeammates: null,
  registeredAt: new Date('2024-01-15'),
  paymentStatus: 'PAID',
  paidAt: new Date('2024-01-15'),
  commercePurchaseId: testPurchaseId,
  competition: {
    id: testCompetitionId,
    name: 'Winter Throwdown 2025',
    slug: 'winter-throwdown-2025',
    startDate: new Date('2025-02-01'),
    endDate: new Date('2025-02-02'),
    profileImageUrl: null,
  },
  division: {
    id: testDivisionId,
    label: 'Scaled',
    teamSize: 1,
  },
}

const mockTeamRegistration = {
  ...mockRegistration,
  id: 'reg-team-456',
  athleteTeamId: testAthleteTeamId,
  teamName: 'The Barbells',
  captainUserId: registeredUserId,
}

const mockTeamMembership = {
  id: 'membership-123',
  teamId: testAthleteTeamId,
  userId: teamMemberUserId,
  roleId: 'member',
}

const mockPurchase = {
  id: testPurchaseId,
  totalCents: 7500,
  status: 'COMPLETED',
  completedAt: new Date('2024-01-15'),
  stripePaymentIntentId: 'pi_test123',
}

const mockDivisionConfig = {
  competitionId: testCompetitionId,
  divisionId: testDivisionId,
  feeCents: 7500,
  description: 'For athletes who prefer scaled movements',
}

describe('registration-fns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    mockDb.registerTable('competitionRegistrationsTable')
    mockDb.registerTable('teamMembershipTable')
    mockDb.registerTable('competitionDivisionsTable')
    mockDb.registerTable('commercePurchaseTable')
    setMockSession(mockRegisteredUserSession)
  })

  describe('updateRegistrationAffiliateFn', () => {
    describe('authentication', () => {
      it('should reject unauthenticated users', async () => {
        setMockSession(null)

        await expect(
          updateRegistrationAffiliateFn({
            data: {
              registrationId: testRegistrationId,
              userId: registeredUserId,
              affiliateName: 'CrossFit Canvas',
            },
          }),
        ).rejects.toThrow('Unauthorized')
      })
    })

    describe('authorization', () => {
      it('should reject when userId does not match session', async () => {
        mockDb.setMockSingleValue(mockRegistration)

        await expect(
          updateRegistrationAffiliateFn({
            data: {
              registrationId: testRegistrationId,
              userId: 'different-user-id',
              affiliateName: 'CrossFit Canvas',
            },
          }),
        ).rejects.toThrow('You can only update your own affiliate')
      })

      it('should reject when user is not registrant or team member', async () => {
        setMockSession(mockUnauthorizedSession)
        mockDb.setMockSingleValue(mockRegistration)
        // No team membership found
        mockDb.query.teamMembershipTable = {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        }

        await expect(
          updateRegistrationAffiliateFn({
            data: {
              registrationId: testRegistrationId,
              userId: unauthorizedUserId,
              affiliateName: 'CrossFit Canvas',
            },
          }),
        ).rejects.toThrow('You must be a team member to update your affiliate')
      })

      it('should allow registered user to update their affiliate', async () => {
        mockDb.setMockSingleValue(mockRegistration)

        const result = await updateRegistrationAffiliateFn({
          data: {
            registrationId: testRegistrationId,
            userId: registeredUserId,
            affiliateName: 'CrossFit Canvas',
          },
        })

        expect(result.success).toBe(true)
        expect(mockDb.update).toHaveBeenCalled()
      })

      it('should allow team member to update their affiliate', async () => {
        setMockSession(mockTeamMemberSession)
        mockDb.setMockSingleValue(mockTeamRegistration)
        mockDb.query.teamMembershipTable = {
          findFirst: vi.fn().mockResolvedValue(mockTeamMembership),
          findMany: vi.fn().mockResolvedValue([mockTeamMembership]),
        }

        const result = await updateRegistrationAffiliateFn({
          data: {
            registrationId: mockTeamRegistration.id,
            userId: teamMemberUserId,
            affiliateName: 'CrossFit Portland',
          },
        })

        expect(result.success).toBe(true)
      })
    })

    describe('metadata updates', () => {
      it('should update affiliate in metadata', async () => {
        mockDb.setMockSingleValue(mockRegistration)

        await updateRegistrationAffiliateFn({
          data: {
            registrationId: testRegistrationId,
            userId: registeredUserId,
            affiliateName: 'CrossFit Canvas',
          },
        })

        expect(mockDb.update).toHaveBeenCalled()
      })

      it('should handle null affiliate (Independent)', async () => {
        const registrationWithAffiliate = {
          ...mockRegistration,
          metadata: JSON.stringify({
            affiliates: {[registeredUserId]: 'Old Gym'},
          }),
        }
        mockDb.setMockSingleValue(registrationWithAffiliate)

        const result = await updateRegistrationAffiliateFn({
          data: {
            registrationId: testRegistrationId,
            userId: registeredUserId,
            affiliateName: null,
          },
        })

        expect(result.success).toBe(true)
      })

      it('should preserve existing metadata when adding affiliate', async () => {
        const registrationWithMetadata = {
          ...mockRegistration,
          metadata: JSON.stringify({
            someOtherData: 'preserved',
          }),
        }
        mockDb.setMockSingleValue(registrationWithMetadata)

        const result = await updateRegistrationAffiliateFn({
          data: {
            registrationId: testRegistrationId,
            userId: registeredUserId,
            affiliateName: 'New Gym',
          },
        })

        expect(result.success).toBe(true)
      })

      it('should handle registration with null metadata', async () => {
        mockDb.setMockSingleValue(mockRegistration)

        const result = await updateRegistrationAffiliateFn({
          data: {
            registrationId: testRegistrationId,
            userId: registeredUserId,
            affiliateName: 'CrossFit Canvas',
          },
        })

        expect(result.success).toBe(true)
      })
    })

    describe('registration not found', () => {
      it('should throw when registration does not exist', async () => {
        mockDb.setMockSingleValue(null)

        await expect(
          updateRegistrationAffiliateFn({
            data: {
              registrationId: 'nonexistent',
              userId: registeredUserId,
              affiliateName: 'CrossFit Canvas',
            },
          }),
        ).rejects.toThrow('Registration not found')
      })
    })
  })

  describe('getRegistrationDetailsFn', () => {
    describe('authentication', () => {
      it('should reject unauthenticated users', async () => {
        setMockSession(null)

        await expect(
          getRegistrationDetailsFn({
            data: {registrationId: testRegistrationId},
          }),
        ).rejects.toThrow('Unauthorized')
      })
    })

    describe('authorization', () => {
      it('should reject when user is not registrant or team member', async () => {
        setMockSession(mockUnauthorizedSession)
        mockDb.setMockSingleValue(mockRegistration)
        mockDb.query.teamMembershipTable = {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        }

        await expect(
          getRegistrationDetailsFn({
            data: {registrationId: testRegistrationId},
          }),
        ).rejects.toThrow('You are not authorized to view this registration')
      })

      it('should allow registered user to view registration', async () => {
        mockDb.setMockSingleValue(mockRegistration)
        mockDb.query.competitionDivisionsTable = {
          findFirst: vi.fn().mockResolvedValue(mockDivisionConfig),
          findMany: vi.fn().mockResolvedValue([mockDivisionConfig]),
        }
        mockDb.query.commercePurchaseTable = {
          findFirst: vi.fn().mockResolvedValue(mockPurchase),
          findMany: vi.fn().mockResolvedValue([mockPurchase]),
        }

        const result = await getRegistrationDetailsFn({
          data: {registrationId: testRegistrationId},
        })

        expect(result).not.toBeNull()
        expect(result?.registrationId).toBe(testRegistrationId)
      })

      it('should allow team member to view team registration', async () => {
        setMockSession(mockTeamMemberSession)
        mockDb.setMockSingleValue(mockTeamRegistration)
        mockDb.query.teamMembershipTable = {
          findFirst: vi.fn().mockResolvedValue(mockTeamMembership),
          findMany: vi.fn().mockResolvedValue([mockTeamMembership]),
        }
        mockDb.query.competitionDivisionsTable = {
          findFirst: vi.fn().mockResolvedValue(mockDivisionConfig),
          findMany: vi.fn().mockResolvedValue([mockDivisionConfig]),
        }
        mockDb.query.commercePurchaseTable = {
          findFirst: vi.fn().mockResolvedValue(mockPurchase),
          findMany: vi.fn().mockResolvedValue([mockPurchase]),
        }

        const result = await getRegistrationDetailsFn({
          data: {registrationId: mockTeamRegistration.id},
        })

        expect(result).not.toBeNull()
        expect(result?.teamName).toBe('The Barbells')
      })
    })

    describe('data retrieval', () => {
      beforeEach(() => {
        mockDb.setMockSingleValue(mockRegistration)
        mockDb.query.competitionDivisionsTable = {
          findFirst: vi.fn().mockResolvedValue(mockDivisionConfig),
          findMany: vi.fn().mockResolvedValue([mockDivisionConfig]),
        }
        mockDb.query.commercePurchaseTable = {
          findFirst: vi.fn().mockResolvedValue(mockPurchase),
          findMany: vi.fn().mockResolvedValue([mockPurchase]),
        }
      })

      it('should return null for non-existent registration', async () => {
        mockDb.setMockSingleValue(null)

        const result = await getRegistrationDetailsFn({
          data: {registrationId: 'nonexistent'},
        })

        expect(result).toBeNull()
      })

      it('should return competition details', async () => {
        const result = await getRegistrationDetailsFn({
          data: {registrationId: testRegistrationId},
        })

        expect(result?.competition).toEqual({
          id: testCompetitionId,
          name: 'Winter Throwdown 2025',
          slug: 'winter-throwdown-2025',
          startDate: mockRegistration.competition.startDate,
          endDate: mockRegistration.competition.endDate,
          profileImageUrl: null,
        })
      })

      it('should return division details with fee', async () => {
        const result = await getRegistrationDetailsFn({
          data: {registrationId: testRegistrationId},
        })

        expect(result?.division).toEqual({
          id: testDivisionId,
          label: 'Scaled',
          teamSize: 1,
          description: 'For athletes who prefer scaled movements',
          feeCents: 7500,
        })
      })

      it('should return purchase/payment details', async () => {
        const result = await getRegistrationDetailsFn({
          data: {registrationId: testRegistrationId},
        })

        expect(result?.purchase).toEqual({
          id: testPurchaseId,
          totalCents: 7500,
          status: 'COMPLETED',
          completedAt: mockPurchase.completedAt,
          stripePaymentIntentId: 'pi_test123',
        })
      })

      it('should return registration dates and status', async () => {
        const result = await getRegistrationDetailsFn({
          data: {registrationId: testRegistrationId},
        })

        expect(result?.registeredAt).toEqual(mockRegistration.registeredAt)
        expect(result?.paymentStatus).toBe('PAID')
        expect(result?.paidAt).toEqual(mockRegistration.paidAt)
      })

      it('should handle registration without purchase', async () => {
        const freeRegistration = {
          ...mockRegistration,
          paymentStatus: 'FREE',
          commercePurchaseId: null,
        }
        mockDb.setMockSingleValue(freeRegistration)

        const result = await getRegistrationDetailsFn({
          data: {registrationId: testRegistrationId},
        })

        expect(result?.paymentStatus).toBe('FREE')
        expect(result?.purchase).toBeNull()
      })

      it('should handle division without custom fee config', async () => {
        mockDb.query.competitionDivisionsTable = {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        }

        const result = await getRegistrationDetailsFn({
          data: {registrationId: testRegistrationId},
        })

        expect(result?.division?.feeCents).toBeNull()
        expect(result?.division?.description).toBeNull()
      })
    })
  })
})
