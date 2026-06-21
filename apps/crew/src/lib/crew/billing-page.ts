// @lat: [[crew#Billing Page And Upgrade CTA]]
import {
  CREW_BILLING_SOURCE,
  CREW_BILLING_STATE,
  type CrewBillingSource,
  type CrewBillingState,
} from "../../db/schemas/crew-event-settings"
import {
  resolveCrewBillingEntitlements,
  type CrewBillingPlanId,
  type CrewBillingStateSnapshot,
} from "./billing-state"

export interface CrewBillingPageEventAccess {
  organizingTeamId: string
  competitionTeamId: string | null
}

export interface CrewBillingPageTeamAccess {
  id: string
  permissions: string[]
}

export interface CanViewCrewBillingPageInput {
  isLocalCrewOperator: boolean
  isSiteAdmin: boolean
  teams: CrewBillingPageTeamAccess[]
  event: CrewBillingPageEventAccess
  billingPermission: string
}

export interface CrewBillingPaymentLinkInput {
  id: string | null
  url: string | null
}

export interface CrewBillingPageViewModelInput {
  billing: CrewBillingStateSnapshot
  paymentLink: CrewBillingPaymentLinkInput
  checkoutEnabled: boolean
}

export interface CrewBillingActionViewModel {
  label: string
  status: "available" | "disabled" | "hidden"
  href: string | null
  helperText: string
}

export interface CrewBillingPageViewModel {
  plan: {
    id: CrewBillingPlanId | null
    label: string
    hasCrewEventAccess: boolean
    accessReason: ReturnType<typeof resolveCrewBillingEntitlements>["reason"]
  }
  billing: {
    state: CrewBillingState
    stateLabel: string
    source: CrewBillingSource | null
    sourceLabel: string
    amountLabel: string
    upgradeCreditLabel: string
    refundedLabel: string
    fulfillmentLabel: string
  }
  upgradeCta: {
    visible: boolean
    title: string
    description: string
  }
  paymentLink: CrewBillingActionViewModel
  checkout: CrewBillingActionViewModel
}

const planLabels: Record<CrewBillingPlanId, string> = {
  crew_starter: "Crew Starter",
  crew_basic: "Crew Basic",
  crew_pro: "Crew Pro",
  crew_concierge: "Crew Concierge",
  crew_founding_2026: "Founding Crew grant",
}

const billingStateLabels: Record<CrewBillingState, string> = {
  [CREW_BILLING_STATE.UNPAID]: "Unpaid",
  [CREW_BILLING_STATE.PENDING]: "Pending",
  [CREW_BILLING_STATE.PAID]: "Paid",
  [CREW_BILLING_STATE.COMPED]: "Comped",
  [CREW_BILLING_STATE.CREDITED]: "Credit available",
  [CREW_BILLING_STATE.REFUNDED]: "Refunded",
}

const billingSourceLabels: Record<CrewBillingSource, string> = {
  [CREW_BILLING_SOURCE.MANUAL_SALES]: "Manual sale",
  [CREW_BILLING_SOURCE.PAYMENT_LINK]: "Payment Link",
  [CREW_BILLING_SOURCE.STRIPE_CHECKOUT]: "Checkout",
  [CREW_BILLING_SOURCE.FOUNDER_OVERRIDE]: "Founder grant",
  [CREW_BILLING_SOURCE.CREW_CREDIT]: "Crew credit",
  [CREW_BILLING_SOURCE.COMP]: "Comp",
}

export function canViewCrewBillingPage({
  isLocalCrewOperator,
  isSiteAdmin,
  teams,
  event,
  billingPermission,
}: CanViewCrewBillingPageInput) {
  if (isLocalCrewOperator || isSiteAdmin) return true

  return teams.some(
    (team) =>
      team.id === event.organizingTeamId &&
      team.permissions.includes(billingPermission),
  )
}

export function buildCrewBillingPageViewModel({
  billing,
  paymentLink,
  checkoutEnabled,
}: CrewBillingPageViewModelInput): CrewBillingPageViewModel {
  const entitlements = resolveCrewBillingEntitlements(billing)
  const planLabel = billing.planId ? planLabels[billing.planId] : "No plan"
  const amountLabel = isPrivateFounderBilling(billing)
    ? "Private founder grant amount"
    : billing.amountCents > 0
      ? formatMoney(billing.amountCents, billing.currency)
      : "No event charge recorded"
  const upgradeCreditLabel =
    billing.fullPlatformCreditCents > 0
      ? formatMoney(billing.fullPlatformCreditCents, billing.currency)
      : "No upgrade credit recorded"
  const refundedLabel =
    billing.refundedCents > 0
      ? formatMoney(billing.refundedCents, billing.currency)
      : "No refund recorded"

  return {
    plan: {
      id: billing.planId,
      label: planLabel,
      hasCrewEventAccess: entitlements.hasCrewEventAccess,
      accessReason: entitlements.reason,
    },
    billing: {
      state: billing.state,
      stateLabel: billingStateLabels[billing.state],
      source: billing.source,
      sourceLabel: billing.source
        ? billingSourceLabels[billing.source]
        : "Not recorded",
      amountLabel,
      upgradeCreditLabel,
      refundedLabel,
      fulfillmentLabel: getFulfillmentLabel(billing),
    },
    upgradeCta: buildUpgradeCta(billing),
    paymentLink: buildPaymentLinkAction(paymentLink),
    checkout: buildCheckoutAction(checkoutEnabled),
  }
}

function buildUpgradeCta(billing: CrewBillingStateSnapshot) {
  const paidOrComped =
    billing.state === CREW_BILLING_STATE.PAID ||
    billing.state === CREW_BILLING_STATE.COMPED
  const visible = !paidOrComped || billing.fullPlatformCreditCents > 0

  return {
    visible,
    title: visible ? "Upgrade this event" : "Crew access is active",
    description:
      billing.fullPlatformCreditCents > 0
        ? "Use the recorded full-platform credit when this organizer is ready to move beyond one-event Crew."
        : "Upgrade unlocks the paid Crew event plan for this competition without changing the team's subscription plan.",
  }
}

function isPrivateFounderBilling(billing: CrewBillingStateSnapshot) {
  return (
    billing.founderOverride ||
    billing.source === CREW_BILLING_SOURCE.FOUNDER_OVERRIDE ||
    billing.planId === "crew_founding_2026"
  )
}

function buildPaymentLinkAction(
  paymentLink: CrewBillingPaymentLinkInput,
): CrewBillingActionViewModel {
  if (paymentLink.url) {
    return {
      label: "Open Payment Link",
      status: "available",
      href: paymentLink.url,
      helperText:
        "This uses an already configured Payment Link URL for the event.",
    }
  }

  return {
    label: "Payment Link unavailable",
    status: "disabled",
    href: null,
    helperText: paymentLink.id
      ? "A Payment Link reference exists, but no organizer-safe URL is configured yet."
      : "Payment Link recording is deferred to the next billing source-plan slice.",
  }
}

function buildCheckoutAction(
  checkoutEnabled: boolean,
): CrewBillingActionViewModel {
  if (!checkoutEnabled) {
    return {
      label: "Checkout unavailable",
      status: "hidden",
      href: null,
      helperText: "Checkout is not enabled for Crew billing yet.",
    }
  }

  return {
    label: "Checkout coming soon",
    status: "disabled",
    href: null,
    helperText:
      "Checkout is enabled, but session creation is intentionally deferred from this slice.",
  }
}

function getFulfillmentLabel(billing: CrewBillingStateSnapshot) {
  if (billing.state === CREW_BILLING_STATE.COMPED) return "Comped event"
  if (billing.state === CREW_BILLING_STATE.REFUNDED) return "Refund recorded"
  if (billing.source === CREW_BILLING_SOURCE.FOUNDER_OVERRIDE) {
    return "Founder grant"
  }
  if (billing.source === CREW_BILLING_SOURCE.MANUAL_SALES) {
    return "Manual sale"
  }
  if (billing.source === CREW_BILLING_SOURCE.PAYMENT_LINK) {
    return "Payment Link"
  }
  if (billing.source === CREW_BILLING_SOURCE.STRIPE_CHECKOUT) {
    return "Checkout"
  }
  if (billing.source === CREW_BILLING_SOURCE.CREW_CREDIT) {
    return "Crew credit"
  }
  return "Awaiting payment"
}

function formatMoney(cents: number, currency: string) {
  const amount = cents / 100
  const normalizedCurrency = currency.trim().toUpperCase() || "USD"

  try {
    return formatCurrencyWithIntl(amount, normalizedCurrency)
  } catch {
    try {
      return formatCurrencyWithIntl(amount, "USD")
    } catch {
      return `$${amount.toFixed(2)}`
    }
  }
}

function formatCurrencyWithIntl(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount)
}
