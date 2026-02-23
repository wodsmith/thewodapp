import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
import {COMMERCE_PURCHASE_STATUS} from '@/db/schema'

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Mock cloudflare:workers (WorkflowEntrypoint, env)
vi.mock('cloudflare:workers', () => ({
  WorkflowEntrypoint: class {
    protected ctx: Record<string, unknown>
    protected env: Record<string, unknown>
    constructor(ctx: Record<string, unknown>, env: Record<string, unknown>) {
      this.ctx = ctx ?? {}
      this.env = env ?? {}
    }
  },
  env: {
    APP_URL: 'https://test.wodsmith.com',
    STRIPE_SECRET_KEY: 'sk_test_123',
  },
}))

// Mock logging
const mockLogError = vi.fn()
const mockLogInfo = vi.fn()
const mockLogWarning = vi.fn()
vi.mock('@/lib/logging/posthog-otel-logger', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  logInfo: (...args: unknown[]) => mockLogInfo(...args),
  logWarning: (...args: unknown[]) => mockLogWarning(...args),
}))

// Mock registration
const mockRegisterForCompetition = vi.fn()
const mockNotifyRegistrationConfirmed = vi.fn()
vi.mock('@/server/registration', () => ({
  registerForCompetition: (...args: unknown[]) =>
    mockRegisterForCompetition(...args),
  notifyRegistrationConfirmed: (...args: unknown[]) =>
    mockNotifyRegistrationConfirmed(...args),
}))

// Mock Slack
const mockNotifyCompetitionRegistration = vi.fn()
vi.mock('@/lib/slack', () => ({
  notifyCompetitionRegistration: (...args: unknown[]) =>
    mockNotifyCompetitionRegistration(...args),
}))

// Mock Stripe
const mockStripeRefundsCreate = vi.fn()
vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    refunds: {
      create: (...args: unknown[]) => mockStripeRefundsCreate(...args),
    },
  })),
}))

// Mock division capacity
vi.mock('@/utils/division-capacity', () => ({
  calculateDivisionCapacity: vi.fn((input) => {
    const effectiveMax =
      input.divisionMaxSpots ?? input.competitionDefaultMax ?? null
    const totalOccupied =
      Number(input.registrationCount) + Number(input.pendingCount)
    const isFull = effectiveMax !== null && totalOccupied >= effectiveMax
    return {effectiveMax, totalOccupied, spotsAvailable: null, isFull}
  }),
}))

// Mock TanStack
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: unknown) => fn,
    inputValidator: () => ({
      handler: (fn: unknown) => fn,
    }),
  }),
  createServerOnlyFn: (fn: unknown) => fn,
}))

// Import after mocks
import {
  StripeCheckoutWorkflow,
  type CheckoutCompletedParams,
} from '@/workflows/stripe-checkout-workflow'

// Helper: create a fake WorkflowStep that executes callbacks directly
function createFakeStep() {
  return {
    do: vi.fn(
      async (
        _name: string,
        configOrFn: unknown,
        maybeFn?: () => Promise<unknown>,
      ) => {
        const fn = maybeFn ?? (configOrFn as () => Promise<unknown>)
        return fn()
      },
    ),
    sleep: vi.fn(),
    sleepUntil: vi.fn(),
  }
}

// Helper: create workflow event
function createWorkflowEvent(params: CheckoutCompletedParams) {
  return {
    payload: params,
    timestamp: new Date(),
    instanceId: params.stripeEventId,
  }
}

// Test data
const testPurchaseId = 'purchase-123'
const testCompetitionId = 'comp-456'
const testDivisionId = 'div-789'
const testUserId = 'user-101'
const testRegistrationId = 'reg-202'

const baseSession: CheckoutCompletedParams['session'] = {
  id: 'cs_test_123',
  payment_intent: 'pi_test_456',
  amount_total: 5000,
  customer_email: 'athlete@test.com',
  metadata: {
    purchaseId: testPurchaseId,
    competitionId: testCompetitionId,
    divisionId: testDivisionId,
    userId: testUserId,
  },
}

const baseParams: CheckoutCompletedParams = {
  stripeEventId: 'evt_test_123',
  session: baseSession,
}

const mockPurchase = {
  id: testPurchaseId,
  status: COMMERCE_PURCHASE_STATUS.PENDING,
  metadata: null,
  competitionId: testCompetitionId,
  divisionId: testDivisionId,
}

const mockCompetition = {
  id: testCompetitionId,
  name: 'Test Competition',
  slug: 'test-competition',
  startDate: '2025-06-15',
  competitionTeamId: 'team-event-1',
  defaultMaxSpotsPerDivision: 50,
  registrationOpensAt: '2025-01-01',
  registrationClosesAt: '2025-06-01',
  timezone: 'America/Denver',
  settings: JSON.stringify({divisions: {scalingGroupId: 'sg-1'}}),
}

const mockUser = {
  id: testUserId,
  email: 'athlete@test.com',
  firstName: 'John',
  lastName: 'Doe',
  affiliateName: null,
}

const mockDivisionConfig = {
  competitionId: testCompetitionId,
  divisionId: testDivisionId,
  maxSpots: 50,
  division: {id: testDivisionId, label: 'Rx'},
}

function setupHappyPathMocks() {
  // Query API mocks (per-table)
  mockDb.query.commercePurchaseTable = {
    findFirst: vi.fn().mockResolvedValue(mockPurchase),
    findMany: vi.fn().mockResolvedValue([]),
  }

  mockDb.query.competitionRegistrationsTable = {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  }

  mockDb.query.competitionsTable = {
    findFirst: vi.fn().mockResolvedValue(mockCompetition),
    findMany: vi.fn().mockResolvedValue([]),
  }

  mockDb.query.competitionDivisionsTable = {
    findFirst: vi.fn().mockResolvedValue(mockDivisionConfig),
    findMany: vi.fn().mockResolvedValue([]),
  }

  mockDb.query.userTable = {
    findFirst: vi.fn().mockResolvedValue(mockUser),
    findMany: vi.fn().mockResolvedValue([]),
  }

  // Chain API: select returns count (used for capacity check)
  // Both Promise.all selects return [{count: 5}] — 5+5=10 < 50 max
  mockDb.setMockReturnValue([{count: 5}])

  // Registration creation
  mockRegisterForCompetition.mockResolvedValue({
    registrationId: testRegistrationId,
    teamMemberId: 'tm-1',
    athleteTeamId: null,
  })

  // Notifications
  mockNotifyRegistrationConfirmed.mockResolvedValue(undefined)
  mockNotifyCompetitionRegistration.mockResolvedValue(true)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.reset()
})

describe('StripeCheckoutWorkflow', () => {
  describe('Step 1: create-registration — Happy Path', () => {
    it('creates individual registration successfully', async () => {
      setupHappyPathMocks()

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      await workflow.run(event as any, step as any)

      // Verify all 3 steps were executed
      expect(step.do).toHaveBeenCalledTimes(3)
      expect(step.do).toHaveBeenCalledWith(
        'create-registration',
        expect.any(Object),
        expect.any(Function),
      )
      expect(step.do).toHaveBeenCalledWith(
        'send-confirmation-email',
        expect.any(Object),
        expect.any(Function),
      )
      expect(step.do).toHaveBeenCalledWith(
        'send-slack-notification',
        expect.any(Object),
        expect.any(Function),
      )

      // Verify registerForCompetition was called
      expect(mockRegisterForCompetition).toHaveBeenCalledWith({
        competitionId: testCompetitionId,
        userId: testUserId,
        divisionId: testDivisionId,
        teamName: undefined,
        affiliateName: undefined,
        teammates: undefined,
      })
    })

    it('creates team registration with teammates and stores answers', async () => {
      setupHappyPathMocks()

      const purchaseWithTeamMeta = {
        ...mockPurchase,
        metadata: JSON.stringify({
          teamName: 'Test Team',
          affiliateName: 'CF Test',
          teammates: [{email: 'teammate@test.com', firstName: 'Jane'}],
          answers: [{questionId: 'q1', answer: 'Yes'}],
        }),
      }

      mockDb.query.commercePurchaseTable = {
        findFirst: vi.fn().mockResolvedValue(purchaseWithTeamMeta),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      await workflow.run(event as any, step as any)

      expect(mockRegisterForCompetition).toHaveBeenCalledWith(
        expect.objectContaining({
          teamName: 'Test Team',
          affiliateName: 'CF Test',
          teammates: [{email: 'teammate@test.com', firstName: 'Jane'}],
        }),
      )

      // Verify answers were inserted (insert was called for answers)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('Step 1: create-registration — Failure States', () => {
    it('returns null when purchase not found', async () => {
      mockDb.query.commercePurchaseTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      await workflow.run(event as any, step as any)

      // Only 1 step called (create-registration returned null), no email/slack
      expect(step.do).toHaveBeenCalledTimes(1)
      expect(mockRegisterForCompetition).not.toHaveBeenCalled()
    })

    it('skips when purchase already completed (idempotency)', async () => {
      mockDb.query.commercePurchaseTable = {
        findFirst: vi.fn().mockResolvedValue({
          ...mockPurchase,
          status: COMMERCE_PURCHASE_STATUS.COMPLETED,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      await workflow.run(event as any, step as any)

      expect(step.do).toHaveBeenCalledTimes(1)
      expect(mockRegisterForCompetition).not.toHaveBeenCalled()
      expect(mockLogInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            '[Workflow] Purchase already completed, skipping registration',
        }),
      )
    })

    it('ensures purchase completed when registration already exists by purchaseId (idempotency)', async () => {
      setupHappyPathMocks()

      mockDb.query.competitionRegistrationsTable = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'existing-reg',
          commercePurchaseId: testPurchaseId,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      await workflow.run(event as any, step as any)

      // Should mark purchase as completed but not create new registration
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockRegisterForCompetition).not.toHaveBeenCalled()
      expect(step.do).toHaveBeenCalledTimes(1)
    })

    it('reconciles registration found by eventId+userId when commercePurchaseId missing (partial failure recovery)', async () => {
      setupHappyPathMocks()

      // First findFirst (by commercePurchaseId) returns null
      // Second findFirst (by eventId+userId) returns the orphaned registration
      mockDb.query.competitionRegistrationsTable = {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null) // primary check: no match by purchaseId
          .mockResolvedValueOnce({
            id: 'orphaned-reg',
            commercePurchaseId: null,
            eventId: testCompetitionId,
            userId: testUserId,
          }), // secondary check: found by eventId+userId
        findMany: vi.fn().mockResolvedValue([]),
      }

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      await workflow.run(event as any, step as any)

      // Should link the orphaned registration to the purchase and mark completed
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockRegisterForCompetition).not.toHaveBeenCalled()
      expect(step.do).toHaveBeenCalledTimes(1)
    })

    it('issues refund when division is full during payment', async () => {
      setupHappyPathMocks()

      // Override: capacity check returns high count (50+50=100 >= 50 max)
      mockDb.setMockReturnValue([{count: 50}])

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      await workflow.run(event as any, step as any)

      // Should issue refund
      expect(mockStripeRefundsCreate).toHaveBeenCalledWith({
        payment_intent: 'pi_test_456',
        reason: 'requested_by_customer',
      })

      // Should mark purchase as FAILED
      expect(mockDb.update).toHaveBeenCalled()

      // Should NOT create registration
      expect(mockRegisterForCompetition).not.toHaveBeenCalled()
      expect(step.do).toHaveBeenCalledTimes(1)
    })

    it('logs error but continues when refund fails', async () => {
      setupHappyPathMocks()

      // Division full
      mockDb.setMockReturnValue([{count: 50}])

      // Refund fails
      mockStripeRefundsCreate.mockRejectedValue(new Error('Refund failed'))

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      // Should not throw
      await workflow.run(event as any, step as any)

      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[Workflow] Failed to issue automatic refund',
        }),
      )
    })

    it('marks purchase as FAILED and rethrows when registration creation fails', async () => {
      setupHappyPathMocks()

      mockRegisterForCompetition.mockRejectedValue(
        new Error('Registration failed'),
      )

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      await expect(workflow.run(event as any, step as any)).rejects.toThrow(
        'Registration failed',
      )

      // Purchase should be marked as FAILED
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('returns null when competition not found', async () => {
      setupHappyPathMocks()

      mockDb.query.competitionsTable = {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      }

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      await workflow.run(event as any, step as any)

      expect(step.do).toHaveBeenCalledTimes(1)
      expect(mockRegisterForCompetition).not.toHaveBeenCalled()
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[Workflow] Competition not found for capacity check',
        }),
      )
    })
  })

  describe('Step 2: send-confirmation-email', () => {
    it('sends email with prefetched entities', async () => {
      setupHappyPathMocks()

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      await workflow.run(event as any, step as any)

      expect(mockNotifyRegistrationConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          registrationId: testRegistrationId,
          competitionId: testCompetitionId,
          isPaid: true,
          amountPaidCents: 5000,
          prefetched: expect.objectContaining({
            user: expect.objectContaining({
              id: testUserId,
              email: 'athlete@test.com',
            }),
            competition: expect.objectContaining({
              id: testCompetitionId,
              name: 'Test Competition',
            }),
          }),
        }),
      )
    })

    it('logs warning and continues to Slack when email fails after retries', async () => {
      setupHappyPathMocks()

      mockNotifyRegistrationConfirmed.mockRejectedValue(
        new Error('Email send failed'),
      )

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      // Should not throw — email failure is caught, Slack still runs
      await workflow.run(event as any, step as any)

      expect(mockLogWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            '[Workflow] Email step failed after retries, continuing to Slack',
        }),
      )
      // Slack should still be called
      expect(mockNotifyCompetitionRegistration).toHaveBeenCalled()
    })
  })

  describe('Step 3: send-slack-notification', () => {
    it('sends Slack notification with correct params', async () => {
      setupHappyPathMocks()

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      await workflow.run(event as any, step as any)

      expect(mockNotifyCompetitionRegistration).toHaveBeenCalledWith({
        amountCents: 5000,
        customerEmail: 'athlete@test.com',
        customerName: 'John Doe',
        competitionName: 'Test Competition',
        divisionName: 'Rx',
        teamName: undefined,
        purchaseId: testPurchaseId,
      })
    })

    it('logs warning when Slack fails after retries (does not throw)', async () => {
      setupHappyPathMocks()

      mockNotifyCompetitionRegistration.mockRejectedValue(
        new Error('Slack webhook error'),
      )

      const workflow = new StripeCheckoutWorkflow({} as any, {} as any)
      const step = createFakeStep()
      const event = createWorkflowEvent(baseParams)

      // Should not throw — Slack failure is caught
      await workflow.run(event as any, step as any)

      expect(mockLogWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[Workflow] Slack step failed after retries',
        }),
      )
    })
  })
})
