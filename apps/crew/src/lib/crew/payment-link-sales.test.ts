// @lat: [[crew#Stripe Payment Link Sales]]
import { describe, expect, it } from "vitest"
import {
  buildCrewPaymentLinkSaleActionInput,
  buildCrewPaymentLinkSaleIdempotencyKey,
  getCrewPaymentLinkUrlFromSettings,
  normalizeCrewPaymentLinkReference,
  serializeCrewPaymentLinkSettings,
} from "./payment-link-sales"

describe("Crew Payment Link sales helpers", () => {
  it("normalizes Payment Link references and safe organizer URLs", () => {
    expect(
      normalizeCrewPaymentLinkReference({
        paymentLinkReference: "  plink_123  ",
        paymentLinkUrl: " https://buy.stripe.com/test_123 ",
      }),
    ).toEqual({
      reference: "plink_123",
      url: "https://buy.stripe.com/test_123",
    })

    expect(
      normalizeCrewPaymentLinkReference({
        paymentLinkReference: "https://buy.stripe.com/test_from_reference",
      }),
    ).toEqual({
      reference: null,
      url: "https://buy.stripe.com/test_from_reference",
    })

    expect(
      normalizeCrewPaymentLinkReference({
        paymentLinkReference: "plink_123",
        paymentLinkUrl: "javascript:alert(1)",
      }),
    ).toEqual({
      reference: "plink_123",
      url: null,
    })
  })

  it("records safe Payment Link URL state in settings without replacing existing Crew settings", () => {
    const settingsText = serializeCrewPaymentLinkSettings(
      JSON.stringify({
        setup: { assumptions: "Keep this" },
        crewBilling: { existing: true },
      }),
      {
        paymentLinkReference: "plink_abc",
        paymentLinkUrl: "https://buy.stripe.com/live_abc",
      },
    )
    const parsed = JSON.parse(settingsText ?? "{}")

    expect(parsed).toMatchObject({
      setup: { assumptions: "Keep this" },
      crewBilling: {
        existing: true,
        paymentLinkReference: "plink_abc",
        paymentLinkUrl: "https://buy.stripe.com/live_abc",
      },
    })
    expect(getCrewPaymentLinkUrlFromSettings(settingsText)).toBe(
      "https://buy.stripe.com/live_abc",
    )
  })

  it("preserves invalid legacy settings text while adding Payment Link URL state", () => {
    const settingsText = serializeCrewPaymentLinkSettings("{not json", {
      paymentLinkUrl: "https://buy.stripe.com/live_legacy",
    })
    const parsed = JSON.parse(settingsText ?? "{}")

    expect(parsed).toMatchObject({
      legacySettingsText: "{not json",
      crewBilling: {
        paymentLinkUrl: "https://buy.stripe.com/live_legacy",
      },
    })
  })

  it("builds scoped reconciliation action input from the server event/team scope", () => {
    const action = buildCrewPaymentLinkSaleActionInput({
      eventId: "comp_scope",
      organizingTeamId: "team_scope",
      planId: "crew_pro",
      amountCents: 49_900,
      currency: "USD",
      paymentLinkReference: "plink_scope",
      paymentLinkUrl: "https://buy.stripe.com/scope",
      stripePaymentIntentId: "pi_scope",
      actorLabel: "Ops",
      privateMetadata: { adminNote: "matched from Stripe dashboard" },
    })

    expect(action).toMatchObject({
      action: "reconcile_payment_link_sale",
      competitionId: "comp_scope",
      teamId: "team_scope",
      planId: "crew_pro",
      amountCents: 49_900,
      currency: "USD",
      stripePaymentLinkId: "plink_scope",
      stripePaymentIntentId: "pi_scope",
      idempotencyKey: "payment-link:plink_scope:pi_scope",
      actorLabel: "Ops",
      privateMetadata: { adminNote: "matched from Stripe dashboard" },
    })
    expect(action).not.toHaveProperty("currentPlanId")
  })

  it("supports missing Stripe metadata with a stable manual idempotency key", () => {
    const action = buildCrewPaymentLinkSaleActionInput({
      eventId: "comp_missing_metadata",
      organizingTeamId: "team_scope",
      planId: "crew_basic",
      amountCents: 20_000,
      currency: "USD",
    })

    expect(action).toMatchObject({
      action: "reconcile_payment_link_sale",
      competitionId: "comp_missing_metadata",
      teamId: "team_scope",
      stripePaymentLinkId: null,
      stripePaymentIntentId: undefined,
      idempotencyKey:
        "payment-link:manual:comp_missing_metadata:team_scope:crew_basic:20000:usd",
    })
  })

  it("preserves an existing Payment Link reference when reconciling missing metadata", () => {
    const action = buildCrewPaymentLinkSaleActionInput({
      eventId: "comp_existing_reference",
      organizingTeamId: "team_scope",
      planId: "crew_basic",
      amountCents: 20_000,
      currency: "USD",
      current: {
        stripe: {
          paymentLinkId: "plink_existing",
          checkoutSessionId: null,
          paymentIntentId: null,
        },
      },
    })

    expect(action).toMatchObject({
      action: "reconcile_payment_link_sale",
      competitionId: "comp_existing_reference",
      teamId: "team_scope",
      stripePaymentLinkId: "plink_existing",
      idempotencyKey: "payment-link:plink_existing:missing-payment-intent",
      current: {
        stripe: {
          paymentLinkId: "plink_existing",
        },
      },
    })
  })

  it("prefers an admin-provided idempotency key when reconciling manually", () => {
    expect(
      buildCrewPaymentLinkSaleIdempotencyKey({
        eventId: "comp_crew",
        organizingTeamId: "team_owner",
        planId: "crew_basic",
        amountCents: 20_000,
        currency: "usd",
        paymentLinkReference: "plink_123",
        idempotencyKey: " manual-key ",
      }),
    ).toBe("manual-key")
  })
})
