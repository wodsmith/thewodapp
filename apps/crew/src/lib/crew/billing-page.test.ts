// @lat: [[crew#Billing Page And Upgrade CTA]]
import { describe, expect, it } from "vitest"
import {
  CREW_BILLING_SOURCE,
  CREW_BILLING_STATE,
} from "../../db/schemas/crew-event-settings"
import {
  buildCrewBillingPageViewModel,
  canViewCrewBillingPage,
} from "./billing-page"
import type { CrewBillingStateSnapshot } from "./billing-state"

const baseBilling: CrewBillingStateSnapshot = {
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
}

describe("Crew billing page view model", () => {
  it("shows an upgrade CTA and deferred Payment Link state when no URL exists", () => {
    const viewModel = buildCrewBillingPageViewModel({
      billing: baseBilling,
      paymentLink: { id: null, url: null },
      checkoutEnabled: false,
    })

    expect(viewModel.upgradeCta.visible).toBe(true)
    expect(viewModel.plan.hasCrewEventAccess).toBe(false)
    expect(viewModel.paymentLink).toMatchObject({
      status: "disabled",
      href: null,
      label: "Payment Link unavailable",
    })
    expect(viewModel.paymentLink.helperText).toContain("deferred")
  })

  it("enables a Payment Link button only when an organizer-safe URL exists", () => {
    const viewModel = buildCrewBillingPageViewModel({
      billing: {
        ...baseBilling,
        stripe: {
          ...baseBilling.stripe,
          paymentLinkId: "plink_123",
        },
      },
      paymentLink: {
        id: "plink_123",
        url: "https://buy.stripe.com/test_123",
      },
      checkoutEnabled: false,
    })

    expect(viewModel.paymentLink).toMatchObject({
      status: "available",
      href: "https://buy.stripe.com/test_123",
      label: "Open Payment Link",
    })
  })

  it("keeps Checkout hidden until the Crew checkout flag is enabled", () => {
    const disabled = buildCrewBillingPageViewModel({
      billing: baseBilling,
      paymentLink: { id: null, url: null },
      checkoutEnabled: false,
    })
    const enabled = buildCrewBillingPageViewModel({
      billing: baseBilling,
      paymentLink: { id: null, url: null },
      checkoutEnabled: true,
    })

    expect(disabled.checkout.status).toBe("hidden")
    expect(enabled.checkout).toMatchObject({
      status: "available",
      href: null,
      label: "Start Checkout",
    })
    expect(enabled.checkout.helperText).toContain("Checkout Session")
  })

  it("disables Checkout for pending or private Crew billing states", () => {
    const pending = buildCrewBillingPageViewModel({
      billing: {
        ...baseBilling,
        state: CREW_BILLING_STATE.PENDING,
        source: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
        planId: "crew_basic",
        amountCents: 20_000,
        stripe: {
          ...baseBilling.stripe,
          checkoutSessionId: "cs_pending",
        },
      },
      paymentLink: { id: null, url: null },
      checkoutEnabled: true,
    })
    const privatePlan = buildCrewBillingPageViewModel({
      billing: {
        ...baseBilling,
        planId: "crew_founding_2026",
        amountCents: 9900,
      },
      paymentLink: { id: null, url: null },
      checkoutEnabled: true,
    })

    expect(pending.checkout).toMatchObject({
      status: "disabled",
      label: "Checkout pending",
    })
    expect(privatePlan.checkout).toMatchObject({
      status: "disabled",
      label: "Checkout unavailable",
    })
  })

  it("shows paid manual, comp, refund, and upgrade credit state without team subscription semantics", () => {
    const viewModel = buildCrewBillingPageViewModel({
      billing: {
        ...baseBilling,
        state: CREW_BILLING_STATE.PAID,
        source: CREW_BILLING_SOURCE.MANUAL_SALES,
        planId: "crew_pro",
        amountCents: 49900,
        fullPlatformCreditCents: 25000,
        refundedCents: 5000,
      },
      paymentLink: { id: null, url: null },
      checkoutEnabled: false,
    })

    expect(viewModel.plan.label).toBe("Crew Pro")
    expect(viewModel.plan.hasCrewEventAccess).toBe(true)
    expect(viewModel.billing.sourceLabel).toBe("Manual sale")
    expect(viewModel.billing.amountLabel).toBe("$499.00")
    expect(viewModel.billing.upgradeCreditLabel).toBe("$250.00")
    expect(viewModel.billing.refundedLabel).toBe("$50.00")
    expect(viewModel.upgradeCta.visible).toBe(true)

    const comped = buildCrewBillingPageViewModel({
      billing: {
        ...baseBilling,
        state: CREW_BILLING_STATE.COMPED,
        source: CREW_BILLING_SOURCE.COMP,
        planId: "crew_basic",
      },
      paymentLink: { id: null, url: null },
      checkoutEnabled: false,
    })

    expect(comped.billing.fulfillmentLabel).toBe("Comped event")
    expect(comped.plan.hasCrewEventAccess).toBe(true)
  })

  it("falls back to USD labels instead of throwing for malformed persisted currency", () => {
    const viewModel = buildCrewBillingPageViewModel({
      billing: {
        ...baseBilling,
        state: CREW_BILLING_STATE.PAID,
        source: CREW_BILLING_SOURCE.MANUAL_SALES,
        planId: "crew_pro",
        amountCents: 49900,
        currency: "not a currency",
        fullPlatformCreditCents: 25000,
        refundedCents: 5000,
      },
      paymentLink: { id: null, url: null },
      checkoutEnabled: false,
    })

    expect(viewModel.billing.amountLabel).toBe("$499.00")
    expect(viewModel.billing.upgradeCreditLabel).toBe("$250.00")
    expect(viewModel.billing.refundedLabel).toBe("$50.00")
  })

  it("does not leak founder pricing, Stripe references, audit metadata, or invoices", () => {
    const viewModel = buildCrewBillingPageViewModel({
      billing: {
        ...baseBilling,
        state: CREW_BILLING_STATE.PAID,
        source: CREW_BILLING_SOURCE.FOUNDER_OVERRIDE,
        planId: "crew_founding_2026",
        amountCents: 12345,
        founderOverride: true,
        stripe: {
          paymentLinkId: "plink_private",
          checkoutSessionId: "cs_private",
          paymentIntentId: "pi_private",
        },
      },
      paymentLink: { id: "plink_private", url: null },
      checkoutEnabled: true,
    })

    const serialized = JSON.stringify(viewModel)

    expect(viewModel.billing.amountLabel).toBe("Private founder grant amount")
    expect(serialized).not.toContain("12345")
    expect(serialized).not.toContain("plink_private")
    expect(serialized).not.toContain("cs_private")
    expect(serialized).not.toContain("pi_private")
    expect(serialized).not.toContain("privateMetadata")
    expect(serialized).not.toContain("invoice")
  })
})

describe("Crew billing page access", () => {
  it("allows local operators, site admins, and organizer billing members", () => {
    const event = {
      organizingTeamId: "team_org",
      competitionTeamId: "team_event",
    }

    expect(
      canViewCrewBillingPage({
        isLocalCrewOperator: true,
        isSiteAdmin: false,
        teams: [],
        event,
        billingPermission: "access_billing",
      }),
    ).toBe(true)
    expect(
      canViewCrewBillingPage({
        isLocalCrewOperator: false,
        isSiteAdmin: true,
        teams: [],
        event,
        billingPermission: "access_billing",
      }),
    ).toBe(true)
    expect(
      canViewCrewBillingPage({
        isLocalCrewOperator: false,
        isSiteAdmin: false,
        teams: [{ id: "team_org", permissions: ["access_billing"] }],
        event,
        billingPermission: "access_billing",
      }),
    ).toBe(true)
  })

  it("rejects unrelated teams and competition-event-only members", () => {
    const event = {
      organizingTeamId: "team_org",
      competitionTeamId: "team_event",
    }

    expect(
      canViewCrewBillingPage({
        isLocalCrewOperator: false,
        isSiteAdmin: false,
        teams: [{ id: "team_other", permissions: ["access_billing"] }],
        event,
        billingPermission: "access_billing",
      }),
    ).toBe(false)
    expect(
      canViewCrewBillingPage({
        isLocalCrewOperator: false,
        isSiteAdmin: false,
        teams: [{ id: "team_event", permissions: ["access_billing"] }],
        event,
        billingPermission: "access_billing",
      }),
    ).toBe(false)
  })
})
