import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'
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
    STRIPE_WEBHOOK_SECRET: 'replace_me_stripe_webhook_secret',
    STRIPE_SECRET_KEY: 'replace_me_stripe_secret_key',
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
  getStripeWebhookSecret: vi.fn(() => 'replace_me_stripe_webhook_secret'),
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

// Mock financial events recorders
const mockRecordRefundCompleted = vi.fn()
const mockRecordDisputeEvent = vi.fn()
vi.mock('@/server/commerce/financial-events', () => ({
  recordRefundCompleted: (...args: unknown[]) =>
    mockRecordRefundCompleted(...args),
  recordDisputeEvent: (...args: unknown[]) => mockRecordDisputeEvent(...args),
}))

// Mock Crew billing completion
const mockCompleteCrewCheckoutSessionFromWebhook = vi.fn()
const mockExpireCrewCheckout = vi.fn()
vi.mock('@/server/crew-billing.server', () => ({
  expireCrewCheckoutSessionFromWebhook: (...args: unknown[]) => mockExpireCrewCheckout(...args),
  completeCrewCheckoutSessionFromWebhook: (...args: unknown[]) =>
    mockCompleteCrewCheckoutSessionFromWebhook(...args),
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
let routeConfigPromise: Promise<{
  server: {handlers: {POST: (args: {request: Request}) => Promise<Response>}}
}> | null = null

async function getRouteConfig() {
  routeConfigPromise ??= import('@/routes/api/webhooks/stripe').then(
    ({Route}) =>
      Route as unknown as {
        server: {
          handlers: {POST: (args: {request: Request}) => Promise<Response>}
        }
      },
  )
  return routeConfigPromise
}

async function callWebhook(
  body: string,
  headers: Record<string, string> = {'stripe-signature': 'sig_test'},
) {
  const request = new Request('https://test.wodsmith.com/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers,
  })

  const routeConfig = await getRouteConfig()
  return routeConfig.server.handlers.POST({request})
}

beforeAll(async () => {
  await getRouteConfig()
}, 30_000)

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.reset()
  mockDb.registerTable('commercePurchaseTable')
  mockDb.registerTable('teamTable')
  mockDb.registerTable('competitionsTable')
  mockDb.registerTable('financialEventTable')
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
    // @lat: [[crew#Crew Stripe Webhooks]]
    it('routes Crew Checkout Sessions to Crew billing completion', async () => {
      const {buildCrewCheckoutBillingEventId, buildCrewCheckoutIdempotencyKey} =
        await import('@/lib/crew/checkout-sessions')
      const checkoutIdempotencyKey = buildCrewCheckoutIdempotencyKey({
        competitionId: 'event-crew-1',
        teamId: 'team-owner-1',
        crewPlan: 'crew_basic',
        amountCents: 20000,
      })
      const billingEventId = buildCrewCheckoutBillingEventId(
        checkoutIdempotencyKey,
      )
      const session = {
        id: 'cs_crew_123',
        payment_status: 'paid',
        payment_intent: 'pi_crew_456',
        amount_total: 20000,
        currency: 'usd',
        metadata: {
          product: 'crew',
          teamId: 'team-owner-1',
          competitionId: 'event-crew-1',
          eventId: 'event-crew-1',
          crewPlan: 'crew_basic',
          crewEventSettingsId: 'crewset_123',
          billingEventId,
          checkoutIdempotencyKey,
        },
      }

      const event = buildStripeEvent(
        'checkout.session.completed',
        session,
        'evt_crew_123',
      )
      mockConstructEventAsync.mockResolvedValue(event)
      mockCompleteCrewCheckoutSessionFromWebhook.mockResolvedValue({
        status: 'completed',
      })

      const response = await callWebhook(JSON.stringify(event))
      expect(response.status).toBe(200)

      expect(mockCompleteCrewCheckoutSessionFromWebhook).toHaveBeenCalledWith({
        stripeEventId: 'evt_crew_123',
        sessionId: 'cs_crew_123',
        eventId: 'event-crew-1',
        teamId: 'team-owner-1',
        crewPlan: 'crew_basic',
        crewEventSettingsId: 'crewset_123',
        billingEventId,
        checkoutIdempotencyKey,
        amountCents: 20000,
        currency: 'usd',
        stripePaymentIntentId: 'pi_crew_456',
      })
      expect(mockWorkflowCreate).not.toHaveBeenCalled()
    })

    // @lat: [[crew#Crew Stripe Webhooks]]
    it('returns 200 for invalid Crew Checkout metadata without granting access', async () => {
      const session = {
        id: 'cs_crew_invalid',
        payment_status: 'paid',
        payment_intent: 'pi_crew_invalid',
        amount_total: 20000,
        currency: 'usd',
        metadata: {
          product: 'crew',
          teamId: 'team-owner-1',
          competitionId: 'event-crew-1',
          crewPlan: 'crew_basic',
        },
      }

      const event = buildStripeEvent(
        'checkout.session.completed',
        session,
        'evt_crew_invalid',
      )
      mockConstructEventAsync.mockResolvedValue(event)

      const response = await callWebhook(JSON.stringify(event))
      expect(response.status).toBe(200)
      expect(mockCompleteCrewCheckoutSessionFromWebhook).not.toHaveBeenCalled()
      expect(mockWorkflowCreate).not.toHaveBeenCalled()
    })

    // @lat: [[crew#Crew Stripe Webhooks]]
    it('treats duplicate Crew Checkout completion as webhook success', async () => {
      const {buildCrewCheckoutBillingEventId, buildCrewCheckoutIdempotencyKey} =
        await import('@/lib/crew/checkout-sessions')
      const checkoutIdempotencyKey = buildCrewCheckoutIdempotencyKey({
        competitionId: 'event-crew-1',
        teamId: 'team-owner-1',
        crewPlan: 'crew_basic',
        amountCents: 20000,
      })
      const session = {
        id: 'cs_crew_duplicate',
        payment_status: 'paid',
        payment_intent: 'pi_crew_duplicate',
        amount_total: 20000,
        currency: 'usd',
        metadata: {
          product: 'crew',
          teamId: 'team-owner-1',
          competitionId: 'event-crew-1',
          eventId: 'event-crew-1',
          crewPlan: 'crew_basic',
          crewEventSettingsId: 'crewset_123',
          billingEventId: buildCrewCheckoutBillingEventId(
            checkoutIdempotencyKey,
          ),
          checkoutIdempotencyKey,
        },
      }

      const event = buildStripeEvent(
        'checkout.session.completed',
        session,
        'evt_crew_duplicate',
      )
      mockConstructEventAsync.mockResolvedValue(event)
      mockCompleteCrewCheckoutSessionFromWebhook.mockResolvedValue({
        status: 'duplicate',
      })

      const response = await callWebhook(JSON.stringify(event))
      expect(response.status).toBe(200)
      expect(mockCompleteCrewCheckoutSessionFromWebhook).toHaveBeenCalledOnce()
    })

  })
})

// @lat: [[crew#Crew Checkout Recovery]]
describe('Crew checkout payment boundary', () => {
  it('does not unlock an unpaid completed session', async () => {
    const { buildCrewCheckoutBillingEventId, buildCrewCheckoutIdempotencyKey } =
      await import('@/lib/crew/checkout-sessions')
    const checkoutIdempotencyKey = buildCrewCheckoutIdempotencyKey({
      competitionId: 'event-crew-1', teamId: 'team-owner-1', crewPlan: 'crew_basic', amountCents: 20000,
    })
    const event = buildStripeEvent('checkout.session.completed', {
      id: 'cs_unpaid', payment_status: 'unpaid', amount_total: 20000, currency: 'usd',
      metadata: {
        product: 'crew', teamId: 'team-owner-1', competitionId: 'event-crew-1',
        eventId: 'event-crew-1', crewPlan: 'crew_basic', crewEventSettingsId: 'crewset_123',
        billingEventId: buildCrewCheckoutBillingEventId(checkoutIdempotencyKey), checkoutIdempotencyKey,
      },
    })
    mockConstructEventAsync.mockResolvedValue(event)
    const response = await callWebhook(JSON.stringify(event))
    expect(response.status).toBe(200)
    expect(mockCompleteCrewCheckoutSessionFromWebhook).not.toHaveBeenCalled()
  })

  it('routes Crew expiration to event billing instead of athlete purchases', async () => {
    const session = { id: 'cs_expired', status: 'expired', metadata: { product: 'crew' } }
    mockConstructEventAsync.mockResolvedValue(buildStripeEvent('checkout.session.expired', session))
    const response = await callWebhook('{}')
    expect(response.status).toBe(200)
    expect(mockExpireCrewCheckout).toHaveBeenCalledWith(session)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('retries when Crew expiration persistence fails', async () => {
    mockConstructEventAsync.mockResolvedValue(buildStripeEvent('checkout.session.expired', {
      id: 'cs_expired', status: 'expired', metadata: { product: 'crew' },
    }))
    mockExpireCrewCheckout.mockRejectedValue(new Error('Database unavailable'))
    expect((await callWebhook('{}')).status).toBe(500)
  })
})

// @lat: [[crew#Shared Stripe Account Isolation]]
describe('Shared Stripe account isolation', () => {
  it.each(['checkout.session.completed', 'checkout.session.expired', 'account.updated', 'charge.refunded'])(
    'acknowledges %s without processing another product', async (type) => {
      mockConstructEventAsync.mockResolvedValue(buildStripeEvent(type, {
        id: 'cs_registration',
        metadata: { purchaseId: 'purchase-1', competitionId: 'comp-1', userId: 'user-1' },
      }))
      const response = await callWebhook('{}')
      expect(response.status).toBe(200)
      expect(mockWorkflowCreate).not.toHaveBeenCalled()
      expect(mockDb.update).not.toHaveBeenCalled()
      expect(mockDb.query.commercePurchaseTable.findFirst).not.toHaveBeenCalled()
      expect(mockRecordRefundCompleted).not.toHaveBeenCalled()
      expect(mockCompleteCrewCheckoutSessionFromWebhook).not.toHaveBeenCalled()
      expect(mockExpireCrewCheckout).not.toHaveBeenCalled()
    },
  )
})
