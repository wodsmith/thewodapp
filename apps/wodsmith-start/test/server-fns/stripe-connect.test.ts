import {beforeEach, afterEach, describe, it, expect, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
import {TEAM_PERMISSIONS} from '@/db/schema'
import {
  getStripeConnectionStatusFn,
  initiateExpressOnboardingFn,
  initiateStandardOAuthFn,
  refreshOnboardingLinkFn,
  disconnectStripeAccountFn,
  getStripeDashboardUrlFn,
  getStripeAccountBalanceFn,
  syncStripeAccountStatusFn,
} from '@/server-fns/stripe-connect'

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
        TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
        TEAM_PERMISSIONS.ACCESS_BILLING,
      ],
    },
  ],
}

vi.mock('@/utils/auth', () => ({
  getSessionFromCookie: vi.fn(() => Promise.resolve(mockSession)),
  requireVerifiedEmail: vi.fn(() => Promise.resolve(mockSession)),
}))

// Mock Stripe
const mockStripeAccount = {
  id: 'acct_123',
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
}

const mockStripeAccountLink = {
  url: 'https://connect.stripe.com/express/onboard/acct_123',
}

const mockStripeLoginLink = {
  url: 'https://dashboard.stripe.com/express/acct_123',
}

const mockStripeBalance = {
  available: [{currency: 'usd', amount: 10000}],
  pending: [{currency: 'usd', amount: 5000}],
}

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    accounts: {
      create: vi.fn().mockResolvedValue(mockStripeAccount),
      retrieve: vi.fn().mockResolvedValue(mockStripeAccount),
      createLoginLink: vi.fn().mockResolvedValue(mockStripeLoginLink),
    },
    accountLinks: {
      create: vi.fn().mockResolvedValue(mockStripeAccountLink),
    },
    balance: {
      retrieve: vi.fn().mockResolvedValue(mockStripeBalance),
    },
    oauth: {
      token: vi.fn().mockResolvedValue({stripe_user_id: 'acct_123'}),
    },
  })),
}))

// Mock is-prod
vi.mock('@/utils/is-prod', () => ({
  default: false,
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

// Mock setCookie from TanStack
vi.mock('@tanstack/react-start/server', () => ({
  setCookie: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.reset()

  // Register tables for query API
  mockDb.registerTable('teamTable')

  // Set required env vars for OAuth tests
  process.env.STRIPE_CLIENT_ID = 'ca_test_123'
  process.env.NEXT_PUBLIC_APP_URL = 'https://test.thewodapp.com'
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('stripe-connect server functions', () => {
  describe('getStripeConnectionStatusFn', () => {
    const validInput = {teamId: 'team-123'}

    it('should return isConnected: false when team has no Stripe account', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          stripeConnectedAccountId: null,
          stripeAccountStatus: null,
          stripeAccountType: null,
          stripeOnboardingCompletedAt: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await getStripeConnectionStatusFn({data: validInput})

      expect(result.isConnected).toBe(false)
      expect(result.status).toBeNull()
      expect(result.accountType).toBeNull()
    })

    it('should return isConnected: true when team has VERIFIED status', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          stripeConnectedAccountId: 'acct_123',
          stripeAccountStatus: 'VERIFIED',
          stripeAccountType: 'express',
          stripeOnboardingCompletedAt: new Date('2024-01-01'),
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await getStripeConnectionStatusFn({data: validInput})

      expect(result.isConnected).toBe(true)
      expect(result.status).toBe('VERIFIED')
      expect(result.accountType).toBe('express')
      expect(result.onboardingCompletedAt).toBeInstanceOf(Date)
    })

    it('should return isConnected: false when team has PENDING status', async () => {
      // When PENDING:
      // 1. First findFirst: get team status (returns PENDING)
      // 2. syncStripeAccountStatusInternal calls findFirst (needs stripeConnectedAccountId)
      // 3. After sync, findFirst again to re-fetch status
      const mockFindFirst = vi
        .fn()
        // 1. Initial fetch - returns PENDING
        .mockResolvedValueOnce({
          stripeConnectedAccountId: 'acct_123',
          stripeAccountStatus: 'PENDING',
          stripeAccountType: 'standard',
          stripeOnboardingCompletedAt: null,
        })
        // 2. Sync internal fetch
        .mockResolvedValueOnce({
          stripeConnectedAccountId: 'acct_123',
          stripeOnboardingCompletedAt: null,
        })
        // 3. Re-fetch after sync - still PENDING (Stripe says not ready)
        .mockResolvedValueOnce({
          stripeAccountStatus: 'PENDING',
          stripeOnboardingCompletedAt: null,
        })

      mockDb.query.teamTable = {
        findFirst: mockFindFirst,
        findMany: vi.fn().mockResolvedValue([]),
      }

      // Mock Stripe to return a pending account
      const {getStripe} = await import('@/lib/stripe')
      vi.mocked(getStripe).mockReturnValueOnce({
        accounts: {
          retrieve: vi.fn().mockResolvedValue({
            id: 'acct_123',
            charges_enabled: false,
            payouts_enabled: false,
          }),
        },
      } as any)

      const result = await getStripeConnectionStatusFn({data: validInput})

      expect(result.isConnected).toBe(false)
      expect(result.status).toBe('PENDING')
    })

    it('should sync status from Stripe when account is PENDING and becomes VERIFIED', async () => {
      // When PENDING and Stripe says now VERIFIED:
      // 1. First findFirst: get team status (returns PENDING)
      // 2. syncStripeAccountStatusInternal calls findFirst 
      // 3. After sync, findFirst again to re-fetch status (now VERIFIED)
      const mockFindFirst = vi
        .fn()
        // 1. Initial fetch - returns PENDING
        .mockResolvedValueOnce({
          stripeConnectedAccountId: 'acct_123',
          stripeAccountStatus: 'PENDING',
          stripeAccountType: 'express',
          stripeOnboardingCompletedAt: null,
        })
        // 2. Sync internal fetch
        .mockResolvedValueOnce({
          stripeConnectedAccountId: 'acct_123',
          stripeOnboardingCompletedAt: null,
        })
        // 3. Re-fetch after sync - now VERIFIED
        .mockResolvedValueOnce({
          stripeAccountStatus: 'VERIFIED',
          stripeOnboardingCompletedAt: new Date('2024-01-01'),
        })

      mockDb.query.teamTable = {
        findFirst: mockFindFirst,
        findMany: vi.fn().mockResolvedValue([]),
      }

      // Mock Stripe to return a verified account
      const {getStripe} = await import('@/lib/stripe')
      vi.mocked(getStripe).mockReturnValueOnce({
        accounts: {
          retrieve: vi.fn().mockResolvedValue({
            id: 'acct_123',
            charges_enabled: true,
            payouts_enabled: true,
          }),
        },
      } as any)

      const result = await getStripeConnectionStatusFn({data: validInput})

      expect(result.isConnected).toBe(true)
      expect(result.status).toBe('VERIFIED')
    })

    it('should throw error when team is not found', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        getStripeConnectionStatusFn({data: validInput}),
      ).rejects.toThrow('Team not found')
    })

    it('should throw error when user is not a team member', async () => {
      // Session with no teams matching
      const noMemberSession = {
        userId: 'user-123',
        user: {email: 'test@example.com'},
        teams: [],
      }

      const {getSessionFromCookie} = await import('@/utils/auth')
      vi.mocked(getSessionFromCookie).mockResolvedValueOnce(
        noMemberSession as any,
      )

      await expect(
        getStripeConnectionStatusFn({data: validInput}),
      ).rejects.toThrow('Not a member of this team')
    })
  })

  describe('initiateExpressOnboardingFn', () => {
    const validInput = {teamId: 'team-123'}

    it('should create new Express account when team has none', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'team-123',
          name: 'Test Team',
          slug: 'test-team',
          stripeConnectedAccountId: null,
          stripeAccountStatus: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await initiateExpressOnboardingFn({data: validInput})

      expect(result.onboardingUrl).toContain('stripe.com')
    })

    it('should create new onboarding link for existing Express account', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'team-123',
          name: 'Test Team',
          slug: 'test-team',
          stripeConnectedAccountId: 'acct_existing',
          stripeAccountStatus: 'PENDING',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await initiateExpressOnboardingFn({data: validInput})

      expect(result.onboardingUrl).toContain('stripe.com')
    })

    it('should require authentication', async () => {
      const {requireVerifiedEmail} = await import('@/utils/auth')
      vi.mocked(requireVerifiedEmail).mockResolvedValueOnce(null)

      await expect(
        initiateExpressOnboardingFn({data: validInput}),
      ).rejects.toThrow('Unauthorized')
    })

    it('should throw error when team is not found', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        initiateExpressOnboardingFn({data: validInput}),
      ).rejects.toThrow('Team not found')
    })

    it('should throw when user lacks EDIT_TEAM_SETTINGS permission', async () => {
      const noPermSession = {
        userId: 'user-123',
        user: {email: 'test@example.com'},
        teams: [
          {
            id: 'team-123',
            permissions: [], // No permissions
          },
        ],
      }

      const {getSessionFromCookie} = await import('@/utils/auth')
      vi.mocked(getSessionFromCookie).mockResolvedValueOnce(
        noPermSession as any,
      )

      await expect(
        initiateExpressOnboardingFn({data: validInput}),
      ).rejects.toThrow('Missing required permission')
    })
  })

  describe('initiateStandardOAuthFn', () => {
    const validInput = {teamId: 'team-123'}

    it('should generate OAuth authorization URL', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'team-123',
          slug: 'test-team',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await initiateStandardOAuthFn({data: validInput})

      expect(result.authorizationUrl).toContain('stripe.com')
      expect(result.authorizationUrl).toContain('oauth')
    })

    it('should set CSRF state cookie', async () => {
      const {setCookie} = await import('@tanstack/react-start/server')

      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'team-123',
          slug: 'test-team',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await initiateStandardOAuthFn({data: validInput})

      expect(setCookie).toHaveBeenCalledWith(
        expect.any(String), // STRIPE_OAUTH_STATE_COOKIE_NAME
        expect.any(String), // CSRF token
        expect.objectContaining({
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
        }),
      )
    })

    it('should require authentication', async () => {
      const {requireVerifiedEmail} = await import('@/utils/auth')
      vi.mocked(requireVerifiedEmail).mockResolvedValueOnce(null)

      await expect(
        initiateStandardOAuthFn({data: validInput}),
      ).rejects.toThrow('Unauthorized')
    })

    it('should throw error when team is not found', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        initiateStandardOAuthFn({data: validInput}),
      ).rejects.toThrow('Team not found')
    })
  })

  describe('refreshOnboardingLinkFn', () => {
    const validInput = {teamId: 'team-123'}

    it('should create new onboarding link for Express account', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'team-123',
          slug: 'test-team',
          stripeConnectedAccountId: 'acct_123',
          stripeAccountType: 'express',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await refreshOnboardingLinkFn({data: validInput})

      expect(result.onboardingUrl).toContain('stripe.com')
    })

    it('should throw error when no Stripe account is connected', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'team-123',
          stripeConnectedAccountId: null,
          stripeAccountType: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        refreshOnboardingLinkFn({data: validInput}),
      ).rejects.toThrow('No Stripe account connected')
    })

    it('should throw error for Standard accounts', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'team-123',
          stripeConnectedAccountId: 'acct_123',
          stripeAccountType: 'standard',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        refreshOnboardingLinkFn({data: validInput}),
      ).rejects.toThrow('Can only refresh onboarding for Express accounts')
    })

    it('should require authentication', async () => {
      const {requireVerifiedEmail} = await import('@/utils/auth')
      vi.mocked(requireVerifiedEmail).mockResolvedValueOnce(null)

      await expect(
        refreshOnboardingLinkFn({data: validInput}),
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('syncStripeAccountStatusFn', () => {
    const validInput = {teamId: 'team-123'}

    it('should sync account status successfully', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          stripeConnectedAccountId: 'acct_123',
          stripeOnboardingCompletedAt: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await syncStripeAccountStatusFn({data: validInput})

      expect(result.success).toBe(true)
    })
  })

  describe('disconnectStripeAccountFn', () => {
    const validInput = {teamId: 'team-123'}

    it('should disconnect Stripe account successfully', async () => {
      const result = await disconnectStripeAccountFn({data: validInput})

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should require authentication', async () => {
      const {requireVerifiedEmail} = await import('@/utils/auth')
      vi.mocked(requireVerifiedEmail).mockResolvedValueOnce(null)

      await expect(
        disconnectStripeAccountFn({data: validInput}),
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('getStripeDashboardUrlFn', () => {
    const validInput = {teamId: 'team-123'}

    it('should return login link for Express accounts', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          stripeConnectedAccountId: 'acct_123',
          stripeAccountType: 'express',
          stripeAccountStatus: 'VERIFIED',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await getStripeDashboardUrlFn({data: validInput})

      expect(result.dashboardUrl).toContain('stripe.com')
    })

    it('should return direct Stripe dashboard URL for Standard accounts', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          stripeConnectedAccountId: 'acct_123',
          stripeAccountType: 'standard',
          stripeAccountStatus: 'VERIFIED',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await getStripeDashboardUrlFn({data: validInput})

      expect(result.dashboardUrl).toBe('https://dashboard.stripe.com')
    })

    it('should throw error when no Stripe account is connected', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          stripeConnectedAccountId: null,
          stripeAccountType: null,
          stripeAccountStatus: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        getStripeDashboardUrlFn({data: validInput}),
      ).rejects.toThrow('No Stripe account connected')
    })

    it('should throw error when account is not VERIFIED', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          stripeConnectedAccountId: 'acct_123',
          stripeAccountType: 'express',
          stripeAccountStatus: 'PENDING',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      await expect(
        getStripeDashboardUrlFn({data: validInput}),
      ).rejects.toThrow('Stripe account not verified')
    })

    it('should require authentication', async () => {
      const {requireVerifiedEmail} = await import('@/utils/auth')
      vi.mocked(requireVerifiedEmail).mockResolvedValueOnce(null)

      await expect(
        getStripeDashboardUrlFn({data: validInput}),
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('getStripeAccountBalanceFn', () => {
    const validInput = {teamId: 'team-123'}

    it('should return balance for verified account', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          stripeConnectedAccountId: 'acct_123',
          stripeAccountStatus: 'VERIFIED',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await getStripeAccountBalanceFn({data: validInput})

      expect(result).not.toBeNull()
      expect(result?.available).toEqual([{currency: 'usd', amount: 10000}])
      expect(result?.pending).toEqual([{currency: 'usd', amount: 5000}])
    })

    it('should return null when no Stripe account is connected', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          stripeConnectedAccountId: null,
          stripeAccountStatus: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await getStripeAccountBalanceFn({data: validInput})

      expect(result).toBeNull()
    })

    it('should return null when account is not VERIFIED', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          stripeConnectedAccountId: 'acct_123',
          stripeAccountStatus: 'PENDING',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result = await getStripeAccountBalanceFn({data: validInput})

      expect(result).toBeNull()
    })

    it('should require authentication', async () => {
      const {requireVerifiedEmail} = await import('@/utils/auth')
      vi.mocked(requireVerifiedEmail).mockResolvedValueOnce(null)

      await expect(
        getStripeAccountBalanceFn({data: validInput}),
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('Permission edge cases', () => {
    it('should fail fast when user is not authenticated', async () => {
      const {getSessionFromCookie} = await import('@/utils/auth')
      vi.mocked(getSessionFromCookie).mockResolvedValueOnce(null)

      await expect(
        getStripeConnectionStatusFn({data: {teamId: 'team-123'}}),
      ).rejects.toThrow('Not authenticated')
    })
  })

  describe('Security: OAuth state validation', () => {
    it('should generate unique CSRF token for each OAuth request', async () => {
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'team-123',
          slug: 'test-team',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const result1 = await initiateStandardOAuthFn({
        data: {teamId: 'team-123'},
      })
      const result2 = await initiateStandardOAuthFn({
        data: {teamId: 'team-123'},
      })

      // The state parameter in the URLs should be different (unique CSRF tokens)
      // Extract state from URLs
      const getState = (url: string) => {
        const params = new URLSearchParams(url.split('?')[1])
        return params.get('state')
      }

      const state1 = getState(result1.authorizationUrl)
      const state2 = getState(result2.authorizationUrl)

      expect(state1).toBeDefined()
      expect(state2).toBeDefined()
      expect(state1).not.toBe(state2)
    })
  })
})
