// @lat: [[crew#Crew Billing State And Audit]]
import { describe, expect, it } from "vitest"
import { CREW_BILLING_EVENT_TYPE } from "../../db/schemas/crew-billing-events"
import {
  CREW_BILLING_SOURCE,
  CREW_BILLING_STATE,
} from "../../db/schemas/crew-event-settings"
import {
  buildCrewBillingAuditEvent,
  buildCrewBillingSettingsPatch,
  normalizeCrewBillingState,
  planCrewBillingAuditAppend,
} from "./billing-state"

describe("Crew billing state and audit helpers", () => {
  it("normalizes empty billing state without assigning a team subscription plan", () => {
    const state = normalizeCrewBillingState({
      amountCents: -100,
      currency: "USD",
      stripe: {
        paymentLinkId: " ",
        checkoutSessionId: "cs_test_123",
        paymentIntentId: null,
      },
    })

    expect(state).toEqual({
      state: CREW_BILLING_STATE.UNPAID,
      source: null,
      planId: null,
      amountCents: 0,
      currency: "usd",
      stripe: {
        paymentLinkId: null,
        checkoutSessionId: "cs_test_123",
        paymentIntentId: null,
      },
      founderOverride: false,
      creditCents: 0,
      refundedCents: 0,
    })
  })

  it("builds manual sale audit events as event-scoped paid Crew purchases", () => {
    const event = buildCrewBillingAuditEvent({
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.MANUAL_SALE_RECORDED,
      planId: "crew_basic",
      amountCents: 20_000,
      currency: "USD",
      actorLabel: "Ops",
      publicNote: "  paid by invoice  ",
    })

    expect(event).toMatchObject({
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.MANUAL_SALE_RECORDED,
      billingState: CREW_BILLING_STATE.PAID,
      billingSource: CREW_BILLING_SOURCE.MANUAL_SALES,
      planId: "crew_basic",
      amountCents: 20_000,
      currency: "usd",
      actorLabel: "Ops",
      publicNote: "paid by invoice",
    })
  })

  it("keeps Payment Link and checkout Stripe references on the event state", () => {
    const paymentLink = buildCrewBillingAuditEvent({
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.PAYMENT_LINK_RECONCILED,
      planId: "crew_founding_2026",
      amountCents: 9900,
      stripePaymentLinkId: "plink_123",
      stripePaymentIntentId: "pi_123",
    })
    const checkout = buildCrewBillingAuditEvent({
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
      current: {
        planId: "crew_founding_2026",
        amountCents: 9900,
        stripe: {
          paymentLinkId: "plink_123",
          checkoutSessionId: null,
          paymentIntentId: "pi_123",
        },
      },
      stripeCheckoutSessionId: "cs_123",
    })

    expect(paymentLink).toMatchObject({
      billingSource: CREW_BILLING_SOURCE.PAYMENT_LINK,
      stripePaymentLinkId: "plink_123",
      stripePaymentIntentId: "pi_123",
    })
    expect(buildCrewBillingSettingsPatch({}, checkout)).toMatchObject({
      crewBillingState: CREW_BILLING_STATE.PAID,
      crewBillingSource: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
      crewBillingPlanId: "crew_founding_2026",
      crewStripePaymentLinkId: "plink_123",
      crewStripeCheckoutSessionId: "cs_123",
      crewStripePaymentIntentId: "pi_123",
    })
  })

  it("stores founder and credit details in private audit metadata", () => {
    const founder = buildCrewBillingAuditEvent({
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.FOUNDER_OVERRIDE_APPLIED,
      amountCents: 9900,
      privateMetadata: {
        founderEmail: "founder@example.com",
        approvalNote: "Private launch approval",
      },
    })
    const credit = buildCrewBillingAuditEvent({
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.CREDIT_SET,
      current: {
        planId: "crew_founding_2026",
        amountCents: 9900,
        founderOverride: true,
      },
      creditCents: 25_000,
      privateMetadata: {
        creditReason: "Migrated from concierge pilot.",
      },
    })

    expect(founder).toMatchObject({
      billingSource: CREW_BILLING_SOURCE.FOUNDER_OVERRIDE,
      planId: "crew_founding_2026",
      privateMetadata: {
        founderEmail: "founder@example.com",
        approvalNote: "Private launch approval",
      },
    })
    expect(buildCrewBillingSettingsPatch({}, founder)).toMatchObject({
      crewFounderOverride: true,
    })
    expect(credit).toMatchObject({
      billingState: CREW_BILLING_STATE.CREDITED,
      billingSource: CREW_BILLING_SOURCE.CREW_CREDIT,
      creditCents: 25_000,
      privateMetadata: {
        creditReason: "Migrated from concierge pilot.",
      },
    })
  })

  it("records comped and refunded terminal states without mutating audit history", () => {
    const comped = buildCrewBillingAuditEvent({
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.EVENT_COMPED,
      planId: "crew_starter",
      amountCents: 0,
    })
    const refund = buildCrewBillingAuditEvent({
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.REFUND_RECORDED,
      current: {
        state: CREW_BILLING_STATE.COMPED,
        source: CREW_BILLING_SOURCE.COMP,
        planId: "crew_starter",
      },
      refundedCents: 20_000,
      stripePaymentIntentId: "pi_refunded",
    })

    expect(comped.billingState).toBe(CREW_BILLING_STATE.COMPED)
    expect(refund).toMatchObject({
      billingState: CREW_BILLING_STATE.REFUNDED,
      refundedCents: 20_000,
      stripePaymentIntentId: "pi_refunded",
    })
  })

  it("dedupes idempotent reconciliation events while allowing append-only manual notes", () => {
    const first = planCrewBillingAuditAppend([], {
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.PAYMENT_LINK_RECONCILED,
      idempotencyKey: "plink_123:pi_123",
      stripePaymentLinkId: "plink_123",
      stripePaymentIntentId: "pi_123",
    })

    expect(first.action).toBe("append")

    const duplicate = planCrewBillingAuditAppend([first.event], {
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.PAYMENT_LINK_RECONCILED,
      idempotencyKey: "plink_123:pi_123",
      stripePaymentLinkId: "plink_123",
      stripePaymentIntentId: "pi_123",
    })
    const manualFollowUp = planCrewBillingAuditAppend([first.event], {
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.MANUAL_SALE_RECORDED,
      publicNote: "Operator correction note.",
    })

    expect(duplicate).toMatchObject({
      action: "skip_duplicate",
      settingsPatch: null,
    })
    expect(manualFollowUp.action).toBe("append")
  })
})
