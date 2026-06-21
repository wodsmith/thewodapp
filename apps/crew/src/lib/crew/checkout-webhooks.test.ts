// @lat: [[crew#Crew Stripe Webhooks]]
import { describe, expect, it } from "vitest"
import { CREW_BILLING_EVENT_TYPE } from "../../db/schemas/crew-billing-events"
import {
  CREW_BILLING_SOURCE,
  CREW_BILLING_STATE,
} from "../../db/schemas/crew-event-settings"
import type { CrewBillingStateSnapshot } from "./billing-state"
import {
  buildCrewCheckoutBillingEventId,
  buildCrewCheckoutIdempotencyKey,
} from "./checkout-sessions"
import {
  CrewCheckoutWebhookValidationError,
  getCrewCheckoutSessionCompletionIdempotencyKey,
  getCrewCheckoutStripeEventIdempotencyKey,
  isCrewCheckoutSessionMetadata,
  parseCrewCheckoutSessionWebhook,
  planCrewCheckoutWebhookCompletion,
} from "./checkout-webhooks"

const checkoutIdempotencyKey = buildCrewCheckoutIdempotencyKey({
  competitionId: "event_crew",
  teamId: "team_owner",
  crewPlan: "crew_basic",
  amountCents: 20_000,
})
const billingEventId = buildCrewCheckoutBillingEventId(checkoutIdempotencyKey)

const validMetadata = {
  product: "crew",
  teamId: "team_owner",
  competitionId: "event_crew",
  eventId: "event_crew",
  crewPlan: "crew_basic",
  crewEventSettingsId: "crewset_123",
  billingEventId,
  checkoutIdempotencyKey,
}

const pendingBilling: CrewBillingStateSnapshot = {
  state: CREW_BILLING_STATE.PENDING,
  source: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
  planId: "crew_basic",
  amountCents: 20_000,
  currency: "usd",
  stripe: {
    paymentLinkId: null,
    checkoutSessionId: "cs_crew_123",
    paymentIntentId: null,
  },
  founderOverride: false,
  creditCents: 0,
  fullPlatformCreditCents: 0,
  refundedCents: 0,
}

describe("Crew Checkout webhook helpers", () => {
  it("detects Crew Checkout Sessions by metadata product", () => {
    expect(isCrewCheckoutSessionMetadata({ product: "crew" })).toBe(true)
    expect(isCrewCheckoutSessionMetadata({ product: "registration" })).toBe(
      false,
    )
    expect(isCrewCheckoutSessionMetadata({})).toBe(false)
  })

  it("validates and parses the Crew metadata contract from completed sessions", () => {
    const completion = parseCrewCheckoutSessionWebhook({
      stripeEventId: "evt_crew_123",
      sessionId: "cs_crew_123",
      metadata: validMetadata,
      amountTotal: 20_000,
      currency: "USD",
      paymentIntentId: "pi_crew_123",
    })

    expect(completion).toEqual({
      stripeEventId: "evt_crew_123",
      sessionId: "cs_crew_123",
      eventId: "event_crew",
      teamId: "team_owner",
      crewPlan: "crew_basic",
      crewEventSettingsId: "crewset_123",
      billingEventId,
      checkoutIdempotencyKey,
      amountCents: 20_000,
      currency: "usd",
      stripePaymentIntentId: "pi_crew_123",
    })
  })

  it("rejects invalid Crew metadata without producing a completion input", () => {
    expect(() =>
      parseCrewCheckoutSessionWebhook({
        stripeEventId: "evt_crew_123",
        sessionId: "cs_crew_123",
        metadata: {
          ...validMetadata,
          eventId: "other_event",
        },
        amountTotal: 20_000,
        currency: "usd",
      }),
    ).toThrow(CrewCheckoutWebhookValidationError)

    expect(() =>
      parseCrewCheckoutSessionWebhook({
        stripeEventId: "evt_crew_123",
        sessionId: "cs_crew_123",
        metadata: {
          ...validMetadata,
          crewPlan: "crew_founding_2026",
        },
        amountTotal: 20_000,
        currency: "usd",
      }),
    ).toThrow(/invalid Crew plan/)

    expect(() =>
      parseCrewCheckoutSessionWebhook({
        stripeEventId: "evt_crew_123",
        sessionId: "cs_crew_123",
        metadata: validMetadata,
        amountTotal: 19_999,
        currency: "usd",
      }),
    ).toThrow(/idempotency metadata/)

    expect(() =>
      parseCrewCheckoutSessionWebhook({
        stripeEventId: "evt_crew_123",
        sessionId: "cs_crew_123",
        metadata: validMetadata,
        amountTotal: 20_000,
        currency: "usdollars",
      }),
    ).toThrow(/currency/)
  })

  it("plans Checkout completion as a paid event-level Crew audit row", () => {
    const completion = parseCrewCheckoutSessionWebhook({
      stripeEventId: "evt_crew_123",
      sessionId: "cs_crew_123",
      metadata: validMetadata,
      amountTotal: 20_000,
      currency: "usd",
      paymentIntentId: "pi_crew_123",
    })

    const plan = planCrewCheckoutWebhookCompletion({
      current: pendingBilling,
      existingEvents: [],
      completion,
    })

    expect(plan.action).toBe("append")
    if (plan.action !== "append") throw new Error("Expected append plan")
    expect(plan.appendPlan.event).toMatchObject({
      competitionId: "event_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
      billingState: CREW_BILLING_STATE.PAID,
      billingSource: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
      planId: "crew_basic",
      amountCents: 20_000,
      currency: "usd",
      stripeCheckoutSessionId: "cs_crew_123",
      stripePaymentIntentId: "pi_crew_123",
      idempotencyKey:
        getCrewCheckoutSessionCompletionIdempotencyKey("cs_crew_123"),
      privateMetadata: {
        stripeEventId: "evt_crew_123",
        billingEventId,
        checkoutIdempotencyKey,
      },
    })
    expect(plan.appendPlan.settingsPatch).toMatchObject({
      crewBillingState: CREW_BILLING_STATE.PAID,
      crewBillingSource: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
      crewBillingPlanId: "crew_basic",
      crewBillingAmountCents: 20_000,
      crewBillingCurrency: "usd",
      crewStripeCheckoutSessionId: "cs_crew_123",
      crewStripePaymentIntentId: "pi_crew_123",
    })
    expect(plan.appendPlan.settingsPatch).not.toHaveProperty("currentPlanId")
  })

  it("dedupes completion by Stripe event ID and Checkout Session ID", () => {
    const completion = parseCrewCheckoutSessionWebhook({
      stripeEventId: "evt_crew_123",
      sessionId: "cs_crew_123",
      metadata: validMetadata,
      amountTotal: 20_000,
      currency: "usd",
    })

    expect(
      planCrewCheckoutWebhookCompletion({
        current: pendingBilling,
        existingEvents: [
          {
            eventType: CREW_BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
            idempotencyKey: null,
            privateMetadata: { stripeEventId: "evt_crew_123" },
          },
        ],
        completion,
      }).action,
    ).toBe("skip_duplicate")

    expect(
      planCrewCheckoutWebhookCompletion({
        current: pendingBilling,
        existingEvents: [
          {
            eventType: CREW_BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
            idempotencyKey:
              getCrewCheckoutStripeEventIdempotencyKey("evt_crew_123"),
          },
        ],
        completion,
      }).action,
    ).toBe("skip_duplicate")

    expect(
      planCrewCheckoutWebhookCompletion({
        current: pendingBilling,
        existingEvents: [
          {
            eventType: CREW_BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
            idempotencyKey:
              getCrewCheckoutSessionCompletionIdempotencyKey("cs_crew_123"),
          },
        ],
        completion,
      }).action,
    ).toBe("skip_duplicate")

    expect(
      planCrewCheckoutWebhookCompletion({
        current: pendingBilling,
        existingEvents: [
          {
            eventType: CREW_BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
            idempotencyKey: null,
            stripeCheckoutSessionId: "cs_crew_123",
          },
        ],
        completion,
      }).action,
    ).toBe("skip_duplicate")
  })

  it("fails safely when completed metadata does not match pending state", () => {
    const completion = parseCrewCheckoutSessionWebhook({
      stripeEventId: "evt_crew_123",
      sessionId: "cs_crew_123",
      metadata: validMetadata,
      amountTotal: 20_000,
      currency: "usd",
    })

    expect(() =>
      planCrewCheckoutWebhookCompletion({
        current: {
          ...pendingBilling,
          state: CREW_BILLING_STATE.UNPAID,
          source: null,
        },
        existingEvents: [],
        completion,
      }),
    ).toThrow(/pending Stripe Checkout/)

    expect(() =>
      planCrewCheckoutWebhookCompletion({
        current: {
          ...pendingBilling,
          planId: "crew_pro",
        },
        existingEvents: [],
        completion,
      }),
    ).toThrow(/plan/)

    expect(() =>
      planCrewCheckoutWebhookCompletion({
        current: {
          ...pendingBilling,
          stripe: {
            ...pendingBilling.stripe,
            checkoutSessionId: "cs_other",
          },
        },
        existingEvents: [],
        completion,
      }),
    ).toThrow(/session/)
  })
})
