import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  COMMERCE_PRODUCT_TYPE,
  COMMERCE_PURCHASE_STATUS,
} from "@/db/schema"

const mockDb = new FakeDrizzleDb()
vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }))

vi.mock("cloudflare:workers", () => ({
  WorkflowEntrypoint: class {
    constructor(
      protected ctx: Record<string, unknown>,
      protected env: Record<string, unknown>,
    ) {}
  },
  env: {},
}))

const mockLogError = vi.fn()
const mockLogInfo = vi.fn()
const mockLogWarning = vi.fn()
vi.mock("@/lib/logging/posthog-otel-logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  logInfo: (...args: unknown[]) => mockLogInfo(...args),
  logWarning: (...args: unknown[]) => mockLogWarning(...args),
}))

const mockRegisterForCompetition = vi.fn()
const mockNotifyRegistrationConfirmed = vi.fn()
vi.mock("@/server/registration", () => ({
  registerForCompetition: (...args: unknown[]) =>
    mockRegisterForCompetition(...args),
  notifyRegistrationConfirmed: (...args: unknown[]) =>
    mockNotifyRegistrationConfirmed(...args),
}))

const mockNotifyCompetitionRegistration = vi.fn()
vi.mock("@/lib/slack", () => ({
  notifyCompetitionRegistration: (...args: unknown[]) =>
    mockNotifyCompetitionRegistration(...args),
}))

const mockStripeRefundsCreate = vi.fn()
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    refunds: {
      create: (...args: unknown[]) => mockStripeRefundsCreate(...args),
    },
  })),
}))

vi.mock("@sentry/cloudflare", () => ({
  instrumentWorkflowWithSentry: (_options: unknown, WorkflowClass: unknown) =>
    WorkflowClass,
}))
vi.mock("@/lib/sentry/server", () => ({ getSentryOptions: vi.fn(() => ({})) }))

import {
  type CheckoutCompletedParams,
  StripeCheckoutWorkflow,
} from "@/workflows/stripe-checkout-workflow"

const competitionId = "comp-1"
const userId = "user-1"
const registrationPurchaseId = "purchase-registration"
const addonPurchaseId = "purchase-addon"

const registrationPurchase = {
  id: registrationPurchaseId,
  productId: "product-registration",
  userId,
  status: COMMERCE_PURCHASE_STATUS.PENDING,
  metadata: JSON.stringify({}),
  competitionId,
  divisionId: "division-1",
  variantId: null,
  quantity: 1,
  totalCents: 5_000,
  platformFeeCents: 200,
  stripeFeeCents: 175,
  organizerNetCents: 4_625,
}

const addonPurchase = {
  id: addonPurchaseId,
  productId: "product-addon",
  userId,
  status: COMMERCE_PURCHASE_STATUS.PENDING,
  metadata: JSON.stringify({ addonProductId: "addon-1" }),
  competitionId,
  divisionId: null,
  variantId: null,
  quantity: 2,
  totalCents: 5_200,
  platformFeeCents: 200,
  stripeFeeCents: 0,
  organizerNetCents: 5_000,
}

const competition = {
  id: competitionId,
  organizingTeamId: "organizer-team",
  name: "Test Competition",
  slug: "test-competition",
  startDate: "2026-09-01",
  defaultMaxSpotsPerDivision: 50,
  maxTotalRegistrations: null,
}

function params(purchaseIds: string[]): CheckoutCompletedParams {
  return {
    stripeEventId: "evt-1",
    session: {
      id: "cs-1",
      payment_intent: "pi-1",
      amount_total: 10_200,
      customer_email: "athlete@example.com",
      metadata: { purchaseIds, competitionId, userId },
    },
  }
}

function event(payload: CheckoutCompletedParams) {
  return { payload, timestamp: new Date(), instanceId: payload.stripeEventId }
}

function step() {
  return {
    do: vi.fn(
      async (
        _name: string,
        configOrFn: unknown,
        maybeFn?: () => Promise<unknown>,
      ) => (maybeFn ?? (configOrFn as () => Promise<unknown>))(),
    ),
  }
}

function setCommonQueries() {
  mockDb.query.competitionsTable = {
    findFirst: vi.fn().mockResolvedValue(competition),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.query.competitionDivisionsTable = {
    findFirst: vi.fn().mockResolvedValue({ maxSpots: 50 }),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.query.competitionRegistrationsTable = {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.query.scalingLevelsTable = {
    findFirst: vi.fn().mockResolvedValue({ id: "division-1", label: "Rx" }),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.query.userTable = {
    findFirst: vi.fn().mockResolvedValue({
      id: userId,
      email: "athlete@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    }),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.query.competitionInvitesTable = {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  }
  mockDb.setMockReturnValue([{ count: 0, affectedRows: 1 }])
  mockRegisterForCompetition.mockResolvedValue({ registrationId: "reg-1" })
  mockNotifyRegistrationConfirmed.mockResolvedValue(undefined)
  mockNotifyCompetitionRegistration.mockResolvedValue(true)
  mockStripeRefundsCreate.mockResolvedValue({ id: "refund-1" })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.reset()
  setCommonQueries()
})

describe("StripeCheckoutWorkflow session reconciliation", () => {
  // @lat: [[commerce#Registration Add-ons#Session-level settlement tests#Registration completes before merch]]
  it("completes registration before merch in one workflow", async () => {
    mockDb.query.commercePurchaseTable = {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([registrationPurchase, addonPurchase])
        .mockResolvedValueOnce([
          {
            ...registrationPurchase,
            status: COMMERCE_PURCHASE_STATUS.COMPLETED,
          },
        ]),
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(registrationPurchase)
        .mockResolvedValueOnce(addonPurchase),
    }
    mockDb.query.commerceProductTable = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: registrationPurchase.productId,
          type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
        },
        { id: addonPurchase.productId, type: COMMERCE_PRODUCT_TYPE.ADDON },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
      }),
    }

    const workflow = new StripeCheckoutWorkflow({} as never, {} as never)
    const fakeStep = step()
    await workflow.run(
      event(params([registrationPurchaseId, addonPurchaseId])) as never,
      fakeStep as never,
    )

    expect(mockRegisterForCompetition).toHaveBeenCalledOnce()
    expect(mockStripeRefundsCreate).not.toHaveBeenCalled()
    expect(mockNotifyRegistrationConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ registrationId: "reg-1", isPaid: true }),
    )
    expect(fakeStep.do.mock.calls[0]?.[0]).toBe("process-checkout-session")
  })

  // @lat: [[commerce#Registration Add-ons#Session-level settlement tests#Free registration waits for paid merch]]
  it("creates a free registration only after the paid merch session completes", async () => {
    const freePurchase = {
      ...registrationPurchase,
      totalCents: 0,
      stripeFeeCents: 0,
      metadata: JSON.stringify({ isFreeRegistration: true }),
    }
    mockDb.query.commercePurchaseTable = {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([freePurchase, addonPurchase])
        .mockResolvedValueOnce([
          { ...freePurchase, status: COMMERCE_PURCHASE_STATUS.COMPLETED },
        ]),
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(freePurchase)
        .mockResolvedValueOnce(addonPurchase),
    }
    mockDb.query.commerceProductTable = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: freePurchase.productId,
          type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
        },
        { id: addonPurchase.productId, type: COMMERCE_PRODUCT_TYPE.ADDON },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
      }),
    }

    const workflow = new StripeCheckoutWorkflow({} as never, {} as never)
    await workflow.run(
      event(params([registrationPurchaseId, addonPurchaseId])) as never,
      step() as never,
    )

    expect(mockNotifyRegistrationConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ isPaid: false, amountPaidCents: 0 }),
    )
  })

  // @lat: [[commerce#Registration Add-ons#Session-level settlement tests#Retries preserve registration notifications]]
  it("reconstructs completed registration results when settlement retries", async () => {
    const completedPurchase = {
      ...registrationPurchase,
      status: COMMERCE_PURCHASE_STATUS.COMPLETED,
    }
    mockDb.query.commercePurchaseTable = {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([completedPurchase, addonPurchase])
        .mockResolvedValueOnce([completedPurchase]),
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(completedPurchase)
        .mockResolvedValueOnce(addonPurchase),
    }
    mockDb.query.commerceProductTable = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: completedPurchase.productId,
          type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
        },
        { id: addonPurchase.productId, type: COMMERCE_PRODUCT_TYPE.ADDON },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
      }),
    }
    mockDb.query.competitionRegistrationsTable = {
      findFirst: vi.fn().mockResolvedValue({
        id: "reg-1",
        commercePurchaseId: registrationPurchaseId,
        teamName: null,
        pendingTeammates: null,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    }

    const workflow = new StripeCheckoutWorkflow({} as never, {} as never)
    await workflow.run(
      event(params([registrationPurchaseId, addonPurchaseId])) as never,
      step() as never,
    )

    expect(mockRegisterForCompetition).not.toHaveBeenCalled()
    expect(mockNotifyRegistrationConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ registrationId: "reg-1", isPaid: true }),
    )
  })

  // @lat: [[commerce#Registration Add-ons#Session-level settlement tests#Failed registration refunds every session line]]
  it("refunds registration and merch separately when every registration fails", async () => {
    mockDb.query.commercePurchaseTable = {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([registrationPurchase, addonPurchase])
        .mockResolvedValueOnce([
          { ...registrationPurchase, status: COMMERCE_PURCHASE_STATUS.FAILED },
        ]),
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(registrationPurchase)
        .mockResolvedValueOnce(addonPurchase),
    }
    mockDb.query.commerceProductTable = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: registrationPurchase.productId,
          type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
        },
        { id: addonPurchase.productId, type: COMMERCE_PRODUCT_TYPE.ADDON },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
      }),
    }
    mockDb.query.competitionDivisionsTable.findFirst = vi
      .fn()
      .mockResolvedValue({ maxSpots: 0 })

    const workflow = new StripeCheckoutWorkflow({} as never, {} as never)
    await workflow.run(
      event(params([registrationPurchaseId, addonPurchaseId])) as never,
      step() as never,
    )

    expect(mockStripeRefundsCreate).toHaveBeenCalledTimes(2)
    expect(mockStripeRefundsCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ amount: registrationPurchase.totalCents }),
      expect.objectContaining({
        idempotencyKey: `checkout-auto-refund:${registrationPurchaseId}`,
      }),
    )
    expect(mockStripeRefundsCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ amount: addonPurchase.totalCents }),
      expect.objectContaining({
        idempotencyKey: `checkout-auto-refund:${addonPurchaseId}`,
      }),
    )
  })

  // @lat: [[commerce#Registration Add-ons#Session-level settlement tests#Refund failures remain retryable]]
  it("throws on refund failure so the durable workflow retries", async () => {
    mockDb.query.commercePurchaseTable = {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([registrationPurchase])
        .mockResolvedValueOnce([
          { ...registrationPurchase, status: COMMERCE_PURCHASE_STATUS.FAILED },
        ]),
      findFirst: vi.fn().mockResolvedValue(registrationPurchase),
    }
    mockDb.query.commerceProductTable = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: registrationPurchase.productId,
          type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
        },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
      }),
    }
    mockDb.query.competitionDivisionsTable.findFirst = vi
      .fn()
      .mockResolvedValue({ maxSpots: 0 })
    mockStripeRefundsCreate.mockRejectedValue(new Error("Stripe unavailable"))

    const workflow = new StripeCheckoutWorkflow({} as never, {} as never)
    await expect(
      workflow.run(event(params([registrationPurchaseId])) as never, step() as never),
    ).rejects.toThrow("Stripe unavailable")
  })

  // @lat: [[commerce#Registration Add-ons#Session-level settlement tests#Oversold merch refunds only its line]]
  it("uses an idempotent partial refund when merch stock is lost", async () => {
    const trackedAddon = { ...addonPurchase, variantId: "variant-1" }
    mockDb.query.commercePurchaseTable = {
      findMany: vi.fn().mockResolvedValueOnce([trackedAddon]),
      findFirst: vi.fn().mockResolvedValue(trackedAddon),
    }
    mockDb.query.commerceProductTable = {
      findMany: vi.fn().mockResolvedValue([
        { id: trackedAddon.productId, type: COMMERCE_PRODUCT_TYPE.ADDON },
      ]),
      findFirst: vi.fn().mockResolvedValue({ type: COMMERCE_PRODUCT_TYPE.ADDON }),
    }
    mockDb.setMockReturnValue([{ affectedRows: 0 }])

    const workflow = new StripeCheckoutWorkflow({} as never, {} as never)
    await workflow.run(event(params([addonPurchaseId])) as never, step() as never)

    expect(mockStripeRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: addonPurchase.totalCents }),
      expect.objectContaining({
        idempotencyKey: `checkout-auto-refund:${addonPurchaseId}`,
      }),
    )
  })
})
