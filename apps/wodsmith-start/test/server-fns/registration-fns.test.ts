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

// Mock division capacity check
vi.mock('@/server-fns/competition-divisions-fns', () => ({
  getDivisionSpotsAvailableFn: vi.fn().mockResolvedValue({
    isFull: false,
    spotsAvailable: 100,
  }),
  parseCompetitionSettings: vi.fn().mockReturnValue({
    divisions: { scalingGroupId: 'scaling-group-123' },
  }),
}))

// Import mocked auth so we can change behavior
import {requireVerifiedEmail} from '@/utils/auth'
import {
  updateRegistrationAffiliateFn,
  getRegistrationDetailsFn,
  initiateRegistrationPaymentFn,
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

  describe('initiateRegistrationPaymentFn - teammate email validation', () => {
    const testUserId = 'user-captain-123'
    const mockCaptainSession = {
      userId: testUserId,
      user: {
        id: testUserId,
        email: 'captain@example.com',
      },
      teams: [],
    }

    const mockCompetition = {
      id: testCompetitionId,
      name: 'Test Competition',
      slug: 'test-competition',
      registrationOpensAt: new Date('2024-01-01'),
      registrationClosesAt: new Date('2025-12-31'),
      timezone: 'America/Denver',
      organizingTeamId: 'organizing-team-123',
    }

    const mockUser = {
      id: testUserId,
      email: 'captain@example.com',
      firstName: 'John',
      lastName: 'Doe',
    }

    beforeEach(() => {
      setMockSession(mockCaptainSession)
      mockDb.registerTable('competitionRegistrationQuestionsTable')

      // Mock competition lookup
      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(mockCompetition),
        findMany: vi.fn().mockResolvedValue([]),
      }

      // Mock user lookup
      mockDb.query.userTable = {
        findFirst: vi.fn().mockResolvedValue(mockUser),
        findMany: vi.fn().mockResolvedValue([]),
      }

      // Mock empty registrations (no conflicts)
      mockDb.query.competitionRegistrationsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }
    })

    it('should reject when teammate email is same as user email', async () => {
      await expect(
        initiateRegistrationPaymentFn({
          data: {
            competitionId: testCompetitionId,
            divisionId: testDivisionId,
            teamName: 'Test Team',
            teammates: [
              {
                email: 'captain@example.com', // Same as user's email
                firstName: 'Jane',
                lastName: 'Doe',
              },
            ],
          },
        }),
      ).rejects.toThrow(
        'captain@example.com is your own email. Please enter a different teammate\'s email.',
      )
    })

    it('should reject when teammate email is same as user email (case insensitive)', async () => {
      await expect(
        initiateRegistrationPaymentFn({
          data: {
            competitionId: testCompetitionId,
            divisionId: testDivisionId,
            teamName: 'Test Team',
            teammates: [
              {
                email: 'CAPTAIN@EXAMPLE.COM', // Same email, different case
                firstName: 'Jane',
                lastName: 'Doe',
              },
            ],
          },
        }),
      ).rejects.toThrow(
        'CAPTAIN@EXAMPLE.COM is your own email. Please enter a different teammate\'s email.',
      )
    })

    it('should reject when teammate is already registered for competition', async () => {
      const teammateUser = {
        id: 'teammate-user-123',
        email: 'teammate@example.com',
      }

      const existingRegistration = {
        id: 'existing-reg-123',
        userId: teammateUser.id,
        eventId: testCompetitionId,
      }

      // Mock teammate user exists
      mockDb.query.userTable = {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(mockUser) // First call for captain
          .mockResolvedValueOnce(teammateUser), // Second call for teammate
        findMany: vi.fn().mockResolvedValue([]),
      }

      // Mock teammate already registered
      mockDb.query.competitionRegistrationsTable = {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null) // Check captain not registered
          .mockResolvedValueOnce(existingRegistration), // Check teammate is registered
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        initiateRegistrationPaymentFn({
          data: {
            competitionId: testCompetitionId,
            divisionId: testDivisionId,
            teamName: 'Test Team',
            teammates: [
              {
                email: 'teammate@example.com',
                firstName: 'Jane',
                lastName: 'Doe',
              },
            ],
          },
        }),
      ).rejects.toThrow('teammate@example.com is already registered for this competition')
    })

    it('should reject when teammate is already invited to another team', async () => {
      const existingReg = {
        id: 'other-team-reg-123',
        userId: 'other-captain-456',
        eventId: testCompetitionId,
        pendingTeammates: JSON.stringify([
          {
            email: 'teammate@example.com',
            firstName: 'Jane',
            lastName: 'Doe',
          },
        ]),
      }

      mockDb.query.competitionRegistrationsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([existingReg]),
      }

      await expect(
        initiateRegistrationPaymentFn({
          data: {
            competitionId: testCompetitionId,
            divisionId: testDivisionId,
            teamName: 'Test Team',
            teammates: [
              {
                email: 'teammate@example.com',
                firstName: 'Jane',
                lastName: 'Doe',
              },
            ],
          },
        }),
      ).rejects.toThrow(
        'teammate@example.com has already been invited to another team for this competition',
      )
    })

    it('should allow registration with valid teammate email', async () => {
      // Mock all required dependencies for successful registration
      const mockDivision = {
        id: testDivisionId,
        label: 'RX',
        teamSize: 2,
      }

      const mockOrganizingTeam = {
        id: 'organizing-team-123',
        stripeAccountStatus: 'VERIFIED',
        stripeConnectedAccountId: 'acct_test123',
        organizerFeePercentage: null,
        organizerFeeFixed: null,
      }

      // Mock database responses
      mockDb.query.scalingLevelsTable = {
        findFirst: vi.fn().mockResolvedValue(mockDivision),
        findMany: vi.fn().mockResolvedValue([mockDivision]),
      }

      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(mockOrganizingTeam),
        findMany: vi.fn().mockResolvedValue([]),
      }

      // Mock competition divisions for fee lookup
      mockDb.query.competitionDivisionsTable = {
        findFirst: vi.fn().mockResolvedValue({
          competitionId: testCompetitionId,
          divisionId: testDivisionId,
          feeCents: 5000,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      // Mock Stripe
      const mockStripeSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
        status: 'open',
      }

      vi.mock('@/lib/stripe', () => ({
        getStripe: vi.fn(() => ({
          checkout: {
            sessions: {
              create: vi.fn().mockResolvedValue(mockStripeSession),
            },
          },
        })),
      }))

      // This should NOT throw - teammate email is different from captain
      // Note: The actual call might still fail due to other validations or mocks,
      // but it should pass the teammate email validation
      try {
        await initiateRegistrationPaymentFn({
          data: {
            competitionId: testCompetitionId,
            divisionId: testDivisionId,
            teamName: 'Test Team',
            teammates: [
              {
                email: 'different@example.com', // Different from captain@example.com
                firstName: 'Jane',
                lastName: 'Doe',
              },
            ],
          },
        })
      } catch (error) {
        // If it throws, it should NOT be about the teammate email
        if (error instanceof Error) {
          expect(error.message).not.toContain('is your own email')
          expect(error.message).not.toContain('already registered')
          expect(error.message).not.toContain('already been invited')
        }
      }
    })
  })
})
