// @lat: [[crew#Crew Billing State And Audit]]
import {
  CREW_BILLING_EVENT_TYPE,
  type CrewBillingEventType,
} from "../../db/schemas/crew-billing-events"
import {
  CREW_BILLING_SOURCE,
  CREW_BILLING_STATE,
  type CrewBillingSource,
  type CrewBillingState,
} from "../../db/schemas/crew-event-settings"

export const crewBillingPlanIds = [
  "crew_starter",
  "crew_basic",
  "crew_pro",
  "crew_concierge",
  "crew_founding_2026",
] as const

export type CrewBillingPlanId = (typeof crewBillingPlanIds)[number]

export interface CrewBillingStripeRefs {
  paymentLinkId: string | null
  checkoutSessionId: string | null
  paymentIntentId: string | null
}

export interface CrewBillingStateSnapshot {
  state: CrewBillingState
  source: CrewBillingSource | null
  planId: CrewBillingPlanId | null
  amountCents: number
  currency: string
  stripe: CrewBillingStripeRefs
  founderOverride: boolean
  creditCents: number
  refundedCents: number
}

export interface BuildCrewBillingEventInput {
  competitionId: string
  teamId: string
  eventType: CrewBillingEventType
  current?: Partial<CrewBillingStateSnapshot>
  planId?: string | null
  amountCents?: number | null
  currency?: string | null
  creditCents?: number | null
  refundedCents?: number | null
  stripePaymentLinkId?: string | null
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  idempotencyKey?: string | null
  actorUserId?: string | null
  actorLabel?: string | null
  publicNote?: string | null
  privateMetadata?: Record<string, unknown> | null
}

export interface CrewBillingAuditEvent {
  competitionId: string
  teamId: string
  eventType: CrewBillingEventType
  billingState: CrewBillingState
  billingSource: CrewBillingSource
  planId: CrewBillingPlanId | null
  amountCents: number
  currency: string
  creditCents: number
  refundedCents: number
  stripePaymentLinkId: string | null
  stripeCheckoutSessionId: string | null
  stripePaymentIntentId: string | null
  idempotencyKey: string | null
  actorUserId: string | null
  actorLabel: string | null
  publicNote: string | null
  privateMetadata: Record<string, unknown> | null
}

export type CrewBillingAppendPlan =
  | {
      action: "append"
      event: CrewBillingAuditEvent
      settingsPatch: CrewBillingSettingsPatch
    }
  | {
      action: "skip_duplicate"
      event: CrewBillingAuditEvent
      settingsPatch: null
    }

export interface CrewBillingSettingsPatch {
  crewBillingState: CrewBillingState
  crewBillingSource: CrewBillingSource
  crewBillingPlanId: CrewBillingPlanId | null
  crewBillingAmountCents: number
  crewBillingCurrency: string
  crewStripePaymentLinkId: string | null
  crewStripeCheckoutSessionId: string | null
  crewStripePaymentIntentId: string | null
  crewFounderOverride: boolean
  crewCreditCents: number
  crewRefundedCents: number
}

const eventDefaults: Record<
  CrewBillingEventType,
  { state: CrewBillingState; source: CrewBillingSource }
> = {
  [CREW_BILLING_EVENT_TYPE.MANUAL_SALE_RECORDED]: {
    state: CREW_BILLING_STATE.PAID,
    source: CREW_BILLING_SOURCE.MANUAL_SALES,
  },
  [CREW_BILLING_EVENT_TYPE.PAYMENT_LINK_RECONCILED]: {
    state: CREW_BILLING_STATE.PAID,
    source: CREW_BILLING_SOURCE.PAYMENT_LINK,
  },
  [CREW_BILLING_EVENT_TYPE.CHECKOUT_COMPLETED]: {
    state: CREW_BILLING_STATE.PAID,
    source: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
  },
  [CREW_BILLING_EVENT_TYPE.FOUNDER_OVERRIDE_APPLIED]: {
    state: CREW_BILLING_STATE.PAID,
    source: CREW_BILLING_SOURCE.FOUNDER_OVERRIDE,
  },
  [CREW_BILLING_EVENT_TYPE.CREDIT_SET]: {
    state: CREW_BILLING_STATE.CREDITED,
    source: CREW_BILLING_SOURCE.CREW_CREDIT,
  },
  [CREW_BILLING_EVENT_TYPE.CREDIT_APPLIED]: {
    state: CREW_BILLING_STATE.PAID,
    source: CREW_BILLING_SOURCE.CREW_CREDIT,
  },
  [CREW_BILLING_EVENT_TYPE.REFUND_RECORDED]: {
    state: CREW_BILLING_STATE.REFUNDED,
    source: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
  },
  [CREW_BILLING_EVENT_TYPE.EVENT_COMPED]: {
    state: CREW_BILLING_STATE.COMPED,
    source: CREW_BILLING_SOURCE.COMP,
  },
}

export function normalizeCrewBillingState(
  input: Partial<CrewBillingStateSnapshot> = {},
): CrewBillingStateSnapshot {
  return {
    state: normalizeBillingState(input.state),
    source: input.source ? normalizeBillingSource(input.source) : null,
    planId: normalizeCrewBillingPlanId(input.planId),
    amountCents: normalizeCents(input.amountCents),
    currency: normalizeCurrency(input.currency),
    stripe: {
      paymentLinkId: normalizeOptionalText(input.stripe?.paymentLinkId),
      checkoutSessionId: normalizeOptionalText(input.stripe?.checkoutSessionId),
      paymentIntentId: normalizeOptionalText(input.stripe?.paymentIntentId),
    },
    founderOverride: input.founderOverride === true,
    creditCents: normalizeCents(input.creditCents),
    refundedCents: normalizeCents(input.refundedCents),
  }
}

export function buildCrewBillingAuditEvent(
  input: BuildCrewBillingEventInput,
): CrewBillingAuditEvent {
  const current = normalizeCrewBillingState(input.current)
  const defaults = eventDefaults[input.eventType]
  const stripe = {
    paymentLinkId:
      normalizeOptionalText(input.stripePaymentLinkId) ??
      current.stripe.paymentLinkId,
    checkoutSessionId:
      normalizeOptionalText(input.stripeCheckoutSessionId) ??
      current.stripe.checkoutSessionId,
    paymentIntentId:
      normalizeOptionalText(input.stripePaymentIntentId) ??
      current.stripe.paymentIntentId,
  }
  const planId =
    normalizeCrewBillingPlanId(input.planId) ??
    (input.eventType === CREW_BILLING_EVENT_TYPE.FOUNDER_OVERRIDE_APPLIED
      ? "crew_founding_2026"
      : current.planId)

  return {
    competitionId: input.competitionId,
    teamId: input.teamId,
    eventType: input.eventType,
    billingState: defaults.state,
    billingSource: defaults.source,
    planId,
    amountCents:
      input.amountCents === undefined || input.amountCents === null
        ? current.amountCents
        : normalizeCents(input.amountCents),
    currency: normalizeCurrency(input.currency ?? current.currency),
    creditCents:
      input.creditCents === undefined || input.creditCents === null
        ? current.creditCents
        : normalizeCents(input.creditCents),
    refundedCents:
      input.refundedCents === undefined || input.refundedCents === null
        ? current.refundedCents
        : normalizeCents(input.refundedCents),
    stripePaymentLinkId: stripe.paymentLinkId,
    stripeCheckoutSessionId: stripe.checkoutSessionId,
    stripePaymentIntentId: stripe.paymentIntentId,
    idempotencyKey: normalizeOptionalText(input.idempotencyKey),
    actorUserId: normalizeOptionalText(input.actorUserId),
    actorLabel: normalizeOptionalText(input.actorLabel),
    publicNote: normalizeOptionalText(input.publicNote),
    privateMetadata: normalizePrivateMetadata(input.privateMetadata),
  }
}

export function buildCrewBillingSettingsPatch(
  current: Partial<CrewBillingStateSnapshot>,
  event: CrewBillingAuditEvent,
): CrewBillingSettingsPatch {
  const normalized = normalizeCrewBillingState(current)
  const isFounderOverride =
    normalized.founderOverride ||
    event.eventType === CREW_BILLING_EVENT_TYPE.FOUNDER_OVERRIDE_APPLIED

  return {
    crewBillingState: event.billingState,
    crewBillingSource: event.billingSource,
    crewBillingPlanId: event.planId,
    crewBillingAmountCents: event.amountCents,
    crewBillingCurrency: event.currency,
    crewStripePaymentLinkId: event.stripePaymentLinkId,
    crewStripeCheckoutSessionId: event.stripeCheckoutSessionId,
    crewStripePaymentIntentId: event.stripePaymentIntentId,
    crewFounderOverride: isFounderOverride,
    crewCreditCents: event.creditCents,
    crewRefundedCents: event.refundedCents,
  }
}

export function planCrewBillingAuditAppend(
  existingEvents: Array<
    Pick<CrewBillingAuditEvent, "eventType" | "idempotencyKey">
  >,
  input: BuildCrewBillingEventInput,
): CrewBillingAppendPlan {
  const event = buildCrewBillingAuditEvent(input)
  const duplicate =
    event.idempotencyKey !== null &&
    existingEvents.some(
      (existing) =>
        existing.eventType === event.eventType &&
        existing.idempotencyKey === event.idempotencyKey,
    )

  if (duplicate) {
    return {
      action: "skip_duplicate",
      event,
      settingsPatch: null,
    }
  }

  return {
    action: "append",
    event,
    settingsPatch: buildCrewBillingSettingsPatch(input.current ?? {}, event),
  }
}

function normalizeBillingState(state: unknown): CrewBillingState {
  return Object.values(CREW_BILLING_STATE).includes(state as CrewBillingState)
    ? (state as CrewBillingState)
    : CREW_BILLING_STATE.UNPAID
}

function normalizeBillingSource(source: unknown): CrewBillingSource {
  if (
    Object.values(CREW_BILLING_SOURCE).includes(source as CrewBillingSource)
  ) {
    return source as CrewBillingSource
  }
  throw new Error("Invalid Crew billing source")
}

function normalizeCrewBillingPlanId(planId: unknown): CrewBillingPlanId | null {
  const normalized = normalizeOptionalText(planId)
  if (!normalized) return null
  if (crewBillingPlanIds.includes(normalized as CrewBillingPlanId)) {
    return normalized as CrewBillingPlanId
  }
  throw new Error("Invalid Crew billing plan")
}

function normalizeCents(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function normalizeCurrency(value: unknown) {
  const normalized = normalizeOptionalText(value)?.toLowerCase() ?? "usd"
  return /^[a-z]{3}$/.test(normalized) ? normalized : "usd"
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function normalizePrivateMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  return metadata as Record<string, unknown>
}
