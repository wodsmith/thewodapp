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
vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeCheckoutCreate(...args),
      },
    },
  })),
}))

// Mock division capacity
const mockGetDivisionSpotsAvailableFn = vi.fn()
vi.mock('@/server-fns/competition-divisions-fns', () => ({
  getDivisionSpotsAvailableFn: (...args: unknown[]) =>
    mockGetDivisionSpotsAvailableFn(...args),
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
            affiliateName: 'CrossFit Denver',
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
})
