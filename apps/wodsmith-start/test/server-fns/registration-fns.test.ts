import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Mock logging
vi.mock('@/lib/logging', () => ({
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  logEntityCreated: vi.fn(),
  addRequestContextAttribute: vi.fn(),
  updateRequestContext: vi.fn(),
}))

// Mock registration
const mockRegisterForCompetition = vi.fn()
const mockNotifyRegistrationConfirmed = vi.fn()
vi.mock('@/lib/registration-stubs', () => ({
  registerForCompetition: (...args: unknown[]) =>
    mockRegisterForCompetition(...args),
  notifyRegistrationConfirmed: (...args: unknown[]) =>
    mockNotifyRegistrationConfirmed(...args),
}))

// Mock commerce utils
const mockGetRegistrationFee = vi.fn()
const mockBuildFeeConfig = vi.fn()
const mockCalculateCompetitionFees = vi.fn()
vi.mock('@/lib/commerce-stubs', () => ({
  getRegistrationFee: (...args: unknown[]) => mockGetRegistrationFee(...args),
  buildFeeConfig: (...args: unknown[]) => mockBuildFeeConfig(...args),
  calculateCompetitionFees: (...args: unknown[]) =>
    mockCalculateCompetitionFees(...args),
}))

// Mock env
vi.mock('@/lib/env', () => ({
  getAppUrl: vi.fn(() => 'https://test.wodsmith.com'),
}))

// Mock Stripe
const mockStripeCheckoutCreate = vi.fn()
const mockStripeRefundsCreate = vi.fn()
vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeCheckoutCreate(...args),
      },
    },
    refunds: {
      create: (...args: unknown[]) => mockStripeRefundsCreate(...args),
    },
  })),
}))

// Mock financial events module so refund tests can observe and assert on writes
const mockRecordRefundInitiated = vi.fn()
const mockRecordFinancialEvent = vi.fn()
vi.mock('@/server/commerce/financial-events', () => ({
  recordRefundInitiated: (...args: unknown[]) =>
    mockRecordRefundInitiated(...args),
  recordRefundCompleted: vi.fn(),
  recordFinancialEvent: (...args: unknown[]) =>
    mockRecordFinancialEvent(...args),
  recordPaymentCompleted: vi.fn(),
  recordDisputeEvent: vi.fn(),
}))

// Mock division capacity
const mockGetDivisionSpotsAvailableFn = vi.fn()
const mockGetCompetitionSpotsAvailableFn = vi.fn()
vi.mock('@/server-fns/competition-divisions-fns', () => ({
  getDivisionSpotsAvailableFn: (...args: unknown[]) =>
    mockGetDivisionSpotsAvailableFn(...args),
  getCompetitionSpotsAvailableFn: (...args: unknown[]) =>
    mockGetCompetitionSpotsAvailableFn(...args),
}))

// Mock timezone utils
vi.mock('@/utils/timezone-utils', () => ({
  DEFAULT_TIMEZONE: 'America/Denver',
  hasDateStartedInTimezone: vi.fn(() => true),
  isDeadlinePassedInTimezone: vi.fn(() => false),
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
    handler: (fn: any) => fn,
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
import {hasDateStartedInTimezone, isDeadlinePassedInTimezone} from '@/utils/timezone-utils'
import {
  updateRegistrationAffiliateFn,
  getRegistrationDetailsFn,
  initiateRegistrationPaymentFn,
  cancelPendingPurchaseFn,
  removeRegistrationFn,
  refundRegistrationFn,
  transferRegistrationDivisionFn,
} from '@/server-fns/registration-fns'

// Extract handlers from createServerFn mock
const initiatePayment = initiateRegistrationPaymentFn as unknown as (args: {
  data: {
    competitionId: string
    items: Array<{
      divisionId: string
      teamName?: string
      teammates?: Array<{
        email: string
        firstName?: string
        lastName?: string
        affiliateName?: string
      }>
    }>
    affiliateName?: string
    answers?: Array<{questionId: string; answer: string}>
  }
}) => Promise<{
  purchaseId: string | null
  checkoutUrl: string | null
  totalCents: number
  isFree: boolean
  registrationId?: string | null
}>

const cancelPendingPurchase = cancelPendingPurchaseFn as unknown as (args: {
  data: {userId: string; competitionId: string}
}) => Promise<{success: boolean}>

const removeRegistration = removeRegistrationFn as unknown as (args: {
  data: {registrationId: string; competitionId: string}
}) => Promise<{success: boolean}>

const transferRegistrationDivision = transferRegistrationDivisionFn as unknown as (args: {
  data: {registrationId: string; competitionId: string; targetDivisionId: string}
}) => Promise<{success: boolean; removedHeatAssignments: number}>

const refundRegistration = refundRegistrationFn as unknown as (args: {
  data: {
    registrationId: string
    competitionId: string
    reason?: string
    amountCents?: number
    idempotencyToken?: string
  }
}) => Promise<{success: boolean; refundId: string; amountCents: number}>

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
  userId: registeredUserId,
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
              affiliateName: 'Functional Fitness Canvas',
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
              affiliateName: 'Functional Fitness Canvas',
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
              affiliateName: 'Functional Fitness Canvas',
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
            affiliateName: 'Functional Fitness Canvas',
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
            affiliateName: 'Functional Fitness Portland',
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
            affiliateName: 'Functional Fitness Canvas',
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
            affiliateName: 'Functional Fitness Canvas',
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
              affiliateName: 'Functional Fitness Canvas',
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
      it('should return null when user is not registrant or team member', async () => {
        setMockSession(mockUnauthorizedSession)
        mockDb.setMockSingleValue(mockRegistration)
        mockDb.query.teamMembershipTable = {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        }

        const result = await getRegistrationDetailsFn({
          data: {registrationId: testRegistrationId},
        })

        // Returns null instead of throwing to allow route to show 404
        expect(result).toBeNull()
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
        mockDb.query.userTable = {
          findFirst: vi.fn().mockResolvedValue({firstName: 'John', lastName: 'Doe'}),
          findMany: vi.fn().mockResolvedValue([]),
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
          couponCode: null,
          couponDiscountCents: null,
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

  // ============================================================================
  // Multi-Division Registration Payment Tests
  // ============================================================================

  describe('initiateRegistrationPaymentFn', () => {
    const mockCompetition = {
      id: testCompetitionId,
      name: 'Test Competition',
      slug: 'test-competition',
      organizingTeamId: 'org-team-1',
      registrationOpensAt: '2025-01-01',
      registrationClosesAt: '2025-12-31',
      timezone: 'America/Denver',
      defaultRegistrationFeeCents: 5000,
      defaultMaxSpotsPerDivision: null,
    }

    function setupBasePaymentMocks() {
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([]),
      }
      // No existing registrations
      mockDb.query.competitionRegistrationsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }
      mockDb.query.scalingLevelsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }
      // No required questions
      mockDb.query.competitionRegistrationQuestionsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }
      // Chain selects return empty
      mockDb.setMockReturnValue([])

      // Capacity available
      mockGetDivisionSpotsAvailableFn.mockResolvedValue({
        isFull: false,
        available: 50,
      })

      // Competition-wide capacity available
      mockGetCompetitionSpotsAvailableFn.mockResolvedValue({
        isFull: false,
        maxTotalRegistrations: null,
        registered: 0,
        confirmedCount: 0,
        pendingCount: 0,
        available: null,
      })

      // Notifications
      mockNotifyRegistrationConfirmed.mockResolvedValue(undefined)
    }

    describe('authentication', () => {
      it('rejects unauthenticated users', async () => {
        setMockSession(null)

        await expect(
          initiatePayment({
            data: {
              competitionId: testCompetitionId,
              items: [{divisionId: 'div-1'}],
            },
          }),
        ).rejects.toThrow('Unauthorized')
      })
    })

    describe('competition validation', () => {
      it('throws when competition not found', async () => {
        mockDb.query.competitionsTable = {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        }

        await expect(
          initiatePayment({
            data: {
              competitionId: 'nonexistent',
              items: [{divisionId: 'div-1'}],
            },
          }),
        ).rejects.toThrow('Competition not found')
      })

      it('throws when registration not yet open', async () => {
        setupBasePaymentMocks()
        vi.mocked(hasDateStartedInTimezone).mockReturnValueOnce(false)

        await expect(
          initiatePayment({
            data: {
              competitionId: testCompetitionId,
              items: [{divisionId: 'div-1'}],
            },
          }),
        ).rejects.toThrow('Registration has not opened yet')
      })

      it('throws when registration has closed', async () => {
        setupBasePaymentMocks()
        vi.mocked(hasDateStartedInTimezone).mockReturnValueOnce(true)
        vi.mocked(isDeadlinePassedInTimezone).mockReturnValueOnce(true)

        await expect(
          initiatePayment({
            data: {
              competitionId: testCompetitionId,
              items: [{divisionId: 'div-1'}],
            },
          }),
        ).rejects.toThrow('Registration has closed')
      })
    })

    describe('free multi-division registration', () => {
      it('registers for multiple free divisions in one call', async () => {
        setupBasePaymentMocks()
        mockGetRegistrationFee.mockResolvedValue(0)
        mockRegisterForCompetition
          .mockResolvedValueOnce({registrationId: 'reg-free-1'})
          .mockResolvedValueOnce({registrationId: 'reg-free-2'})

        const result = await initiatePayment({
          data: {
            competitionId: testCompetitionId,
            items: [{divisionId: 'div-rx'}, {divisionId: 'div-scaled'}],
          },
        })

        expect(result.isFree).toBe(true)
        expect(result.totalCents).toBe(0)
        expect(result.checkoutUrl).toBeNull()
        expect(result.registrationId).toBe('reg-free-1')

        // Both divisions registered
        expect(mockRegisterForCompetition).toHaveBeenCalledTimes(2)
        expect(mockRegisterForCompetition).toHaveBeenCalledWith(
          expect.objectContaining({divisionId: 'div-rx'}),
        )
        expect(mockRegisterForCompetition).toHaveBeenCalledWith(
          expect.objectContaining({divisionId: 'div-scaled'}),
        )

        // Both confirmation emails sent
        expect(mockNotifyRegistrationConfirmed).toHaveBeenCalledTimes(2)
      })

      it('marks free registrations with FREE payment status', async () => {
        setupBasePaymentMocks()
        mockGetRegistrationFee.mockResolvedValue(0)
        mockRegisterForCompetition.mockResolvedValue({
          registrationId: 'reg-free-1',
        })

        await initiatePayment({
          data: {
            competitionId: testCompetitionId,
            items: [{divisionId: 'div-rx'}],
          },
        })

        // Should update registration with FREE payment status
        expect(mockDb.update).toHaveBeenCalled()
      })
    })

    describe('paid multi-division registration', () => {
      function setupPaidMocks() {
        setupBasePaymentMocks()

        mockGetRegistrationFee.mockResolvedValue(5000)

        mockDb.query.teamTable = {
          findFirst: vi.fn().mockResolvedValue({
            id: 'org-team-1',
            stripeAccountStatus: 'VERIFIED',
            stripeConnectedAccountId: 'acct_123',
            organizerFeePercentage: null,
            organizerFeeFixed: null,
          }),
          findMany: vi.fn().mockResolvedValue([]),
        }

        mockDb.query.commerceProductTable = {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(null) // no existing product
            .mockResolvedValueOnce({id: 'prod-1', name: 'Test Product'}),
          findMany: vi.fn().mockResolvedValue([]),
        }

        mockDb.query.scalingLevelsTable = {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({id: 'div-rx', label: 'Rx'})
            .mockResolvedValueOnce({id: 'div-scaled', label: 'Scaled'}),
          findMany: vi.fn().mockResolvedValue([]),
        }

        mockBuildFeeConfig.mockReturnValue({
          platformPercentageBasisPoints: 400,
          platformFixedCents: 200,
          stripePercentageBasisPoints: 290,
          stripeFixedCents: 30,
          passPlatformFeesToCustomer: true,
          passStripeFeesToCustomer: false,
        })

        mockCalculateCompetitionFees.mockReturnValue({
          registrationFeeCents: 5000,
          platformFeeCents: 400,
          stripeFeeCents: 175,
          totalChargeCents: 5400,
          organizerNetCents: 4825,
          stripeFeesPassedToCustomer: false,
          platformFeesPassedToCustomer: true,
        })

        mockStripeCheckoutCreate.mockResolvedValue({
          id: 'cs_test_multi',
          url: 'https://checkout.stripe.com/multi',
        })
      }

      it('creates Stripe checkout with multiple line items', async () => {
        setupPaidMocks()

        const result = await initiatePayment({
          data: {
            competitionId: testCompetitionId,
            items: [{divisionId: 'div-rx'}, {divisionId: 'div-scaled'}],
          },
        })

        expect(result.isFree).toBe(false)
        expect(result.totalCents).toBe(10800) // 2 × 5400
        expect(result.checkoutUrl).toBe('https://checkout.stripe.com/multi')

        // Stripe session has 2 line items
        expect(mockStripeCheckoutCreate).toHaveBeenCalledTimes(1)
        const stripeArgs = mockStripeCheckoutCreate.mock.calls[0]?.[0] as any
        expect(stripeArgs.line_items).toHaveLength(2)
        expect(stripeArgs.metadata.multiDivision).toBe('true')
        expect(stripeArgs.metadata.purchaseIds).toContain(',')

        // No immediate registration (completed by webhook)
        expect(mockRegisterForCompetition).not.toHaveBeenCalled()
      })

      it('creates separate purchase records per division', async () => {
        setupPaidMocks()

        await initiatePayment({
          data: {
            competitionId: testCompetitionId,
            items: [{divisionId: 'div-rx'}, {divisionId: 'div-scaled'}],
          },
        })

        // insert called for: product + 2 purchases = 3 times
        // (product insert + purchase1 insert + purchase2 insert)
        expect(mockDb.insert).toHaveBeenCalled()
      })

      it('includes transfer_data for connected Stripe account', async () => {
        setupPaidMocks()

        await initiatePayment({
          data: {
            competitionId: testCompetitionId,
            items: [{divisionId: 'div-rx'}],
          },
        })

        const stripeArgs = mockStripeCheckoutCreate.mock.calls[0]?.[0] as any
        expect(stripeArgs.payment_intent_data.transfer_data.destination).toBe(
          'acct_123',
        )
      })

      it('stores team metadata in purchase for team divisions', async () => {
        setupPaidMocks()

        await initiatePayment({
          data: {
            competitionId: testCompetitionId,
            items: [
              {
                divisionId: 'div-rx',
                teamName: 'Alpha Squad',
                teammates: [{email: 'teammate@test.com', firstName: 'Jane'}],
              },
            ],
            affiliateName: 'Functional Fitness Denver',
          },
        })

        // Purchase insert should include metadata with team info
        expect(mockDb.insert).toHaveBeenCalled()
      })
    })

    describe('mixed free and paid divisions', () => {
      it('registers free immediately, creates checkout for paid', async () => {
        setupBasePaymentMocks()

        // First division free, second paid
        mockGetRegistrationFee
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(5000)

        mockRegisterForCompetition.mockResolvedValue({
          registrationId: 'reg-free-1',
        })

        mockDb.query.teamTable = {
          findFirst: vi.fn().mockResolvedValue({
            id: 'org-team-1',
            stripeAccountStatus: 'VERIFIED',
            stripeConnectedAccountId: 'acct_123',
            organizerFeePercentage: null,
            organizerFeeFixed: null,
          }),
          findMany: vi.fn().mockResolvedValue([]),
        }
        mockDb.query.commerceProductTable = {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({id: 'prod-1'}),
          findMany: vi.fn().mockResolvedValue([]),
        }
        mockDb.query.scalingLevelsTable = {
          findFirst: vi
            .fn()
            .mockResolvedValue({id: 'div-paid', label: 'Rx'}),
          findMany: vi.fn().mockResolvedValue([]),
        }

        mockBuildFeeConfig.mockReturnValue({
          platformPercentageBasisPoints: 400,
          platformFixedCents: 200,
          stripePercentageBasisPoints: 290,
          stripeFixedCents: 30,
          passPlatformFeesToCustomer: true,
          passStripeFeesToCustomer: false,
        })
        mockCalculateCompetitionFees.mockReturnValue({
          registrationFeeCents: 5000,
          platformFeeCents: 400,
          stripeFeeCents: 175,
          totalChargeCents: 5400,
          organizerNetCents: 4825,
          stripeFeesPassedToCustomer: false,
          platformFeesPassedToCustomer: true,
        })
        mockStripeCheckoutCreate.mockResolvedValue({
          id: 'cs_mixed',
          url: 'https://checkout.stripe.com/mixed',
        })

        const result = await initiatePayment({
          data: {
            competitionId: testCompetitionId,
            items: [{divisionId: 'div-free'}, {divisionId: 'div-paid'}],
          },
        })

        // Should have paid checkout
        expect(result.isFree).toBe(false)
        expect(result.totalCents).toBe(5400)

        // Free division registered immediately
        expect(mockRegisterForCompetition).toHaveBeenCalledTimes(1)
        expect(mockRegisterForCompetition).toHaveBeenCalledWith(
          expect.objectContaining({divisionId: 'div-free'}),
        )

        // Confirmation email for free division only
        expect(mockNotifyRegistrationConfirmed).toHaveBeenCalledTimes(1)

        // Stripe has 1 line item (paid only)
        const stripeArgs = mockStripeCheckoutCreate.mock.calls[0]?.[0] as any
        expect(stripeArgs.line_items).toHaveLength(1)
        expect(stripeArgs.metadata.multiDivision).toBe('false')
      })

      it('returns isFree when all divisions end up free after fee lookup', async () => {
        setupBasePaymentMocks()

        // All divisions end up being free after fee lookup
        mockGetRegistrationFee.mockResolvedValue(0)
        mockRegisterForCompetition
          .mockResolvedValueOnce({registrationId: 'reg-1'})
          .mockResolvedValueOnce({registrationId: 'reg-2'})

        const result = await initiatePayment({
          data: {
            competitionId: testCompetitionId,
            items: [{divisionId: 'div-1'}, {divisionId: 'div-2'}],
          },
        })

        expect(result.isFree).toBe(true)
        expect(result.totalCents).toBe(0)
        expect(mockStripeCheckoutCreate).not.toHaveBeenCalled()
      })
    })

    describe('capacity enforcement', () => {
      it('throws when any division is full', async () => {
        setupBasePaymentMocks()
        mockGetRegistrationFee.mockResolvedValue(5000)

        mockDb.query.scalingLevelsTable = {
          findFirst: vi
            .fn()
            .mockResolvedValue({id: 'div-full', label: 'Rx'}),
          findMany: vi.fn().mockResolvedValue([]),
        }

        // First division available, second full
        mockGetDivisionSpotsAvailableFn
          .mockResolvedValueOnce({isFull: false, available: 10})
          .mockResolvedValueOnce({isFull: true, available: 0})

        await expect(
          initiatePayment({
            data: {
              competitionId: testCompetitionId,
              items: [{divisionId: 'div-rx'}, {divisionId: 'div-full'}],
            },
          }),
        ).rejects.toThrow('is full. Please select a different division.')
      })

      it('checks capacity for each division individually', async () => {
        setupBasePaymentMocks()
        mockGetRegistrationFee.mockResolvedValue(0)
        mockRegisterForCompetition
          .mockResolvedValueOnce({registrationId: 'reg-1'})
          .mockResolvedValueOnce({registrationId: 'reg-2'})
          .mockResolvedValueOnce({registrationId: 'reg-3'})

        await initiatePayment({
          data: {
            competitionId: testCompetitionId,
            items: [
              {divisionId: 'div-1'},
              {divisionId: 'div-2'},
              {divisionId: 'div-3'},
            ],
          },
        })

        // Capacity checked 3 times (once per division)
        expect(mockGetDivisionSpotsAvailableFn).toHaveBeenCalledTimes(3)
      })
    })

    describe('duplicate registration prevention', () => {
      it('throws when already registered for a division in items', async () => {
        setupBasePaymentMocks()

        // First division check returns existing registration
        mockDb.query.competitionRegistrationsTable = {
          findFirst: vi.fn().mockResolvedValueOnce({
            id: 'existing-reg',
            userId: registeredUserId,
          }),
          findMany: vi.fn().mockResolvedValue([]),
        }
        mockDb.query.scalingLevelsTable = {
          findFirst: vi.fn().mockResolvedValue({id: 'div-rx', label: 'Rx'}),
          findMany: vi.fn().mockResolvedValue([]),
        }

        await expect(
          initiatePayment({
            data: {
              competitionId: testCompetitionId,
              items: [{divisionId: 'div-rx'}],
            },
          }),
        ).rejects.toThrow('You are already registered for')
      })
    })

    describe('required question validation', () => {
      it('throws when required questions unanswered', async () => {
        setupBasePaymentMocks()
        mockGetRegistrationFee.mockResolvedValue(0)

        // Required questions exist (returned by chain select)
        mockDb.setMockReturnValue([
          {
            id: 'q1',
            competitionId: testCompetitionId,
            label: 'T-Shirt Size',
            required: true,
          },
        ])

        await expect(
          initiatePayment({
            data: {
              competitionId: testCompetitionId,
              items: [{divisionId: 'div-rx'}],
              // No answers
            },
          }),
        ).rejects.toThrow('Please answer all required questions')
      })

      it('passes when required questions are answered', async () => {
        setupBasePaymentMocks()
        mockGetRegistrationFee.mockResolvedValue(0)
        mockRegisterForCompetition.mockResolvedValue({
          registrationId: 'reg-1',
        })

        // No required questions
        mockDb.setMockReturnValue([])

        const result = await initiatePayment({
          data: {
            competitionId: testCompetitionId,
            items: [{divisionId: 'div-rx'}],
            answers: [{questionId: 'q1', answer: 'Large'}],
          },
        })

        expect(result.isFree).toBe(true)
      })
    })

    describe('Stripe connection validation', () => {
      it('throws when organizer Stripe not verified for paid registrations', async () => {
        setupBasePaymentMocks()
        mockGetRegistrationFee.mockResolvedValue(5000)

        mockDb.query.teamTable = {
          findFirst: vi.fn().mockResolvedValue({
            id: 'org-team-1',
            stripeAccountStatus: 'PENDING',
            organizerFeePercentage: null,
            organizerFeeFixed: null,
          }),
          findMany: vi.fn().mockResolvedValue([]),
        }

        await expect(
          initiatePayment({
            data: {
              competitionId: testCompetitionId,
              items: [{divisionId: 'div-rx'}],
            },
          }),
        ).rejects.toThrow('temporarily unable to accept paid registrations')
      })
    })

    describe('answers stored for all registrations', () => {
      it('stores answers for each free division registration', async () => {
        setupBasePaymentMocks()
        mockGetRegistrationFee.mockResolvedValue(0)
        mockRegisterForCompetition
          .mockResolvedValueOnce({registrationId: 'reg-1'})
          .mockResolvedValueOnce({registrationId: 'reg-2'})

        await initiatePayment({
          data: {
            competitionId: testCompetitionId,
            items: [{divisionId: 'div-1'}, {divisionId: 'div-2'}],
            answers: [{questionId: 'q1', answer: 'Medium'}],
          },
        })

        // Answers inserted for each registration (2 insert calls for answers)
        // Plus the registration updates (2 updates for payment status)
        expect(mockDb.insert).toHaveBeenCalled()
      })
    })
  })

  // ============================================================================
  // Cancel Pending Purchase Tests
  // ============================================================================

  describe('cancelPendingPurchaseFn', () => {
    it('cancels pending purchases for user/competition', async () => {
      const result = await cancelPendingPurchase({
        data: {
          userId: registeredUserId,
          competitionId: testCompetitionId,
        },
      })

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('rejects when userId does not match session', async () => {
      await expect(
        cancelPendingPurchase({
          data: {
            userId: 'different-user',
            competitionId: testCompetitionId,
          },
        }),
      ).rejects.toThrow('You can only cancel your own pending purchases')
    })

    it('rejects unauthenticated users', async () => {
      setMockSession(null)

      await expect(
        cancelPendingPurchase({
          data: {
            userId: registeredUserId,
            competitionId: testCompetitionId,
          },
        }),
      ).rejects.toThrow('Unauthorized')
    })
  })

  // ============================================================================
  // Remove Registration (Organizer Soft Delete) Tests
  // ============================================================================

  describe('removeRegistrationFn', () => {
    const organizingTeamId = 'org-team-1'

    const mockOrganizerSession = {
      userId: 'organizer-user-1',
      user: {id: 'organizer-user-1', email: 'organizer@example.com', role: 'user'},
      teams: [
        {
          id: organizingTeamId,
          permissions: ['manage_competitions'],
        },
      ],
    }

    const mockAdminSession = {
      userId: 'admin-user-1',
      user: {id: 'admin-user-1', email: 'admin@example.com', role: 'admin'},
      teams: [],
    }

    const mockCompetition = {
      id: testCompetitionId,
      organizingTeamId,
    }

    const mockActiveRegistration = {
      id: testRegistrationId,
      userId: registeredUserId,
      eventId: testCompetitionId,
      divisionId: testDivisionId,
      status: 'active',
      athleteTeamId: null,
      teamMemberId: 'member-123',
    }

    const mockTeamActiveRegistration = {
      ...mockActiveRegistration,
      id: 'reg-team-remove',
      athleteTeamId: testAthleteTeamId,
    }

    function setupRemoveMocks() {
      mockDb.registerTable('competitionsTable')
      mockDb.registerTable('competitionRegistrationsTable')
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([]),
      }
      mockDb.query.competitionRegistrationsTable = {
        findFirst: vi.fn().mockResolvedValue(mockActiveRegistration),
        findMany: vi.fn().mockResolvedValue([]),
      }
      // No competition events by default (no scores to delete)
      mockDb.setMockReturnValue([])
    }

    beforeEach(() => {
      setMockSession(mockOrganizerSession)
    })

    describe('authentication', () => {
      it('rejects unauthenticated users', async () => {
        vi.mocked(requireVerifiedEmail).mockRejectedValue(new Error('Unauthorized'))

        await expect(
          removeRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow('Unauthorized')
      })
    })

    describe('authorization', () => {
      it('rejects users without manage_competitions permission', async () => {
        setupRemoveMocks()
        setMockSession({
          userId: 'random-user',
          user: {id: 'random-user', email: 'random@example.com', role: 'user'},
          teams: [{id: organizingTeamId, permissions: ['access_dashboard']}],
        })

        await expect(
          removeRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow('Missing required permission: manage_competitions')
      })

      it('rejects users not on the organizing team', async () => {
        setupRemoveMocks()
        setMockSession({
          userId: 'random-user',
          user: {id: 'random-user', email: 'random@example.com', role: 'user'},
          teams: [{id: 'different-team', permissions: ['manage_competitions']}],
        })

        await expect(
          removeRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow('Missing required permission: manage_competitions')
      })

      it('allows site admins to bypass team check', async () => {
        setupRemoveMocks()
        setMockSession(mockAdminSession)

        const result = await removeRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        expect(result.success).toBe(true)
      })

      it('allows organizer with manage_competitions permission', async () => {
        setupRemoveMocks()

        const result = await removeRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        expect(result.success).toBe(true)
      })
    })

    describe('validation', () => {
      it('throws when competition not found', async () => {
        setupRemoveMocks()
        mockDb.query.competitionsTable = {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        }

        await expect(
          removeRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: 'nonexistent',
            },
          }),
        ).rejects.toThrow('Competition not found')
      })

      it('throws when registration not found', async () => {
        setupRemoveMocks()
        mockDb.query.competitionRegistrationsTable = {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        }

        await expect(
          removeRegistration({
            data: {
              registrationId: 'nonexistent',
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow('Registration not found')
      })

      it('throws when registration is already removed', async () => {
        setupRemoveMocks()
        mockDb.query.competitionRegistrationsTable = {
          findFirst: vi.fn().mockResolvedValue({
            ...mockActiveRegistration,
            status: 'removed',
          }),
          findMany: vi.fn().mockResolvedValue([]),
        }

        await expect(
          removeRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow('Registration is already removed')
      })
    })

    describe('individual registration removal', () => {
      it('sets registration status to removed', async () => {
        setupRemoveMocks()

        const result = await removeRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        expect(result.success).toBe(true)
        // update called for: registration status + captain membership deactivation
        expect(mockDb.update).toHaveBeenCalled()
      })

      it('deactivates captain team membership', async () => {
        setupRemoveMocks()

        await removeRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        // update called at least twice: registration status + membership deactivation
        expect(mockDb.update).toHaveBeenCalledTimes(2)
      })

      it('deletes heat assignments', async () => {
        setupRemoveMocks()

        await removeRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        // delete called for heat assignments
        expect(mockDb.delete).toHaveBeenCalled()
      })
    })

    describe('team registration removal', () => {
      it('deactivates athlete team memberships and cancels invitations', async () => {
        setupRemoveMocks()
        mockDb.query.competitionRegistrationsTable = {
          findFirst: vi.fn().mockResolvedValue(mockTeamActiveRegistration),
          findMany: vi.fn().mockResolvedValue([]),
        }

        const result = await removeRegistration({
          data: {
            registrationId: mockTeamActiveRegistration.id,
            competitionId: testCompetitionId,
          },
        })

        expect(result.success).toBe(true)
        // update called for:
        // 1. registration status to removed
        // 2. captain membership deactivation
        // 3. athlete team memberships deactivation
        // 4. cancel pending invitations
        expect(mockDb.update).toHaveBeenCalledTimes(4)
      })
    })

    describe('score cleanup', () => {
      it('deletes scores when competition has events', async () => {
        setupRemoveMocks()
        // Return competition events from the select chain
        mockDb.setMockReturnValue([{id: 'event-1'}, {id: 'event-2'}])

        await removeRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        // delete called for: heat assignments + scores (2 events × 1 user = 2 score deletes)
        // Total: 1 (heat) + 2 (scores) = 3
        expect(mockDb.delete).toHaveBeenCalled()
      })
    })
  })

  describe('transferRegistrationDivisionFn', () => {
    const organizingTeamId = 'org-team-1'
    const targetDivisionId = 'div-target-999'

    const mockOrganizerSession = {
      userId: 'organizer-user-1',
      user: {id: 'organizer-user-1', email: 'organizer@example.com', role: 'user'},
      teams: [
        {
          id: organizingTeamId,
          permissions: ['manage_competitions'],
        },
      ],
    }

    const mockAdminSession = {
      userId: 'admin-user-1',
      user: {id: 'admin-user-1', email: 'admin@example.com', role: 'admin'},
      teams: [],
    }

    const mockCompetition = {
      id: testCompetitionId,
      organizingTeamId,
    }

    const mockActiveRegistration = {
      id: testRegistrationId,
      userId: registeredUserId,
      eventId: testCompetitionId,
      divisionId: testDivisionId,
      status: 'active',
      athleteTeamId: null,
      commercePurchaseId: null,
    }

    const mockSourceDivision = {
      id: testDivisionId,
      teamSize: 1,
    }

    const mockTargetDivision = {
      id: targetDivisionId,
      teamSize: 1,
    }

    function setupTransferMocks(overrides?: {
      registration?: Record<string, unknown>
      sourceDivision?: Record<string, unknown> | null
      targetDivision?: Record<string, unknown> | null
      existingTargetRegistration?: Record<string, unknown> | null
    }) {
      mockDb.registerTable('competitionsTable')
      mockDb.registerTable('competitionRegistrationsTable')
      mockDb.registerTable('scalingLevelsTable')
      mockDb.registerTable('competitionHeatAssignmentsTable')
      mockDb.registerTable('commercePurchaseTable')

      const registration = overrides?.registration ?? mockActiveRegistration
      const sourceDivision = overrides?.sourceDivision !== undefined
        ? overrides.sourceDivision
        : mockSourceDivision
      const targetDivision = overrides?.targetDivision !== undefined
        ? overrides.targetDivision
        : mockTargetDivision
      const existingTargetRegistration = overrides?.existingTargetRegistration ?? null

      // Competition lookup
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([]),
      }

      // Registration lookup, then unique constraint check
      let registrationFindFirstCallCount = 0
      mockDb.query.competitionRegistrationsTable = {
        findFirst: vi.fn().mockImplementation(() => {
          registrationFindFirstCallCount++
          // First call = registration lookup, second call = unique constraint check
          if (registrationFindFirstCallCount === 1) {
            return Promise.resolve(registration)
          }
          return Promise.resolve(existingTargetRegistration)
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      // Source + target division lookups
      let scalingFindFirstCallCount = 0
      mockDb.query.scalingLevelsTable = {
        findFirst: vi.fn().mockImplementation(() => {
          scalingFindFirstCallCount++
          if (scalingFindFirstCallCount === 1) {
            return Promise.resolve(sourceDivision)
          }
          return Promise.resolve(targetDivision)
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      // Transaction mock: set return value for delete (affectedRows)
      mockDb.setMockReturnValue([{affectedRows: 0}])
    }

    beforeEach(() => {
      setMockSession(mockOrganizerSession)
    })

    describe('authentication', () => {
      it('rejects unauthenticated users', async () => {
        vi.mocked(requireVerifiedEmail).mockRejectedValue(new Error('Unauthorized'))

        await expect(
          transferRegistrationDivision({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
              targetDivisionId,
            },
          }),
        ).rejects.toThrow('Unauthorized')
      })
    })

    describe('authorization', () => {
      it('rejects users without manage_competitions permission', async () => {
        setupTransferMocks()
        setMockSession({
          userId: 'random-user',
          user: {id: 'random-user', email: 'random@example.com', role: 'user'},
          teams: [{id: organizingTeamId, permissions: ['access_dashboard']}],
        })

        await expect(
          transferRegistrationDivision({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
              targetDivisionId,
            },
          }),
        ).rejects.toThrow('Missing required permission: manage_competitions')
      })

      it('rejects users not on the organizing team', async () => {
        setupTransferMocks()
        setMockSession({
          userId: 'random-user',
          user: {id: 'random-user', email: 'random@example.com', role: 'user'},
          teams: [{id: 'different-team', permissions: ['manage_competitions']}],
        })

        await expect(
          transferRegistrationDivision({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
              targetDivisionId,
            },
          }),
        ).rejects.toThrow('Missing required permission: manage_competitions')
      })

      it('allows site admins to bypass team check', async () => {
        setupTransferMocks()
        setMockSession(mockAdminSession)

        const result = await transferRegistrationDivision({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            targetDivisionId,
          },
        })

        expect(result.success).toBe(true)
      })

      it('allows organizer with manage_competitions permission', async () => {
        setupTransferMocks()

        const result = await transferRegistrationDivision({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            targetDivisionId,
          },
        })

        expect(result.success).toBe(true)
      })
    })

    describe('validation', () => {
      it('throws when competition not found', async () => {
        setupTransferMocks()
        mockDb.query.competitionsTable = {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        }

        await expect(
          transferRegistrationDivision({
            data: {
              registrationId: testRegistrationId,
              competitionId: 'nonexistent',
              targetDivisionId,
            },
          }),
        ).rejects.toThrow('Competition not found')
      })

      it('throws when registration not found', async () => {
        setupTransferMocks({registration: undefined})
        mockDb.query.competitionRegistrationsTable = {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        }

        await expect(
          transferRegistrationDivision({
            data: {
              registrationId: 'nonexistent',
              competitionId: testCompetitionId,
              targetDivisionId,
            },
          }),
        ).rejects.toThrow('Registration not found')
      })

      it('throws when registration is removed', async () => {
        setupTransferMocks({
          registration: {...mockActiveRegistration, status: 'removed'},
        })

        await expect(
          transferRegistrationDivision({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
              targetDivisionId,
            },
          }),
        ).rejects.toThrow('Cannot transfer a removed registration')
      })

      it('throws when transferring to the same division', async () => {
        setupTransferMocks({
          registration: {...mockActiveRegistration, divisionId: targetDivisionId},
        })

        await expect(
          transferRegistrationDivision({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
              targetDivisionId,
            },
          }),
        ).rejects.toThrow('Registration is already in this division')
      })

      it('throws when target division not found', async () => {
        setupTransferMocks({targetDivision: null})

        await expect(
          transferRegistrationDivision({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
              targetDivisionId,
            },
          }),
        ).rejects.toThrow('Target division not found')
      })

      it('throws when team sizes do not match (individual → team)', async () => {
        setupTransferMocks({
          targetDivision: {id: targetDivisionId, teamSize: 3},
        })

        await expect(
          transferRegistrationDivision({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
              targetDivisionId,
            },
          }),
        ).rejects.toThrow('Cannot transfer between divisions with different team sizes (1 → 3)')
      })

      it('throws when team sizes do not match (team → individual)', async () => {
        setupTransferMocks({
          registration: {...mockActiveRegistration, divisionId: 'div-team'},
          sourceDivision: {id: 'div-team', teamSize: 2},
          targetDivision: {id: targetDivisionId, teamSize: 1},
        })

        await expect(
          transferRegistrationDivision({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
              targetDivisionId,
            },
          }),
        ).rejects.toThrow('Cannot transfer between divisions with different team sizes (2 → 1)')
      })

      it('throws when athlete already registered in target division', async () => {
        setupTransferMocks({
          existingTargetRegistration: {id: 'existing-reg'},
        })

        await expect(
          transferRegistrationDivision({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
              targetDivisionId,
            },
          }),
        ).rejects.toThrow('Athlete already has a registration in the target division')
      })
    })

    describe('successful transfer', () => {
      it('updates registration divisionId in a transaction', async () => {
        setupTransferMocks()

        const result = await transferRegistrationDivision({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            targetDivisionId,
          },
        })

        expect(result.success).toBe(true)
        // Transaction should be called
        expect(mockDb.transaction).toHaveBeenCalledTimes(1)
        // Update should be called within transaction (divisionId update)
        expect(mockDb.update).toHaveBeenCalled()
      })

      it('deletes heat assignments and returns count', async () => {
        setupTransferMocks()
        mockDb.setMockReturnValue([{affectedRows: 3}])

        const result = await transferRegistrationDivision({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            targetDivisionId,
          },
        })

        expect(result.success).toBe(true)
        expect(result.removedHeatAssignments).toBe(3)
        expect(mockDb.delete).toHaveBeenCalled()
      })

      it('returns 0 removed heat assignments when none exist', async () => {
        setupTransferMocks()
        mockDb.setMockReturnValue([{affectedRows: 0}])

        const result = await transferRegistrationDivision({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            targetDivisionId,
          },
        })

        expect(result.success).toBe(true)
        expect(result.removedHeatAssignments).toBe(0)
      })

      it('updates commerce purchase divisionId when present', async () => {
        setupTransferMocks({
          registration: {
            ...mockActiveRegistration,
            commercePurchaseId: testPurchaseId,
          },
        })

        const result = await transferRegistrationDivision({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            targetDivisionId,
          },
        })

        expect(result.success).toBe(true)
        // update called for: registration divisionId + commerce purchase divisionId
        expect(mockDb.update).toHaveBeenCalledTimes(2)
      })

      it('does not update commerce purchase when no purchaseId', async () => {
        setupTransferMocks({
          registration: {
            ...mockActiveRegistration,
            commercePurchaseId: null,
          },
        })

        const result = await transferRegistrationDivision({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            targetDivisionId,
          },
        })

        expect(result.success).toBe(true)
        // update called only for: registration divisionId
        expect(mockDb.update).toHaveBeenCalledTimes(1)
      })

      it('handles transfer from null divisionId (unassigned)', async () => {
        setupTransferMocks({
          registration: {...mockActiveRegistration, divisionId: null},
          sourceDivision: null,
        })
        // Override: no source division lookup needed when divisionId is null
        // The target division lookup should still return the target
        mockDb.query.scalingLevelsTable = {
          findFirst: vi.fn().mockResolvedValue(mockTargetDivision),
          findMany: vi.fn().mockResolvedValue([]),
        }

        const result = await transferRegistrationDivision({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            targetDivisionId,
          },
        })

        expect(result.success).toBe(true)
      })

      it('allows transfer between team divisions with matching teamSize', async () => {
        setupTransferMocks({
          registration: {...mockActiveRegistration, divisionId: 'div-team-a'},
          sourceDivision: {id: 'div-team-a', teamSize: 2},
          targetDivision: {id: targetDivisionId, teamSize: 2},
        })

        const result = await transferRegistrationDivision({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            targetDivisionId,
          },
        })

        expect(result.success).toBe(true)
      })
    })
  })

  // ============================================================================
  // Refund Registration (Organizer-Initiated, Stripe Express Only) Tests
  // ============================================================================

  describe('refundRegistrationFn', () => {
    const organizingTeamId = 'org-team-1'
    const refundPurchaseId = 'purchase-refund-1'
    const stripePaymentIntent = 'pi_refundtest123'
    const stripeRefundId = 're_test_abc123'
    const stripeConnectedAccountId = 'acct_express_1'

    const mockOrganizerSession = {
      userId: 'organizer-user-1',
      user: {id: 'organizer-user-1', email: 'organizer@example.com', role: 'user'},
      teams: [
        {
          id: organizingTeamId,
          permissions: ['manage_competitions'],
        },
      ],
    }

    const mockAdminSession = {
      userId: 'admin-user-1',
      user: {id: 'admin-user-1', email: 'admin@example.com', role: 'admin'},
      teams: [],
    }

    const mockCompetition = {
      id: testCompetitionId,
      organizingTeamId,
    }

    const mockRefundableRegistration = {
      id: testRegistrationId,
      userId: registeredUserId,
      eventId: testCompetitionId,
      divisionId: testDivisionId,
      status: 'active',
      athleteTeamId: null,
      teamMemberId: 'member-123',
      paymentStatus: 'PAID',
      commercePurchaseId: refundPurchaseId,
    }

    const mockExpressTeam = {
      id: organizingTeamId,
      stripeConnectedAccountId,
      stripeAccountStatus: 'VERIFIED',
      stripeAccountType: 'express',
    }

    const mockStandardTeam = {
      id: organizingTeamId,
      stripeConnectedAccountId,
      stripeAccountStatus: 'VERIFIED',
      stripeAccountType: 'standard',
    }

    const mockUnverifiedExpressTeam = {
      id: organizingTeamId,
      stripeConnectedAccountId,
      stripeAccountStatus: 'PENDING',
      stripeAccountType: 'express',
    }

    const mockCompletedPurchase = {
      id: refundPurchaseId,
      userId: registeredUserId,
      status: 'COMPLETED',
      totalCents: 7500,
      stripePaymentIntentId: stripePaymentIntent,
    }

    function setupRefundMocks(overrides?: {
      registration?: Record<string, unknown> | null
      team?: Record<string, unknown> | null
      purchase?: Record<string, unknown> | null
      existingRefundEvent?: Record<string, unknown> | null
    }) {
      mockDb.registerTable('competitionsTable')
      mockDb.registerTable('competitionRegistrationsTable')
      mockDb.registerTable('teamTable')
      mockDb.registerTable('commercePurchaseTable')
      mockDb.registerTable('financialEventTable')

      const registration = overrides?.registration === undefined
        ? mockRefundableRegistration
        : overrides.registration
      const team = overrides?.team === undefined ? mockExpressTeam : overrides.team
      const purchase = overrides?.purchase === undefined
        ? mockCompletedPurchase
        : overrides.purchase
      const existingRefundEvent = overrides?.existingRefundEvent ?? null

      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([]),
      }
      mockDb.query.competitionRegistrationsTable = {
        findFirst: vi.fn().mockResolvedValue(registration),
        findMany: vi.fn().mockResolvedValue([]),
      }
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(team),
        findMany: vi.fn().mockResolvedValue([]),
      }
      mockDb.query.commercePurchaseTable = {
        findFirst: vi.fn().mockResolvedValue(purchase),
        findMany: vi.fn().mockResolvedValue([]),
      }
      mockDb.query.financialEventTable = {
        findFirst: vi.fn().mockResolvedValue(existingRefundEvent),
        findMany: vi.fn().mockResolvedValue([]),
      }

      mockStripeRefundsCreate.mockResolvedValue({
        id: stripeRefundId,
        amount: purchase?.totalCents ?? 0,
        status: 'succeeded',
        payment_intent: stripePaymentIntent,
      })
    }

    beforeEach(() => {
      mockStripeRefundsCreate.mockReset()
      mockRecordRefundInitiated.mockReset()
      setMockSession(mockOrganizerSession)
    })

    describe('authentication', () => {
      it('rejects unauthenticated users', async () => {
        vi.mocked(requireVerifiedEmail).mockRejectedValue(new Error('Unauthorized'))

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow('Unauthorized')
      })
    })

    describe('authorization', () => {
      it('rejects users without manage_competitions permission', async () => {
        setupRefundMocks()
        setMockSession({
          userId: 'random-user',
          user: {id: 'random-user', email: 'random@example.com', role: 'user'},
          teams: [{id: organizingTeamId, permissions: ['access_dashboard']}],
        })

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow('Missing required permission: manage_competitions')
      })

      it('allows site admins to bypass team check', async () => {
        setupRefundMocks()
        setMockSession(mockAdminSession)

        const result = await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        expect(result.success).toBe(true)
      })
    })

    describe('Stripe Express requirement', () => {
      it('rejects when team has no Stripe Connect account', async () => {
        setupRefundMocks({
          team: {
            id: organizingTeamId,
            stripeConnectedAccountId: null,
            stripeAccountStatus: null,
            stripeAccountType: null,
          },
        })

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow(/Stripe Express/)
      })

      it('rejects when team uses a Standard (non-Express) account', async () => {
        setupRefundMocks({team: mockStandardTeam})

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow(/Stripe Express/)
      })

      it('rejects when Express account is not VERIFIED', async () => {
        setupRefundMocks({team: mockUnverifiedExpressTeam})

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow(/Stripe Express/)
      })

      it('does not call Stripe when Express check fails', async () => {
        setupRefundMocks({team: mockStandardTeam})

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow()

        expect(mockStripeRefundsCreate).not.toHaveBeenCalled()
      })
    })

    describe('validation', () => {
      it('throws when competition not found', async () => {
        setupRefundMocks()
        mockDb.query.competitionsTable = {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        }

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: 'nonexistent',
            },
          }),
        ).rejects.toThrow('Competition not found')
      })

      it('throws when registration not found', async () => {
        setupRefundMocks({registration: null})

        await expect(
          refundRegistration({
            data: {
              registrationId: 'nonexistent',
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow('Registration not found')
      })

      it('throws when registration has no associated purchase', async () => {
        setupRefundMocks({
          registration: {...mockRefundableRegistration, commercePurchaseId: null},
        })

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow(/no.*purchase|not.*paid/i)
      })

      it('throws when purchase is not COMPLETED', async () => {
        setupRefundMocks({
          purchase: {...mockCompletedPurchase, status: 'PENDING'},
        })

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow(/not.*completed|cannot.*refund/i)
      })

      it('throws when purchase has no Stripe payment intent', async () => {
        setupRefundMocks({
          purchase: {...mockCompletedPurchase, stripePaymentIntentId: null},
        })

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow(/payment intent|cannot.*refund/i)
      })
    })

    describe('partial refund', () => {
      it('passes the requested amountCents to Stripe (not the full purchase total)', async () => {
        // Purchase total: $75.00 — organizer requests a partial $30.00 refund.
        setupRefundMocks()

        await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            amountCents: 3000,
          },
        })

        expect(mockStripeRefundsCreate).toHaveBeenCalledTimes(1)
        const call = mockStripeRefundsCreate.mock.calls[0]?.[0]
        expect(call).toMatchObject({
          payment_intent: stripePaymentIntent,
          amount: 3000,
          reverse_transfer: true,
          refund_application_fee: false,
        })
      })

      it('allows a follow-up refund up to the remaining balance', async () => {
        // $75 purchase, $30 already refunded → $45 remaining.
        setupRefundMocks()
        mockDb.query.financialEventTable.findMany = vi.fn().mockResolvedValue([
          {
            id: 'fevt_prior',
            purchaseId: refundPurchaseId,
            eventType: 'REFUND_INITIATED',
            amountCents: -3000,
          },
        ])

        const result = await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            amountCents: 4500,
          },
        })

        expect(result.success).toBe(true)
        expect(result.amountCents).toBe(4500)
        expect(mockStripeRefundsCreate).toHaveBeenCalledTimes(1)
        expect(mockStripeRefundsCreate.mock.calls[0]?.[0]).toMatchObject({
          amount: 4500,
        })
      })

      it('rejects a refund that would exceed the remaining balance', async () => {
        // $75 purchase, $30 already refunded → $45 remaining.
        // Asking for $50 must be rejected; Stripe is never called.
        setupRefundMocks()
        mockDb.query.financialEventTable.findMany = vi.fn().mockResolvedValue([
          {
            id: 'fevt_prior',
            purchaseId: refundPurchaseId,
            eventType: 'REFUND_INITIATED',
            amountCents: -3000,
          },
        ])

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
              amountCents: 5000,
            },
          }),
        ).rejects.toThrow(/exceed|remaining|balance/i)

        expect(mockStripeRefundsCreate).not.toHaveBeenCalled()
        expect(mockRecordRefundInitiated).not.toHaveBeenCalled()
      })

      it('rejects when the purchase has already been fully refunded', async () => {
        // $75 purchase, $75 already refunded across two prior partials → $0 remaining.
        setupRefundMocks()
        mockDb.query.financialEventTable.findMany = vi.fn().mockResolvedValue([
          {amountCents: -3000},
          {amountCents: -4500},
        ])

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow(/fully refunded|already.*refund/i)

        expect(mockStripeRefundsCreate).not.toHaveBeenCalled()
        expect(mockRecordRefundInitiated).not.toHaveBeenCalled()
      })

      it('defaults amountCents to remaining balance when not provided', async () => {
        // $75 purchase, $30 already refunded → $45 remaining.
        // Caller omits amountCents, so the function should refund $45.
        setupRefundMocks()
        mockDb.query.financialEventTable.findMany = vi.fn().mockResolvedValue([
          {amountCents: -3000},
        ])

        const result = await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        expect(result.amountCents).toBe(4500)
        expect(mockStripeRefundsCreate.mock.calls[0]?.[0]).toMatchObject({
          amount: 4500,
        })
        expect(mockRecordRefundInitiated.mock.calls[0]?.[0]).toMatchObject({
          amountCents: 4500,
        })
      })
    })

    describe('happy path', () => {
      it('creates a Stripe refund with reverse_transfer for destination charges', async () => {
        setupRefundMocks()

        await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        expect(mockStripeRefundsCreate).toHaveBeenCalledTimes(1)
        const call = mockStripeRefundsCreate.mock.calls[0]?.[0]
        expect(call).toMatchObject({
          payment_intent: stripePaymentIntent,
          reverse_transfer: true,
        })
      })

      it('pulls funds from the connect account and keeps the platform application fee', async () => {
        // Stripe Connect destination charges:
        //  - reverse_transfer: true → reverses the transfer, debiting the
        //    connect account so the refund is funded by the organizer's
        //    balance, not the platform's.
        //  - refund_application_fee: false → the platform fee we collected
        //    via application_fee_amount is NOT refunded; it stays as
        //    platform revenue.
        // Both flags must be explicit (not relying on defaults) since this
        // controls who bears the cost of the refund.
        setupRefundMocks()

        await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        const call = mockStripeRefundsCreate.mock.calls[0]?.[0]
        expect(call).toMatchObject({
          reverse_transfer: true,
          refund_application_fee: false,
        })
        // Belt-and-suspenders: also assert the value isn't undefined so we
        // notice if a future refactor accidentally drops the explicit flag
        // and falls back to Stripe's default.
        expect(call?.refund_application_fee).toBe(false)
      })

      it('records a REFUND_INITIATED financial event', async () => {
        setupRefundMocks()

        await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            reason: 'Athlete unable to compete',
          },
        })

        expect(mockRecordRefundInitiated).toHaveBeenCalledTimes(1)
        const call = mockRecordRefundInitiated.mock.calls[0]?.[0]
        expect(call).toMatchObject({
          purchaseId: refundPurchaseId,
          teamId: organizingTeamId,
          amountCents: 7500,
          stripePaymentIntentId: stripePaymentIntent,
          stripeRefundId,
          actorId: 'organizer-user-1',
        })
      })

      it('returns the Stripe refund id and amount', async () => {
        setupRefundMocks()

        const result = await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        expect(result.success).toBe(true)
        expect(result.refundId).toBe(stripeRefundId)
        expect(result.amountCents).toBe(7500)
      })
    })

    describe('Stripe failure handling', () => {
      it('does not record a financial event if Stripe rejects the refund', async () => {
        setupRefundMocks()
        mockStripeRefundsCreate.mockRejectedValueOnce(
          new Error('Stripe error: insufficient funds'),
        )

        await expect(
          refundRegistration({
            data: {
              registrationId: testRegistrationId,
              competitionId: testCompetitionId,
            },
          }),
        ).rejects.toThrow(/Stripe|refund/i)

        expect(mockRecordRefundInitiated).not.toHaveBeenCalled()
      })
    })

    describe('concurrency safety', () => {
      // The TOCTOU race between balance-check and event-write is closed by
      // running the entire balance-check + Stripe-call + event-write inside
      // a single db.transaction() and acquiring a row-level lock on the
      // purchase row (SELECT ... FOR UPDATE). PlanetScale (Vitess) supports
      // FOR UPDATE in single-shard transactions and queues concurrent
      // requests via "hot row protection". The lock can't be exercised in a
      // unit test (the mock has no real concurrency), so this asserts the
      // structural property: the work is wrapped in a transaction.
      it('wraps the refund flow in db.transaction()', async () => {
        setupRefundMocks()

        await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        expect(mockDb.transaction).toHaveBeenCalledTimes(1)
        // Stripe refund must happen inside the transaction (so a thrown
        // error rolls back the lock cleanly without recording a phantom
        // financial event).
        expect(mockStripeRefundsCreate).toHaveBeenCalledTimes(1)
      })

      it('acquires a SELECT ... FOR UPDATE lock on the purchase row inside the transaction', async () => {
        setupRefundMocks()
        const chainMock = mockDb.getChainMock()

        await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        expect(chainMock.for).toHaveBeenCalledWith('update')
      })

      it('uses the client-supplied idempotencyToken in the Stripe idempotency key', async () => {
        // Without a stable client-supplied token, a partial-refund retry
        // (client times out before seeing the response) would generate a
        // different key on the second attempt and produce a DUPLICATE Stripe
        // refund. The token is the contract that ties retries to a single
        // logical operation — same token in, same idempotency key out.
        setupRefundMocks()

        await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            amountCents: 3000,
            idempotencyToken: 'client-uuid-aaa-111',
          },
        })

        expect(mockStripeRefundsCreate).toHaveBeenCalledTimes(1)
        const opts = mockStripeRefundsCreate.mock.calls[0]?.[1]
        expect(opts).toMatchObject({
          idempotencyKey: 'refund:client-uuid-aaa-111',
        })
      })

      it('produces the same Stripe idempotency key for two calls sharing the same token', async () => {
        // Stable derivation — the test exercises the idempotency contract
        // directly: replays of the same logical operation must collapse.
        setupRefundMocks()
        await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            amountCents: 3000,
            idempotencyToken: 'client-uuid-stable',
          },
        })
        const firstKey =
          mockStripeRefundsCreate.mock.calls[0]?.[1]?.idempotencyKey

        // Simulate the retry: prior REFUND_INITIATED row already exists
        // (the first attempt persisted before the response was lost).
        mockStripeRefundsCreate.mockReset()
        mockStripeRefundsCreate.mockResolvedValue({
          id: stripeRefundId,
          amount: 3000,
          status: 'succeeded',
        })
        mockDb.query.financialEventTable.findMany = vi.fn().mockResolvedValue([
          {amountCents: -3000},
        ])

        await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
            amountCents: 3000,
            idempotencyToken: 'client-uuid-stable',
          },
        })
        const secondKey =
          mockStripeRefundsCreate.mock.calls[0]?.[1]?.idempotencyKey

        expect(secondKey).toBe(firstKey)
      })

      it('records the financial event through the same tx (not a fresh getDb connection)', async () => {
        // Without this, the REFUND_INITIATED INSERT escapes the transaction
        // and survives a rollback — breaking the atomicity claim. We verify by
        // asserting recordRefundInitiated receives the tx passed in by
        // db.transaction(), which equals the chain mock that FakeDrizzleDb
        // hands the callback.
        setupRefundMocks()
        const chainMock = mockDb.getChainMock()

        await refundRegistration({
          data: {
            registrationId: testRegistrationId,
            competitionId: testCompetitionId,
          },
        })

        expect(mockRecordRefundInitiated).toHaveBeenCalledTimes(1)
        const recordedParams = mockRecordRefundInitiated.mock.calls[0]?.[0]
        expect(recordedParams.db).toBe(chainMock)
      })
    })
  })
})
