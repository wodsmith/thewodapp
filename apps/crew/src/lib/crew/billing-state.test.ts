// @lat: [[crew#Crew Billing State And Audit]]
// @lat: [[crew#Manual Paid And Founder Grants]]
import { describe, expect, it } from "vitest"
import { CREW_BILLING_EVENT_TYPE } from "../../db/schemas/crew-billing-events"
import {
  CREW_BILLING_SOURCE,
  CREW_BILLING_STATE,
} from "../../db/schemas/crew-event-settings"
import {
  MANUAL_CREW_BILLING_ACTION,
  buildCrewBillingAuditEvent,
  buildCrewBillingSettingsPatch,
  getCrewBillingLimit,
  hasCrewBillingFeature,
  isCrewBillingDuplicateEntryError,
  normalizeCrewBillingState,
  planCrewBillingAuditAppend,
  planManualCrewBillingAction,
  resolveCrewBillingEntitlements,
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
      fullPlatformCreditCents: 0,
      refundedCents: 0,
    })
  })

  it("resolves Crew event access and limits from event billing state, not team subscriptions", () => {
    expect(
      resolveCrewBillingEntitlements({
        state: CREW_BILLING_STATE.PAID,
        planId: "crew_basic",
      }),
    ).toMatchObject({
      hasCrewEventAccess: true,
      reason: "active",
      features: [
        "crew_events",
        "crew_imports",
        "crew_confirmation_reminders",
      ],
      limits: {
        max_crew_events: 1,
        max_crew_volunteers_per_event: -1,
        max_crew_email_sends_per_event: 500,
        max_crew_imports_per_event: 5,
      },
    })

    expect(
      hasCrewBillingFeature(
        { state: CREW_BILLING_STATE.COMPED, planId: "crew_starter" },
        "crew_events",
      ),
    ).toBe(true)
    expect(
      getCrewBillingLimit(
        { state: CREW_BILLING_STATE.COMPED, planId: "crew_starter" },
        "max_crew_volunteers_per_event",
      ),
    ).toBe(50)
    expect(
      hasCrewBillingFeature(
        { state: CREW_BILLING_STATE.PAID, planId: "crew_concierge" },
        "crew_concierge",
      ),
    ).toBe(true)
    expect(
      getCrewBillingLimit(
        { state: CREW_BILLING_STATE.PAID, planId: "crew_founding_2026" },
        "max_crew_email_sends_per_event",
      ),
    ).toBe(2000)
    expect(
      resolveCrewBillingEntitlements({
        state: CREW_BILLING_STATE.CREDITED,
        planId: "crew_pro",
      }).hasCrewEventAccess,
    ).toBe(true)
    expect(
      resolveCrewBillingEntitlements({
        state: CREW_BILLING_STATE.REFUNDED,
        planId: "crew_pro",
      }),
    ).toMatchObject({
      hasCrewEventAccess: false,
      reason: "refunded",
      features: [],
      limits: {
        max_crew_events: 0,
        max_crew_volunteers_per_event: 0,
        max_crew_email_sends_per_event: 0,
        max_crew_imports_per_event: 0,
      },
    })
    expect(
      resolveCrewBillingEntitlements({
        state: CREW_BILLING_STATE.UNPAID,
        planId: "crew_pro",
      }).reason,
    ).toBe("unpaid")
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

  it("plans manual paid Concierge unlocks without Stripe or team plan mutation", () => {
    const plan = planManualCrewBillingAction([], {
      action: MANUAL_CREW_BILLING_ACTION.RECORD_MANUAL_PAID,
      competitionId: "comp_crew",
      teamId: "team_owner",
      planId: "crew_concierge",
      amountCents: 300_000,
      actorLabel: "Ops",
      privateMetadata: { invoiceId: "inv_manual_1" },
    })

    expect(plan.action).toBe("append")
    expect(plan.event).toMatchObject({
      competitionId: "comp_crew",
      teamId: "team_owner",
      eventType: CREW_BILLING_EVENT_TYPE.MANUAL_SALE_RECORDED,
      billingState: CREW_BILLING_STATE.PAID,
      billingSource: CREW_BILLING_SOURCE.MANUAL_SALES,
      planId: "crew_concierge",
      amountCents: 300_000,
      stripePaymentLinkId: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
    })
    expect(plan.settingsPatch).not.toHaveProperty("currentPlanId")
    expect(
      hasCrewBillingFeature(
        {
          state: plan.settingsPatch.crewBillingState,
          source: plan.settingsPatch.crewBillingSource,
          planId: plan.settingsPatch.crewBillingPlanId,
        },
        "crew_concierge",
      ),
    ).toBe(true)
  })

  it("rejects manual paid actions without a valid plan and positive amount", () => {
    const validManualPaidInput = {
      action: MANUAL_CREW_BILLING_ACTION.RECORD_MANUAL_PAID,
      competitionId: "comp_crew",
      teamId: "team_owner",
      planId: "crew_basic",
      amountCents: 20_000,
    } as const
    const unsafeManualPaidInput = (overrides: Record<string, unknown>) =>
      ({
        ...validManualPaidInput,
        ...overrides,
      }) as unknown as Parameters<typeof planManualCrewBillingAction>[1]
    const unsafeManualPaidInputWithout = (
      key: "planId" | "amountCents",
    ) => {
      const input = { ...validManualPaidInput } as Record<string, unknown>
      delete input[key]
      return input as unknown as Parameters<typeof planManualCrewBillingAction>[1]
    }

    expect(() =>
      planManualCrewBillingAction(
        [],
        unsafeManualPaidInputWithout("planId"),
      ),
    ).toThrow(/valid Crew plan/)
    expect(() =>
      planManualCrewBillingAction(
        [],
        unsafeManualPaidInput({ planId: "team_pro" }),
      ),
    ).toThrow(/valid Crew plan/)
    expect(() =>
      planManualCrewBillingAction(
        [],
        unsafeManualPaidInputWithout("amountCents"),
      ),
    ).toThrow(/positive amount/)
    expect(() =>
      planManualCrewBillingAction([], {
        ...validManualPaidInput,
        amountCents: 0,
      }),
    ).toThrow(/positive amount/)
    expect(() =>
      planManualCrewBillingAction([], {
        ...validManualPaidInput,
        amountCents: -100,
      }),
    ).toThrow(/positive amount/)
  })

  it("rejects direct manual sale audit appends with incomplete paid purchase data", () => {
    expect(() =>
      planCrewBillingAuditAppend([], {
        competitionId: "comp_crew",
        teamId: "team_owner",
        eventType: CREW_BILLING_EVENT_TYPE.MANUAL_SALE_RECORDED,
        amountCents: 20_000,
      }),
    ).toThrow(/valid Crew plan/)
    expect(() =>
      planCrewBillingAuditAppend([], {
        competitionId: "comp_crew",
        teamId: "team_owner",
        eventType: CREW_BILLING_EVENT_TYPE.MANUAL_SALE_RECORDED,
        planId: "crew_basic",
        amountCents: 0,
      }),
    ).toThrow(/positive amount/)
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

  it("keeps founder grant pricing in server-only audit metadata", () => {
    const plan = planManualCrewBillingAction([], {
      action: MANUAL_CREW_BILLING_ACTION.APPLY_FOUNDER_GRANT,
      competitionId: "comp_founder",
      teamId: "team_owner",
      privateFounderPriceCents: 9900,
      publicNote: "Founder grant applied",
      privateMetadata: {
        approvalNote: "Private launch approval",
      },
    })

    expect(plan.event).toMatchObject({
      eventType: CREW_BILLING_EVENT_TYPE.FOUNDER_OVERRIDE_APPLIED,
      billingState: CREW_BILLING_STATE.PAID,
      billingSource: CREW_BILLING_SOURCE.FOUNDER_OVERRIDE,
      planId: "crew_founding_2026",
      amountCents: 9900,
      publicNote: "Founder grant applied",
      privateMetadata: {
        approvalNote: "Private launch approval",
        founderGrant: {
          privatePriceCents: 9900,
        },
      },
    })
    expect(buildCrewBillingSettingsPatch({}, plan.event)).toMatchObject({
      crewFounderOverride: true,
      crewBillingPlanId: "crew_founding_2026",
    })

    const publicGate = resolveCrewBillingEntitlements({
      state: plan.settingsPatch.crewBillingState,
      source: plan.settingsPatch.crewBillingSource,
      planId: plan.settingsPatch.crewBillingPlanId,
    })
    expect(publicGate).not.toHaveProperty("privateMetadata")
    expect(publicGate).not.toHaveProperty("amountCents")
    expect(publicGate).not.toHaveProperty("stripe")
  })

  it("sets and applies full-platform upgrade credit at most once per event", () => {
    const creditSet = planManualCrewBillingAction([], {
      action: MANUAL_CREW_BILLING_ACTION.SET_FULL_PLATFORM_CREDIT,
      competitionId: "comp_credit",
      teamId: "team_owner",
      current: {
        state: CREW_BILLING_STATE.PAID,
        source: CREW_BILLING_SOURCE.MANUAL_SALES,
        planId: "crew_pro",
        amountCents: 80_000,
      },
      fullPlatformCreditCents: 25_000,
      actorLabel: "Ops",
    })

    expect(creditSet).toMatchObject({
      action: "append",
      event: {
        eventType: CREW_BILLING_EVENT_TYPE.CREDIT_SET,
        billingState: CREW_BILLING_STATE.CREDITED,
        billingSource: CREW_BILLING_SOURCE.CREW_CREDIT,
        planId: "crew_pro",
        creditCents: 25_000,
        idempotencyKey: "full-platform-credit:set",
      },
      settingsPatch: {
        crewCreditCents: 25_000,
        fullPlatformCreditCents: 25_000,
      },
    })

    const duplicateSet = planManualCrewBillingAction([creditSet.event], {
      action: MANUAL_CREW_BILLING_ACTION.SET_FULL_PLATFORM_CREDIT,
      competitionId: "comp_credit",
      teamId: "team_owner",
      current: {
        state: CREW_BILLING_STATE.CREDITED,
        planId: "crew_pro",
        creditCents: 25_000,
        fullPlatformCreditCents: 25_000,
      },
      fullPlatformCreditCents: 25_000,
    })
    expect(duplicateSet).toMatchObject({
      action: "skip_duplicate",
      settingsPatch: null,
    })

    expect(() =>
      planManualCrewBillingAction(
        [
          {
            eventType: CREW_BILLING_EVENT_TYPE.CREDIT_SET,
            idempotencyKey: null,
            creditCents: 25_000,
          },
        ],
        {
          action: MANUAL_CREW_BILLING_ACTION.SET_FULL_PLATFORM_CREDIT,
          competitionId: "comp_credit",
          teamId: "team_owner",
          fullPlatformCreditCents: 25_000,
        },
      ),
    ).toThrow(/already been set or applied/)

    const creditApplied = planManualCrewBillingAction([creditSet.event], {
      action: MANUAL_CREW_BILLING_ACTION.APPLY_FULL_PLATFORM_CREDIT,
      competitionId: "comp_credit",
      teamId: "team_owner",
      current: {
        state: CREW_BILLING_STATE.CREDITED,
        source: CREW_BILLING_SOURCE.CREW_CREDIT,
        planId: "crew_pro",
        amountCents: 80_000,
        creditCents: 25_000,
        fullPlatformCreditCents: 25_000,
      },
    })

    expect(creditApplied).toMatchObject({
      action: "append",
      event: {
        eventType: CREW_BILLING_EVENT_TYPE.CREDIT_APPLIED,
        billingState: CREW_BILLING_STATE.PAID,
        billingSource: CREW_BILLING_SOURCE.CREW_CREDIT,
        creditCents: 25_000,
        idempotencyKey: "full-platform-credit:apply",
      },
    })

    const duplicateApply = planManualCrewBillingAction(
      [creditSet.event, creditApplied.event],
      {
        action: MANUAL_CREW_BILLING_ACTION.APPLY_FULL_PLATFORM_CREDIT,
        competitionId: "comp_credit",
        teamId: "team_owner",
        current: {
          state: CREW_BILLING_STATE.PAID,
          planId: "crew_pro",
          creditCents: 25_000,
          fullPlatformCreditCents: 25_000,
        },
      },
    )
    expect(duplicateApply.action).toBe("skip_duplicate")
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
      planId: "crew_basic",
      amountCents: 20_000,
      publicNote: "Operator correction note.",
    })

    expect(duplicate).toMatchObject({
      action: "skip_duplicate",
      settingsPatch: null,
    })
    expect(manualFollowUp.action).toBe("append")
  })

  it("detects MySQL duplicate entry errors for atomic idempotency handling", () => {
    expect(isCrewBillingDuplicateEntryError({ code: "ER_DUP_ENTRY" })).toBe(
      true,
    )
    expect(isCrewBillingDuplicateEntryError({ errno: 1062 })).toBe(true)
    expect(
      isCrewBillingDuplicateEntryError({
        message:
          "Duplicate entry 'comp:event:key' for key 'crew_billing_events_idempotency_unique_idx'",
      }),
    ).toBe(true)

    expect(
      isCrewBillingDuplicateEntryError({ code: "ER_BAD_FIELD_ERROR" }),
    ).toBe(false)
    expect(isCrewBillingDuplicateEntryError({ sqlState: "23000" })).toBe(false)
    expect(isCrewBillingDuplicateEntryError(new Error("network timeout"))).toBe(
      false,
    )
  })
})
