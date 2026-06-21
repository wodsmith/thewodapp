// @lat: [[crew#Crew Billing State And Audit]]
// @lat: [[crew#Manual Paid And Founder Grants]]
// @lat: [[crew#Stripe Payment Link Sales]]
// @lat: [[crew#Crew Checkout Sessions]]
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

export const crewBillingFeatureKeys = [
  "crew_events",
  "crew_imports",
  "crew_confirmation_reminders",
  "crew_department_leads",
  "crew_exports",
  "crew_concierge",
] as const

export type CrewBillingFeatureKey = (typeof crewBillingFeatureKeys)[number]

export const crewBillingLimitKeys = [
  "max_crew_events",
  "max_crew_volunteers_per_event",
  "max_crew_email_sends_per_event",
  "max_crew_imports_per_event",
] as const

export type CrewBillingLimitKey = (typeof crewBillingLimitKeys)[number]

export const MANUAL_CREW_BILLING_ACTION = {
  RECORD_MANUAL_PAID: "record_manual_paid",
  RECONCILE_PAYMENT_LINK_SALE: "reconcile_payment_link_sale",
  APPLY_FOUNDER_GRANT: "apply_founder_grant",
  SET_FULL_PLATFORM_CREDIT: "set_full_platform_credit",
  APPLY_FULL_PLATFORM_CREDIT: "apply_full_platform_credit",
  COMP_EVENT: "comp_event",
  RECORD_REFUND: "record_refund",
} as const

export type ManualCrewBillingActionType =
  (typeof MANUAL_CREW_BILLING_ACTION)[keyof typeof MANUAL_CREW_BILLING_ACTION]

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
  fullPlatformCreditCents: number
  refundedCents: number
}

export interface BuildCrewBillingEventInput {
  id?: string | null
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

interface BasePlanManualCrewBillingActionInput
  extends Omit<BuildCrewBillingEventInput, "eventType" | "creditCents"> {
  action: ManualCrewBillingActionType
  fullPlatformCreditCents?: number | null
  privateFounderPriceCents?: number | null
}

export type PlanManualCrewBillingActionInput =
  | (BasePlanManualCrewBillingActionInput & {
      action: typeof MANUAL_CREW_BILLING_ACTION.RECORD_MANUAL_PAID
      planId: CrewBillingPlanId
      amountCents: number
    })
  | (BasePlanManualCrewBillingActionInput & {
      action: typeof MANUAL_CREW_BILLING_ACTION.RECONCILE_PAYMENT_LINK_SALE
      planId: CrewBillingPlanId
      amountCents: number
    })
  | (BasePlanManualCrewBillingActionInput & {
      action: Exclude<
        ManualCrewBillingActionType,
        | typeof MANUAL_CREW_BILLING_ACTION.RECORD_MANUAL_PAID
        | typeof MANUAL_CREW_BILLING_ACTION.RECONCILE_PAYMENT_LINK_SALE
      >
    })

export interface CrewBillingAuditEvent {
  id: string | null
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

export type CrewBillingExistingAuditEvent = Pick<
  CrewBillingAuditEvent,
  "eventType" | "idempotencyKey"
> &
  Partial<Pick<CrewBillingAuditEvent, "creditCents">>

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
  fullPlatformCreditCents: number
  crewRefundedCents: number
}

export interface CrewBillingPlanEntitlements {
  features: CrewBillingFeatureKey[]
  limits: Record<CrewBillingLimitKey, number>
}

export interface CrewBillingEntitlementResolution
  extends CrewBillingPlanEntitlements {
  planId: CrewBillingPlanId | null
  billingState: CrewBillingState
  billingSource: CrewBillingSource | null
  hasCrewEventAccess: boolean
  reason: "active" | "no_plan" | "unpaid" | "pending" | "refunded"
}

const emptyCrewBillingLimits: Record<CrewBillingLimitKey, number> = {
  max_crew_events: 0,
  max_crew_volunteers_per_event: 0,
  max_crew_email_sends_per_event: 0,
  max_crew_imports_per_event: 0,
}

const crewBillingPlanEntitlements: Record<
  CrewBillingPlanId,
  CrewBillingPlanEntitlements
> = {
  crew_starter: {
    features: ["crew_events"],
    limits: {
      max_crew_events: 1,
      max_crew_volunteers_per_event: 50,
      max_crew_email_sends_per_event: 0,
      max_crew_imports_per_event: 0,
    },
  },
  crew_basic: {
    features: ["crew_events", "crew_imports", "crew_confirmation_reminders"],
    limits: {
      max_crew_events: 1,
      max_crew_volunteers_per_event: -1,
      max_crew_email_sends_per_event: 500,
      max_crew_imports_per_event: 5,
    },
  },
  crew_pro: {
    features: [
      "crew_events",
      "crew_imports",
      "crew_confirmation_reminders",
      "crew_department_leads",
      "crew_exports",
    ],
    limits: {
      max_crew_events: 3,
      max_crew_volunteers_per_event: -1,
      max_crew_email_sends_per_event: 2000,
      max_crew_imports_per_event: -1,
    },
  },
  crew_concierge: {
    features: [
      "crew_events",
      "crew_imports",
      "crew_confirmation_reminders",
      "crew_department_leads",
      "crew_exports",
      "crew_concierge",
    ],
    limits: {
      max_crew_events: -1,
      max_crew_volunteers_per_event: -1,
      max_crew_email_sends_per_event: -1,
      max_crew_imports_per_event: -1,
    },
  },
  crew_founding_2026: {
    features: [
      "crew_events",
      "crew_imports",
      "crew_confirmation_reminders",
      "crew_department_leads",
      "crew_exports",
    ],
    limits: {
      max_crew_events: 1,
      max_crew_volunteers_per_event: -1,
      max_crew_email_sends_per_event: 2000,
      max_crew_imports_per_event: -1,
    },
  },
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
  [CREW_BILLING_EVENT_TYPE.CHECKOUT_SESSION_CREATED]: {
    state: CREW_BILLING_STATE.PENDING,
    source: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
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
    fullPlatformCreditCents: normalizeCents(input.fullPlatformCreditCents),
    refundedCents: normalizeCents(input.refundedCents),
  }
}

export function resolveCrewBillingEntitlements(
  input: Partial<CrewBillingStateSnapshot> = {},
): CrewBillingEntitlementResolution {
  const current = normalizeCrewBillingState(input)
  const planEntitlements = current.planId
    ? crewBillingPlanEntitlements[current.planId]
    : null
  const reason = resolveCrewBillingAccessReason(current)
  const hasCrewEventAccess =
    reason === "active" &&
    Boolean(planEntitlements?.features.includes("crew_events"))

  return {
    planId: current.planId,
    billingState: current.state,
    billingSource: current.source,
    hasCrewEventAccess,
    reason,
    features:
      hasCrewEventAccess && planEntitlements
        ? [...planEntitlements.features]
        : [],
    limits: hasCrewEventAccess
      ? { ...(planEntitlements?.limits ?? emptyCrewBillingLimits) }
      : { ...emptyCrewBillingLimits },
  }
}

export function hasCrewBillingFeature(
  input: Partial<CrewBillingStateSnapshot>,
  feature: CrewBillingFeatureKey,
) {
  return resolveCrewBillingEntitlements(input).features.includes(feature)
}

export function getCrewBillingLimit(
  input: Partial<CrewBillingStateSnapshot>,
  limit: CrewBillingLimitKey,
) {
  return resolveCrewBillingEntitlements(input).limits[limit] ?? 0
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
    id: normalizeOptionalText(input.id),
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
        ? current.creditCents || current.fullPlatformCreditCents
        : normalizeCents(input.creditCents),
    refundedCents:
      input.refundedCents === undefined || input.refundedCents === null
        ? current.refundedCents
        : normalizeCents(input.refundedCents),
    stripePaymentLinkId: stripe.paymentLinkId,
    stripeCheckoutSessionId: stripe.checkoutSessionId,
    stripePaymentIntentId: stripe.paymentIntentId,
    idempotencyKey: normalizeCrewBillingIdempotencyKey(input),
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
    fullPlatformCreditCents:
      event.eventType === CREW_BILLING_EVENT_TYPE.CREDIT_SET ||
      event.eventType === CREW_BILLING_EVENT_TYPE.CREDIT_APPLIED
        ? event.creditCents
        : normalized.fullPlatformCreditCents,
    crewRefundedCents: event.refundedCents,
  }
}

export function planCrewBillingAuditAppend(
  existingEvents: CrewBillingExistingAuditEvent[],
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

  validateCrewBillingAuditAppend(existingEvents, input.current ?? {}, event)

  return {
    action: "append",
    event,
    settingsPatch: buildCrewBillingSettingsPatch(input.current ?? {}, event),
  }
}

export function planManualCrewBillingAction(
  existingEvents: CrewBillingExistingAuditEvent[],
  input: PlanManualCrewBillingActionInput,
): CrewBillingAppendPlan {
  return planCrewBillingAuditAppend(
    existingEvents,
    buildManualCrewBillingActionInput(input),
  )
}

export function isCrewBillingDuplicateEntryError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false

  const candidate = error as {
    code?: unknown
    errno?: unknown
    message?: unknown
    cause?: unknown
  }

  return (
    candidate.code === "ER_DUP_ENTRY" ||
    candidate.errno === 1062 ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("Duplicate entry")) ||
    (candidate.cause !== error &&
      isCrewBillingDuplicateEntryError(candidate.cause))
  )
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

function resolveCrewBillingAccessReason(
  current: CrewBillingStateSnapshot,
): CrewBillingEntitlementResolution["reason"] {
  if (!current.planId) return "no_plan"
  if (current.state === CREW_BILLING_STATE.REFUNDED) return "refunded"
  if (current.state === CREW_BILLING_STATE.PENDING) return "pending"
  if (
    current.state === CREW_BILLING_STATE.PAID ||
    current.state === CREW_BILLING_STATE.COMPED ||
    current.state === CREW_BILLING_STATE.CREDITED
  ) {
    return "active"
  }
  return "unpaid"
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

function requireManualPaidPlanId(planId: unknown) {
  try {
    const normalized = normalizeCrewBillingPlanId(planId)
    if (normalized) return normalized
  } catch {
    // Fall through to the manual-paid boundary error below.
  }
  throw new Error("Manual paid Crew billing requires a valid Crew plan.")
}

function requireManualPaidAmountCents(amountCents: unknown) {
  const normalized = normalizeCents(amountCents)
  if (normalized > 0) return normalized
  throw new Error("Manual paid Crew billing requires a positive amount.")
}

function normalizeCrewBillingIdempotencyKey(input: BuildCrewBillingEventInput) {
  if (input.eventType === CREW_BILLING_EVENT_TYPE.CREDIT_SET) {
    return "full-platform-credit:set"
  }
  if (input.eventType === CREW_BILLING_EVENT_TYPE.CREDIT_APPLIED) {
    return "full-platform-credit:apply"
  }
  if (input.eventType === CREW_BILLING_EVENT_TYPE.FOUNDER_OVERRIDE_APPLIED) {
    return normalizeOptionalText(input.idempotencyKey) ?? "founder-grant"
  }
  return normalizeOptionalText(input.idempotencyKey)
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

function validateCrewBillingAuditAppend(
  existingEvents: CrewBillingExistingAuditEvent[],
  current: Partial<CrewBillingStateSnapshot>,
  event: CrewBillingAuditEvent,
) {
  const normalized = normalizeCrewBillingState(current)

  if (event.eventType === CREW_BILLING_EVENT_TYPE.MANUAL_SALE_RECORDED) {
    validatePaidCrewBillingEvent(event, "Manual paid Crew billing")
  }

  if (event.eventType === CREW_BILLING_EVENT_TYPE.PAYMENT_LINK_RECONCILED) {
    validatePaidCrewBillingEvent(event, "Payment Link Crew billing")
  }

  if (event.eventType === CREW_BILLING_EVENT_TYPE.CHECKOUT_SESSION_CREATED) {
    validateCheckoutSessionCreatedEvent(event)
  }

  if (event.eventType === CREW_BILLING_EVENT_TYPE.CREDIT_SET) {
    if (
      normalized.creditCents > 0 ||
      normalized.fullPlatformCreditCents > 0 ||
      existingEvents.some(isCrewCreditEvent)
    ) {
      throw new Error(
        "Full platform upgrade credit has already been set or applied for this Crew event.",
      )
    }
    if (event.creditCents <= 0) {
      throw new Error("Full platform upgrade credit must be greater than zero.")
    }
  }

  if (event.eventType === CREW_BILLING_EVENT_TYPE.CREDIT_APPLIED) {
    if (
      existingEvents.some(
        (existing) =>
          existing.eventType === CREW_BILLING_EVENT_TYPE.CREDIT_APPLIED,
      )
    ) {
      throw new Error(
        "Full platform upgrade credit has already been applied for this Crew event.",
      )
    }
    if (
      event.creditCents <= 0 &&
      normalized.creditCents <= 0 &&
      normalized.fullPlatformCreditCents <= 0
    ) {
      throw new Error("Set a full platform upgrade credit before applying it.")
    }
  }
}

function validatePaidCrewBillingEvent(
  event: CrewBillingAuditEvent,
  label: string,
) {
  if (!event.planId) {
    throw new Error(`${label} requires a valid Crew plan.`)
  }
  if (event.amountCents <= 0) {
    throw new Error(`${label} requires a positive amount.`)
  }
}

function validateCheckoutSessionCreatedEvent(event: CrewBillingAuditEvent) {
  validatePaidCrewBillingEvent(event, "Crew Checkout session")
  if (!event.stripeCheckoutSessionId) {
    throw new Error("Crew Checkout session requires a Stripe session ID.")
  }
}

function isCrewCreditEvent(event: CrewBillingExistingAuditEvent) {
  return (
    event.eventType === CREW_BILLING_EVENT_TYPE.CREDIT_SET ||
    event.eventType === CREW_BILLING_EVENT_TYPE.CREDIT_APPLIED
  )
}

function buildManualCrewBillingActionInput(
  input: PlanManualCrewBillingActionInput,
): BuildCrewBillingEventInput {
  const current = normalizeCrewBillingState(input.current)
  const fullPlatformCreditCents =
    normalizeCents(input.fullPlatformCreditCents) ||
    current.creditCents ||
    current.fullPlatformCreditCents
  const common = {
    competitionId: input.competitionId,
    teamId: input.teamId,
    current,
    currency: input.currency,
    actorUserId: input.actorUserId,
    actorLabel: input.actorLabel,
    publicNote: input.publicNote,
    privateMetadata: input.privateMetadata,
  }

  switch (input.action) {
    case MANUAL_CREW_BILLING_ACTION.RECORD_MANUAL_PAID:
      return {
        ...common,
        eventType: CREW_BILLING_EVENT_TYPE.MANUAL_SALE_RECORDED,
        planId: requireManualPaidPlanId(input.planId),
        amountCents: requireManualPaidAmountCents(input.amountCents),
        idempotencyKey: input.idempotencyKey,
      }
    case MANUAL_CREW_BILLING_ACTION.RECONCILE_PAYMENT_LINK_SALE:
      return {
        ...common,
        eventType: CREW_BILLING_EVENT_TYPE.PAYMENT_LINK_RECONCILED,
        planId: requireManualPaidPlanId(input.planId),
        amountCents: requireManualPaidAmountCents(input.amountCents),
        idempotencyKey: input.idempotencyKey,
        stripePaymentLinkId: input.stripePaymentLinkId,
        stripePaymentIntentId: input.stripePaymentIntentId,
      }
    case MANUAL_CREW_BILLING_ACTION.APPLY_FOUNDER_GRANT:
      return {
        ...common,
        eventType: CREW_BILLING_EVENT_TYPE.FOUNDER_OVERRIDE_APPLIED,
        planId: "crew_founding_2026",
        amountCents: input.privateFounderPriceCents ?? input.amountCents,
        idempotencyKey: input.idempotencyKey,
        privateMetadata: mergePrivateMetadata(input.privateMetadata, {
          founderGrant: {
            privatePriceCents: normalizeCents(
              input.privateFounderPriceCents ?? input.amountCents,
            ),
          },
        }),
      }
    case MANUAL_CREW_BILLING_ACTION.SET_FULL_PLATFORM_CREDIT:
      return {
        ...common,
        eventType: CREW_BILLING_EVENT_TYPE.CREDIT_SET,
        planId: input.planId ?? current.planId,
        creditCents: input.fullPlatformCreditCents,
        idempotencyKey: input.idempotencyKey,
        privateMetadata: mergePrivateMetadata(input.privateMetadata, {
          fullPlatformCreditCents: normalizeCents(
            input.fullPlatformCreditCents,
          ),
        }),
      }
    case MANUAL_CREW_BILLING_ACTION.APPLY_FULL_PLATFORM_CREDIT:
      return {
        ...common,
        eventType: CREW_BILLING_EVENT_TYPE.CREDIT_APPLIED,
        planId: input.planId ?? current.planId,
        amountCents: input.amountCents ?? current.amountCents,
        creditCents: fullPlatformCreditCents,
        idempotencyKey: input.idempotencyKey,
        privateMetadata: mergePrivateMetadata(input.privateMetadata, {
          fullPlatformCreditCents,
        }),
      }
    case MANUAL_CREW_BILLING_ACTION.COMP_EVENT:
      return {
        ...common,
        eventType: CREW_BILLING_EVENT_TYPE.EVENT_COMPED,
        planId: input.planId ?? current.planId ?? "crew_starter",
        amountCents: 0,
        idempotencyKey: input.idempotencyKey,
      }
    case MANUAL_CREW_BILLING_ACTION.RECORD_REFUND:
      return {
        ...common,
        eventType: CREW_BILLING_EVENT_TYPE.REFUND_RECORDED,
        planId: input.planId ?? current.planId,
        amountCents: input.amountCents ?? current.amountCents,
        refundedCents: input.refundedCents ?? current.amountCents,
        idempotencyKey: input.idempotencyKey,
        stripePaymentIntentId: input.stripePaymentIntentId,
      }
  }
}

function mergePrivateMetadata(
  current: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
) {
  return {
    ...(normalizePrivateMetadata(current) ?? {}),
    ...next,
  }
}
