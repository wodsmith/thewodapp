// @lat: [[crew#Crew Stripe Webhooks]]
import { CREW_BILLING_EVENT_TYPE } from "../../db/schemas/crew-billing-events"
import {
  CREW_BILLING_SOURCE,
  CREW_BILLING_STATE,
} from "../../db/schemas/crew-event-settings"
import {
  type CrewBillingAppendPlan,
  type CrewBillingExistingAuditEvent,
  type CrewBillingStateSnapshot,
  planCrewBillingAuditAppend,
} from "./billing-state"
import {
  buildCrewCheckoutBillingEventId,
  buildCrewCheckoutIdempotencyKey,
  type CrewCheckoutPlanId,
  isCrewCheckoutPlanId,
} from "./checkout-sessions"

export class CrewCheckoutWebhookValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CrewCheckoutWebhookValidationError"
  }
}

export interface CrewCheckoutSessionWebhookInput {
  stripeEventId: string
  sessionId: string
  metadata?: Record<string, string | null | undefined> | null
  amountTotal?: number | null
  currency?: string | null
  paymentIntentId?: string | null
}

export interface CrewCheckoutWebhookCompletionInput {
  stripeEventId: string
  sessionId: string
  eventId: string
  teamId: string
  crewPlan: CrewCheckoutPlanId
  crewEventSettingsId: string
  billingEventId: string
  checkoutIdempotencyKey: string
  amountCents: number
  currency: string
  stripePaymentIntentId: string | null
}

export type CrewCheckoutWebhookExistingEvent = CrewBillingExistingAuditEvent & {
  stripeCheckoutSessionId?: string | null
  privateMetadata?: Record<string, unknown> | null
}

export type CrewCheckoutWebhookCompletionPlan =
  | {
      action: "append"
      appendPlan: Extract<CrewBillingAppendPlan, { action: "append" }>
    }
  | {
      action: "skip_duplicate"
    }

export function getCrewCheckoutMetadataProduct(
  metadata?: Record<string, string | null | undefined> | null,
) {
  return normalizeText(metadata?.product)
}

export function isCrewCheckoutSessionMetadata(
  metadata?: Record<string, string | null | undefined> | null,
) {
  return getCrewCheckoutMetadataProduct(metadata) === "crew"
}

export function parseCrewCheckoutSessionWebhook(
  input: CrewCheckoutSessionWebhookInput,
): CrewCheckoutWebhookCompletionInput {
  const metadata = input.metadata ?? {}

  if (!isCrewCheckoutSessionMetadata(metadata)) {
    throw new CrewCheckoutWebhookValidationError(
      "Checkout Session is not a Crew purchase.",
    )
  }

  const sessionId = requireText(input.sessionId, "Stripe session ID")
  const stripeEventId = requireText(input.stripeEventId, "Stripe event ID")
  const teamId = requireText(metadata.teamId, "Crew team ID")
  const competitionId = requireText(
    metadata.competitionId,
    "Crew competition ID",
  )
  const eventId = normalizeText(metadata.eventId) ?? competitionId

  if (eventId !== competitionId) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew event metadata does not match competition metadata.",
    )
  }

  const crewPlanRaw = requireText(metadata.crewPlan, "Crew plan")
  if (!isCrewCheckoutPlanId(crewPlanRaw)) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout metadata contains an invalid Crew plan.",
    )
  }

  const crewEventSettingsId = requireText(
    metadata.crewEventSettingsId,
    "Crew event settings ID",
  )
  const billingEventId = requireText(
    metadata.billingEventId,
    "Crew billing event ID",
  )
  const checkoutIdempotencyKey = requireText(
    metadata.checkoutIdempotencyKey,
    "Crew Checkout idempotency key",
  )
  const amountCents = requirePositiveCents(input.amountTotal)
  const currency = normalizeCurrency(input.currency)
  const expectedCheckoutIdempotencyKey = buildCrewCheckoutIdempotencyKey({
    competitionId: eventId,
    teamId,
    crewPlan: crewPlanRaw,
    amountCents,
  })

  if (checkoutIdempotencyKey !== expectedCheckoutIdempotencyKey) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout idempotency metadata does not match the completed session.",
    )
  }

  if (
    billingEventId !== buildCrewCheckoutBillingEventId(checkoutIdempotencyKey)
  ) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout billing event metadata does not match the checkout key.",
    )
  }

  return {
    stripeEventId,
    sessionId,
    eventId,
    teamId,
    crewPlan: crewPlanRaw,
    crewEventSettingsId,
    billingEventId,
    checkoutIdempotencyKey,
    amountCents,
    currency,
    stripePaymentIntentId: normalizeText(input.paymentIntentId),
  }
}

export function planCrewCheckoutWebhookCompletion({
  current,
  existingEvents,
  completion,
}: {
  current: CrewBillingStateSnapshot
  existingEvents: CrewCheckoutWebhookExistingEvent[]
  completion: CrewCheckoutWebhookCompletionInput
}): CrewCheckoutWebhookCompletionPlan {
  if (
    isDuplicateCrewCheckoutCompletion(existingEvents, completion) ||
    isAlreadyPaidByCrewCheckoutSession(current, completion)
  ) {
    return { action: "skip_duplicate" }
  }

  validatePendingCrewCheckoutState(current, completion)

  const appendPlan = planCrewBillingAuditAppend(existingEvents, {
    competitionId: completion.eventId,
    teamId: completion.teamId,
    eventType: CREW_BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
    current,
    planId: completion.crewPlan,
    amountCents: completion.amountCents,
    currency: completion.currency,
    stripeCheckoutSessionId: completion.sessionId,
    stripePaymentIntentId: completion.stripePaymentIntentId,
    idempotencyKey: getCrewCheckoutSessionCompletionIdempotencyKey(
      completion.sessionId,
    ),
    privateMetadata: {
      stripeEventId: completion.stripeEventId,
      billingEventId: completion.billingEventId,
      checkoutIdempotencyKey: completion.checkoutIdempotencyKey,
    },
  })

  if (appendPlan.action === "skip_duplicate") {
    return { action: "skip_duplicate" }
  }

  return { action: "append", appendPlan }
}

export function getCrewCheckoutStripeEventIdempotencyKey(
  stripeEventId: string,
) {
  return `stripe-event:${stripeEventId}`
}

export function getCrewCheckoutSessionCompletionIdempotencyKey(
  sessionId: string,
) {
  return `stripe-checkout-session:${sessionId}`
}

function isDuplicateCrewCheckoutCompletion(
  existingEvents: CrewCheckoutWebhookExistingEvent[],
  completion: CrewCheckoutWebhookCompletionInput,
) {
  const stripeEventKey = getCrewCheckoutStripeEventIdempotencyKey(
    completion.stripeEventId,
  )
  const sessionKey = getCrewCheckoutSessionCompletionIdempotencyKey(
    completion.sessionId,
  )

  return existingEvents.some((event) => {
    if (event.eventType !== CREW_BILLING_EVENT_TYPE.CHECKOUT_COMPLETED) {
      return false
    }

    return (
      event.idempotencyKey === stripeEventKey ||
      event.idempotencyKey === sessionKey ||
      event.stripeCheckoutSessionId === completion.sessionId ||
      event.privateMetadata?.stripeEventId === completion.stripeEventId
    )
  })
}

function isAlreadyPaidByCrewCheckoutSession(
  current: CrewBillingStateSnapshot,
  completion: CrewCheckoutWebhookCompletionInput,
) {
  return (
    current.state === CREW_BILLING_STATE.PAID &&
    current.source === CREW_BILLING_SOURCE.STRIPE_CHECKOUT &&
    current.planId === completion.crewPlan &&
    current.amountCents === completion.amountCents &&
    current.currency === completion.currency &&
    current.stripe.checkoutSessionId === completion.sessionId
  )
}

function validatePendingCrewCheckoutState(
  current: CrewBillingStateSnapshot,
  completion: CrewCheckoutWebhookCompletionInput,
) {
  if (
    current.state !== CREW_BILLING_STATE.PENDING ||
    current.source !== CREW_BILLING_SOURCE.STRIPE_CHECKOUT
  ) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout completion requires a pending Stripe Checkout billing state.",
    )
  }

  if (current.planId !== completion.crewPlan) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout completion plan does not match the pending event plan.",
    )
  }

  if (
    current.amountCents !== completion.amountCents ||
    current.currency !== completion.currency
  ) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout completion amount does not match the pending event billing state.",
    )
  }

  if (
    current.stripe.checkoutSessionId &&
    current.stripe.checkoutSessionId !== completion.sessionId
  ) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout completion session does not match the pending event session.",
    )
  }

  if (
    current.stripe.paymentIntentId &&
    completion.stripePaymentIntentId &&
    current.stripe.paymentIntentId !== completion.stripePaymentIntentId
  ) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout completion payment intent does not match the event billing state.",
    )
  }
}

function requireText(value: unknown, label: string) {
  const normalized = normalizeText(value)
  if (!normalized) {
    throw new CrewCheckoutWebhookValidationError(`${label} is required.`)
  }
  return normalized
}

function requirePositiveCents(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout completion amount is required.",
    )
  }

  if (value <= 0) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout completion amount must be positive.",
    )
  }

  return value
}

function normalizeCurrency(value: unknown) {
  const normalized = normalizeText(value)?.toLowerCase()
  if (!normalized || !/^[a-z]{3}$/.test(normalized)) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout completion currency is required.",
    )
  }
  return normalized
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}
