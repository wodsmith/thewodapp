// @lat: [[crew#Crew Checkout Sessions]]
import type Stripe from "stripe"
import type {
  CrewBillingPlanId,
  CrewBillingStateSnapshot,
} from "./billing-state"

export const crewCheckoutPlanIds = ["crew_basic", "crew_pro"] as const

export type CrewCheckoutPlanId = (typeof crewCheckoutPlanIds)[number]

export interface CrewCheckoutCatalogPlan {
  id: CrewCheckoutPlanId
  name: string
  description: string | null
  price: number
  currency: string
}

export interface CrewCheckoutMetadataInput {
  teamId: string
  competitionId: string
  crewPlan: CrewCheckoutPlanId
  crewEventSettingsId: string
  billingEventId: string
  checkoutIdempotencyKey: string
}

export interface BuildCrewCheckoutSessionParamsInput
  extends CrewCheckoutMetadataInput {
  eventName: string
  plan: CrewCheckoutCatalogPlan
  appUrl: string
  customerEmail?: string | null
  nowSeconds?: number
}

export function isCrewStripeCheckoutEnabledValue(value: unknown) {
  return (
    value === true ||
    ["1", "true", "yes", "enabled"].includes(String(value ?? "").toLowerCase())
  )
}

export function isCrewCheckoutPlanId(
  planId: string | null | undefined,
): planId is CrewCheckoutPlanId {
  return crewCheckoutPlanIds.includes(planId as CrewCheckoutPlanId)
}

export function resolveCrewCheckoutPlanId({
  requestedPlanId,
  currentPlanId,
}: {
  requestedPlanId?: string | null
  currentPlanId?: CrewBillingPlanId | null
}): CrewCheckoutPlanId {
  if (requestedPlanId) {
    if (isCrewCheckoutPlanId(requestedPlanId)) return requestedPlanId
    throw new Error("Crew Checkout is only available for public paid plans.")
  }

  if (!currentPlanId) return "crew_basic"
  if (isCrewCheckoutPlanId(currentPlanId)) return currentPlanId

  throw new Error("Crew Checkout is only available for public paid plans.")
}

export function assertCrewCheckoutCanStart(billing: CrewBillingStateSnapshot) {
  if (
    billing.state === "paid" ||
    billing.state === "comped" ||
    billing.state === "credited"
  ) {
    throw new Error("Crew billing is already active for this event.")
  }

  if (billing.state === "pending" && billing.stripe.checkoutSessionId) {
    throw new Error("Crew Checkout is already pending for this event.")
  }

  if (
    billing.planId &&
    billing.planId !== "crew_starter" &&
    !isCrewCheckoutPlanId(billing.planId)
  ) {
    throw new Error("Crew Checkout is only available for public paid plans.")
  }
}

export function normalizeCrewCheckoutCatalogPlan(
  plan: {
    id: string
    name: string
    description: string | null
    price: number
    interval: string | null
    isActive: number
    isPublic: number
  } | null,
): CrewCheckoutCatalogPlan {
  if (!plan || !isCrewCheckoutPlanId(plan.id)) {
    throw new Error("Crew Checkout requires a public paid Crew plan.")
  }
  if (plan.isActive !== 1 || plan.isPublic !== 1 || plan.interval !== null) {
    throw new Error("Crew Checkout requires an active one-time public plan.")
  }
  if (!Number.isFinite(plan.price) || plan.price <= 0) {
    throw new Error("Crew Checkout requires a positive event price.")
  }

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: Math.round(plan.price),
    currency: "usd",
  }
}

export function buildCrewCheckoutIdempotencyKey({
  competitionId,
  teamId,
  crewPlan,
  amountCents,
}: {
  competitionId: string
  teamId: string
  crewPlan: CrewCheckoutPlanId
  amountCents: number
}) {
  return ["crew-checkout", competitionId, teamId, crewPlan, amountCents]
    .map((part) => encodeURIComponent(String(part)))
    .join(":")
}

export function buildCrewCheckoutMetadata({
  teamId,
  competitionId,
  crewPlan,
  crewEventSettingsId,
  billingEventId,
  checkoutIdempotencyKey,
}: CrewCheckoutMetadataInput): Record<string, string> {
  return {
    product: "crew",
    teamId,
    competitionId,
    eventId: competitionId,
    crewPlan,
    crewEventSettingsId,
    billingEventId,
    checkoutIdempotencyKey,
  }
}

export function buildCrewCheckoutSessionCreateParams({
  eventName,
  plan,
  appUrl,
  customerEmail,
  nowSeconds = Math.floor(Date.now() / 1000),
  ...metadataInput
}: BuildCrewCheckoutSessionParamsInput): Stripe.Checkout.SessionCreateParams {
  const metadata = buildCrewCheckoutMetadata(metadataInput)
  const billingUrl = buildCrewBillingUrl(appUrl, metadataInput.competitionId)

  return {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: plan.currency,
          unit_amount: plan.price,
          product_data: {
            name: `${plan.name} - ${eventName}`,
            description:
              plan.description ?? "One-time WODsmith Crew event access",
            metadata,
          },
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: {
      metadata,
    },
    success_url: `${billingUrl}?crew_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${billingUrl}?crew_checkout=canceled`,
    expires_at: nowSeconds + 30 * 60,
    customer_email: customerEmail?.trim() || undefined,
  }
}

function buildCrewBillingUrl(appUrl: string, competitionId: string) {
  const baseUrl = appUrl.trim() || "https://wodsmith.com"
  return new URL(
    `/events/${encodeURIComponent(competitionId)}/billing`,
    baseUrl,
  ).toString()
}
