// @lat: [[crew#Crew Checkout Sessions]]
import { describe, expect, it } from "vitest"
import {
  CREW_BILLING_SOURCE,
  CREW_BILLING_STATE,
} from "../../db/schemas/crew-event-settings"
import {
  assertCrewCheckoutCanStart,
  buildCrewCheckoutBillingEventId,
  buildCrewCheckoutIdempotencyKey,
  buildCrewCheckoutMetadata,
  buildCrewCheckoutSessionCreateParams,
  isCrewStripeCheckoutEnabledValue,
  isReusableCrewCheckoutPendingClaim,
  normalizeCrewCheckoutCatalogPlan,
  resolveCrewCheckoutPlanId,
} from "./checkout-sessions"

const unpaidBilling = {
  state: CREW_BILLING_STATE.UNPAID,
  source: null,
  planId: null,
  amountCents: 0,
  currency: "usd",
  stripe: {
    paymentLinkId: null,
    checkoutSessionId: null,
    paymentIntentId: null,
  },
  founderOverride: false,
  creditCents: 0,
  fullPlatformCreditCents: 0,
  refundedCents: 0,
} as const

describe("Crew Checkout Session helpers", () => {
  it("builds the Stripe metadata contract without private billing data", () => {
    const idempotencyKey = buildCrewCheckoutIdempotencyKey({
      competitionId: "comp_checkout",
      teamId: "team_owner",
      crewPlan: "crew_basic",
      amountCents: 20_000,
    })
    const billingEventId = buildCrewCheckoutBillingEventId(idempotencyKey)
    const metadata = buildCrewCheckoutMetadata({
      teamId: "team_owner",
      competitionId: "comp_checkout",
      crewPlan: "crew_basic",
      crewEventSettingsId: "crewset_123",
      billingEventId,
      checkoutIdempotencyKey: idempotencyKey,
    })

    expect(metadata).toEqual({
      product: "crew",
      teamId: "team_owner",
      competitionId: "comp_checkout",
      eventId: "comp_checkout",
      crewPlan: "crew_basic",
      crewEventSettingsId: "crewset_123",
      billingEventId,
      checkoutIdempotencyKey: idempotencyKey,
    })
    expect(billingEventId).toMatch(/^cbill_checkout_[a-z0-9]+$/)
    expect(buildCrewCheckoutBillingEventId(idempotencyKey)).toBe(billingEventId)
    expect(JSON.stringify(metadata)).not.toContain("founder")
    expect(JSON.stringify(metadata)).not.toContain("invoice")
    expect(JSON.stringify(metadata)).not.toContain("privateMetadata")
  })

  it("builds one-time Checkout Session params from the public Crew catalog plan", () => {
    const idempotencyKey = buildCrewCheckoutIdempotencyKey({
      competitionId: "comp_checkout",
      teamId: "team_owner",
      crewPlan: "crew_pro",
      amountCents: 80_000,
    })
    const billingEventId = buildCrewCheckoutBillingEventId(idempotencyKey)
    const params = buildCrewCheckoutSessionCreateParams({
      eventName: "Boise Throwdown",
      appUrl: "https://crew.wodsmith.com",
      plan: {
        id: "crew_pro",
        name: "Crew Pro",
        description: "One-time Crew event plan",
        price: 80_000,
        currency: "usd",
      },
      teamId: "team_owner",
      competitionId: "comp_checkout",
      crewPlan: "crew_pro",
      crewEventSettingsId: "crewset_123",
      billingEventId,
      checkoutIdempotencyKey: idempotencyKey,
    })

    expect(params.mode).toBe("payment")
    expect(params.customer_email).toBeUndefined()
    expect(params.expires_at).toBeUndefined()
    expect(params.success_url).toBe(
      "https://crew.wodsmith.com/events/comp_checkout/billing?crew_checkout=success&session_id={CHECKOUT_SESSION_ID}",
    )
    expect(params.cancel_url).toBe(
      "https://crew.wodsmith.com/events/comp_checkout/billing?crew_checkout=canceled",
    )
    expect(params.metadata).toMatchObject({
      product: "crew",
      crewPlan: "crew_pro",
      billingEventId,
    })
    expect(params.payment_intent_data?.metadata).toMatchObject(params.metadata)
    expect(params.line_items?.[0]).toMatchObject({
      price_data: {
        currency: "usd",
        unit_amount: 80_000,
        product_data: {
          name: "Crew Pro - Boise Throwdown",
          metadata: params.metadata,
        },
      },
      quantity: 1,
    })
  })

  it("keeps retry metadata and session params stable for the same checkout key", () => {
    const checkoutIdempotencyKey = buildCrewCheckoutIdempotencyKey({
      competitionId: "comp_retry",
      teamId: "team_owner",
      crewPlan: "crew_basic",
      amountCents: 20_000,
    })
    const billingEventId = buildCrewCheckoutBillingEventId(
      checkoutIdempotencyKey,
    )
    const input = {
      eventName: "Retry Throwdown",
      appUrl: "https://crew.wodsmith.com",
      plan: {
        id: "crew_basic",
        name: "Crew Basic",
        description: "One-time Crew event plan",
        price: 20_000,
        currency: "usd",
      },
      teamId: "team_owner",
      competitionId: "comp_retry",
      crewPlan: "crew_basic",
      crewEventSettingsId: "crewset_retry",
      billingEventId,
      checkoutIdempotencyKey,
    } as const

    const firstAttempt = buildCrewCheckoutSessionCreateParams(input)
    const retryAttempt = buildCrewCheckoutSessionCreateParams(input)

    expect(retryAttempt).toEqual(firstAttempt)
    expect(retryAttempt.metadata).toMatchObject({
      billingEventId,
      checkoutIdempotencyKey,
    })
    expect(retryAttempt.expires_at).toBeUndefined()
    expect(retryAttempt.customer_email).toBeUndefined()
  })

  it("parses the feature flag and rejects unsafe plan/session states", () => {
    expect(isCrewStripeCheckoutEnabledValue("enabled")).toBe(true)
    expect(isCrewStripeCheckoutEnabledValue("true")).toBe(true)
    expect(isCrewStripeCheckoutEnabledValue("0")).toBe(false)
    expect(resolveCrewCheckoutPlanId({ currentPlanId: null })).toBe(
      "crew_basic",
    )
    expect(resolveCrewCheckoutPlanId({ requestedPlanId: "crew_pro" })).toBe(
      "crew_pro",
    )
    expect(() =>
      resolveCrewCheckoutPlanId({ requestedPlanId: "crew_founding_2026" }),
    ).toThrow(/public paid plans/)
    expect(() =>
      normalizeCrewCheckoutCatalogPlan({
        id: "crew_founding_2026",
        name: "Founder",
        description: "Private",
        price: 9900,
        interval: null,
        isActive: 1,
        isPublic: 0,
      }),
    ).toThrow(/public paid/)
    expect(() =>
      normalizeCrewCheckoutCatalogPlan({
        id: "crew_basic",
        name: "Crew Basic",
        description: null,
        price: 0,
        interval: null,
        isActive: 1,
        isPublic: 1,
      }),
    ).toThrow(/positive/)
  })

  it("prevents duplicate pending sessions and active-billing checkout starts", () => {
    expect(() => assertCrewCheckoutCanStart(unpaidBilling)).not.toThrow()
    expect(() =>
      assertCrewCheckoutCanStart({
        ...unpaidBilling,
        state: CREW_BILLING_STATE.PENDING,
        source: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
        planId: "crew_basic",
        stripe: {
          ...unpaidBilling.stripe,
          checkoutSessionId: "cs_pending",
        },
      }),
    ).toThrow(/already pending/)
    expect(() =>
      assertCrewCheckoutCanStart({
        ...unpaidBilling,
        state: CREW_BILLING_STATE.PENDING,
        source: CREW_BILLING_SOURCE.PAYMENT_LINK,
        planId: "crew_basic",
      }),
    ).toThrow(/already pending/)
    expect(() =>
      assertCrewCheckoutCanStart({
        ...unpaidBilling,
        state: CREW_BILLING_STATE.PAID,
        source: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
        planId: "crew_basic",
      }),
    ).toThrow(/already active/)
    expect(() =>
      assertCrewCheckoutCanStart({
        ...unpaidBilling,
        planId: "crew_starter",
      }),
    ).toThrow(/public paid plans/)
    expect(() =>
      assertCrewCheckoutCanStart({
        ...unpaidBilling,
        planId: "crew_founding_2026",
      }),
    ).toThrow(/public paid plans/)
  })

  it("identifies only same-plan pending checkout claims as retryable", () => {
    const pendingClaim = {
      ...unpaidBilling,
      state: CREW_BILLING_STATE.PENDING,
      source: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
      planId: "crew_basic",
      amountCents: 20_000,
    } as const

    expect(
      isReusableCrewCheckoutPendingClaim({
        billing: pendingClaim,
        crewPlan: "crew_basic",
        amountCents: 20_000,
        currency: "USD",
      }),
    ).toBe(true)
    expect(
      isReusableCrewCheckoutPendingClaim({
        billing: pendingClaim,
        crewPlan: "crew_pro",
        amountCents: 80_000,
        currency: "usd",
      }),
    ).toBe(false)
    expect(
      isReusableCrewCheckoutPendingClaim({
        billing: {
          ...pendingClaim,
          stripe: {
            ...pendingClaim.stripe,
            checkoutSessionId: "cs_pending",
          },
        },
        crewPlan: "crew_basic",
        amountCents: 20_000,
        currency: "usd",
      }),
    ).toBe(false)
  })
})
