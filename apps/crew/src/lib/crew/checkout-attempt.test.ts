import { describe, expect, it } from "vitest"
import {
  canRetryCrewCheckoutCreation,
  readCrewCheckoutAttempt,
} from "./checkout-attempt"
import {
  buildCrewCheckoutBillingEventId,
  buildCrewCheckoutIdempotencyKey,
} from "./checkout-sessions"
import { parseCrewCheckoutSessionWebhook } from "./checkout-webhooks"

const attempt = {
  id: "attempt-1",
  createdAt: 1_780_000_000_000,
  eventName: "Test event",
  appUrl: "https://crew.example.com",
  plan: {
    id: "crew_basic" as const,
    name: "Crew Event",
    description: null,
    price: 20000,
    currency: "usd",
  },
}

// @lat: [[crew#Crew Checkout Recovery]]
describe("durable Crew checkout attempts", () => {
  it("keeps retry parameters and existing event settings intact", () => {
    const text = JSON.stringify({
      setup: { note: "Keep me" },
      checkoutAttempt: attempt,
    })
    expect(readCrewCheckoutAttempt(text)).toEqual(attempt)
    expect(JSON.parse(text).setup.note).toBe("Keep me")
  })

  it("stops an uncertain create before Stripe may discard its idempotency key", () => {
    expect(
      canRetryCrewCheckoutCreation(attempt, attempt.createdAt + 22 * 3600_000),
    ).toBe(true)
    expect(
      canRetryCrewCheckoutCreation(attempt, attempt.createdAt + 23 * 3600_000),
    ).toBe(false)
  })

  it("rejects corrupt settings rather than overwriting the event", () => {
    expect(() => readCrewCheckoutAttempt("not json")).toThrow()
    expect(() => readCrewCheckoutAttempt("[]")).toThrow()
    expect(() =>
      readCrewCheckoutAttempt('{"checkoutAttempt":{"id":"incomplete"}}'),
    ).toThrow()
  })

  it("gives a new attempt a new Stripe key and validates its webhook metadata", () => {
    const scope = {
      competitionId: "event-1",
      teamId: "team-1",
      crewPlan: "crew_basic" as const,
      amountCents: 20000,
    }
    const key = buildCrewCheckoutIdempotencyKey({
      ...scope,
      checkoutAttemptId: attempt.id,
    })
    expect(key).not.toBe(
      buildCrewCheckoutIdempotencyKey({
        ...scope,
        checkoutAttemptId: "attempt-2",
      }),
    )
    const webhook = {
      stripeEventId: "evt-1",
      sessionId: "cs-1",
      amountTotal: 20000,
      currency: "usd",
      metadata: {
        product: "crew",
        competitionId: scope.competitionId,
        teamId: scope.teamId,
        crewPlan: scope.crewPlan,
        crewEventSettingsId: "settings-1",
        checkoutAttemptId: attempt.id,
        checkoutIdempotencyKey: key,
        billingEventId: buildCrewCheckoutBillingEventId(key),
      },
    }
    expect(
      parseCrewCheckoutSessionWebhook(webhook).checkoutIdempotencyKey,
    ).toBe(key)
    expect(() =>
      parseCrewCheckoutSessionWebhook({
        ...webhook,
        metadata: { ...webhook.metadata, checkoutAttemptId: "wrong" },
      }),
    ).toThrow(/idempotency/)
  })
})
