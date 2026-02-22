import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Mock cloudflare:workers
const mockWorkflowCreate = vi.fn()
vi.mock('cloudflare:workers', () => ({
  env: {
    STRIPE_CHECKOUT_WORKFLOW: {
      create: (...args: unknown[]) => mockWorkflowCreate(...args),
      get: vi.fn(),
    },
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    STRIPE_SECRET_KEY: 'sk_test_123',
    APP_URL: 'https://test.wodsmith.com',
  },
}))

// Mock Stripe
const mockConstructEventAsync = vi.fn()
vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEventAsync: (...args: unknown[]) =>
        mockConstructEventAsync(...args),
    },
  })),
}))

// Mock env helpers
vi.mock('@/lib/env', () => ({
  getStripeWebhookSecret: vi.fn(() => 'whsec_test_secret'),
}))

// Mock logging
vi.mock('@/lib/logging/posthog-otel-logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
}))

// Mock notifications
vi.mock('@/server/notifications', () => ({
  notifyPaymentExpired: vi.fn(),
}))

// Mock TanStack for route creation
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
}))

vi.mock('@tanstack/react-start', () => ({
  json: (data: unknown, init?: {status?: number}) => {
    return new Response(JSON.stringify(data), {
      status: init?.status ?? 200,
      headers: {'Content-Type': 'application/json'},
    })
  },
  createServerFn: () => ({
    handler: (fn: unknown) => fn,
    inputValidator: () => ({
      handler: (fn: unknown) => fn,
    }),
  }),
  createServerOnlyFn: (fn: unknown) => fn,
}))

// Helper to build a mock Stripe event
function buildStripeEvent(
  type: string,
  data: Record<string, unknown>,
  id = 'evt_test_123',
) {
  return {
    id,
    type,
    data: {object: data},
  }
}

// Helper to call the webhook handler
async function callWebhook(
  body: string,
  headers: Record<string, string> = {'stripe-signature': 'sig_test'},
) {
  // Import after mocks are set up
  const {Route} = await import('@/routes/api/webhooks/stripe')

  const request = new Request('https://test.wodsmith.com/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers,
  })

  // The route config has server.handlers.POST
  const routeConfig = Route as unknown as {
    server: {handlers: {POST: (args: {request: Request}) => Promise<Response>}}
  }
  return routeConfig.server.handlers.POST({request})
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.reset()
  mockDb.registerTable('commercePurchaseTable')
  mockDb.registerTable('teamTable')
})

describe('Stripe Webhook Handler', () => {
  describe('Signature verification', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      const response = await callWebhook('{}', {})
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toEqual({error: 'Missing signature'})
    })

    it('returns 401 when signature verification fails', async () => {
      mockConstructEventAsync.mockRejectedValue(
        new Error('Signature verification failed'),
      )

      const response = await callWebhook('{}')
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data).toEqual({error: 'Invalid signature'})
    })

    it('returns 500 when webhook secret is not configured', async () => {
      const {getStripeWebhookSecret} = await import('@/lib/env')
      vi.mocked(getStripeWebhookSecret).mockReturnValueOnce('')

      const response = await callWebhook('{}')
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data).toEqual({error: 'Webhook not configured'})
    })
  })

  describe('checkout.session.completed', () => {
    it('dispatches to STRIPE_CHECKOUT_WORKFLOW with correct params', async () => {
      const session = {
        id: 'cs_test_123',
        payment_intent: 'pi_test_456',
        amount_total: 5000,
        customer_email: 'athlete@test.com',
        metadata: {
          purchaseId: 'purchase-1',
          competitionId: 'comp-1',
          divisionId: 'div-1',
          userId: 'user-1',
        },
      }

      const event = buildStripeEvent(
        'checkout.session.completed',
        session,
        'evt_checkout_123',
      )
      mockConstructEventAsync.mockResolvedValue(event)
      mockWorkflowCreate.mockResolvedValue(undefined)

      const response = await callWebhook(JSON.stringify(event))
      expect(response.status).toBe(200)

      expect(mockWorkflowCreate).toHaveBeenCalledWith({
        id: 'evt_checkout_123',
        params: {
          stripeEventId: 'evt_checkout_123',
          session: {
            id: 'cs_test_123',
            payment_intent: 'pi_test_456',
            amount_total: 5000,
            customer_email: 'athlete@test.com',
            metadata: {
              purchaseId: 'purchase-1',
              competitionId: 'comp-1',
              divisionId: 'div-1',
              userId: 'user-1',
            },
          },
        },
      })
    })

    it('returns 200 when metadata is missing (logs error, no workflow)', async () => {
      const session = {
        id: 'cs_test_123',
        metadata: {purchaseId: 'purchase-1'},
      }

      const event = buildStripeEvent('checkout.session.completed', session)
      mockConstructEventAsync.mockResolvedValue(event)

      const response = await callWebhook(JSON.stringify(event))
      expect(response.status).toBe(200)
      expect(mockWorkflowCreate).not.toHaveBeenCalled()
    })

    it('handles duplicate event ID gracefully (idempotent)', async () => {
      const session = {
        id: 'cs_test_123',
        payment_intent: 'pi_test_456',
        amount_total: 5000,
        customer_email: 'athlete@test.com',
        metadata: {
          purchaseId: 'purchase-1',
          competitionId: 'comp-1',
          divisionId: 'div-1',
          userId: 'user-1',
        },
      }

      const event = buildStripeEvent(
        'checkout.session.completed',
        session,
        'evt_duplicate',
      )
      mockConstructEventAsync.mockResolvedValue(event)

      // Workflow.create throws on duplicate (Cloudflare behavior)
      mockWorkflowCreate.mockRejectedValue(
        new Error('Workflow instance already exists'),
      )

      const response = await callWebhook(JSON.stringify(event))
      // Should still return 200
      expect(response.status).toBe(200)
    })

    it('extracts payment_intent from object format', async () => {
      const session = {
        id: 'cs_test_123',
        payment_intent: {id: 'pi_from_object'},
        amount_total: 5000,
        customer_email: null,
        metadata: {
          purchaseId: 'purchase-1',
          competitionId: 'comp-1',
          divisionId: 'div-1',
          userId: 'user-1',
        },
      }

      const event = buildStripeEvent('checkout.session.completed', session)
      mockConstructEventAsync.mockResolvedValue(event)
      mockWorkflowCreate.mockResolvedValue(undefined)

      await callWebhook(JSON.stringify(event))

      expect(mockWorkflowCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            session: expect.objectContaining({
              payment_intent: 'pi_from_object',
            }),
          }),
        }),
      )
    })
  })

  describe('checkout.session.expired', () => {
    it('marks purchase as cancelled', async () => {
      const session = {
        id: 'cs_expired_123',
        metadata: {
          purchaseId: 'purchase-expired',
          userId: 'user-1',
          competitionId: 'comp-1',
          divisionId: 'div-1',
        },
      }

      const event = buildStripeEvent('checkout.session.expired', session)
      mockConstructEventAsync.mockResolvedValue(event)

      const response = await callWebhook(JSON.stringify(event))
      expect(response.status).toBe(200)

      // Verify update was called (FakeDrizzleDb tracks calls)
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('account.updated', () => {
    it('updates team Stripe status to VERIFIED', async () => {
      const account = {
        id: 'acct_test_123',
        charges_enabled: true,
        payouts_enabled: true,
      }

      const event = buildStripeEvent('account.updated', account)
      mockConstructEventAsync.mockResolvedValue(event)

      // Mock team lookup
      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'team-1',
          stripeConnectedAccountId: 'acct_test_123',
          stripeOnboardingCompletedAt: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const response = await callWebhook(JSON.stringify(event))
      expect(response.status).toBe(200)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('does nothing when no team found for account', async () => {
      const account = {
        id: 'acct_unknown',
        charges_enabled: true,
        payouts_enabled: true,
      }

      const event = buildStripeEvent('account.updated', account)
      mockConstructEventAsync.mockResolvedValue(event)

      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const response = await callWebhook(JSON.stringify(event))
      expect(response.status).toBe(200)
      expect(mockDb.update).not.toHaveBeenCalled()
    })
  })

  describe('account.application.deauthorized', () => {
    it('clears team Stripe connection', async () => {
      const data = {
        id: 'evt_deauth',
        account: 'acct_test_123',
      }

      const event = buildStripeEvent('account.application.deauthorized', data)
      mockConstructEventAsync.mockResolvedValue(event)

      mockDb.query.teamTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'team-1',
          stripeConnectedAccountId: 'acct_test_123',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const response = await callWebhook(JSON.stringify(event))
      expect(response.status).toBe(200)
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('Unhandled events', () => {
    it('returns 200 for unknown event types', async () => {
      const event = buildStripeEvent('some.unknown.event', {id: 'obj_123'})
      mockConstructEventAsync.mockResolvedValue(event)

      const response = await callWebhook(JSON.stringify(event))
      expect(response.status).toBe(200)
    })
  })
})
