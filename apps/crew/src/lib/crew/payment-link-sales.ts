// @lat: [[crew#Stripe Payment Link Sales]]
import { safeHttpUrl } from "../safe-url"
import {
  MANUAL_CREW_BILLING_ACTION,
  type CrewBillingPlanId,
  type CrewBillingStateSnapshot,
  type PlanManualCrewBillingActionInput,
} from "./billing-state"

export interface CrewPaymentLinkReferenceInput {
  paymentLinkReference?: string | null
  paymentLinkUrl?: string | null
}

export interface NormalizedCrewPaymentLinkReference {
  reference: string | null
  url: string | null
}

export interface CrewPaymentLinkSaleInput
  extends CrewPaymentLinkReferenceInput {
  eventId: string
  organizingTeamId: string
  planId: CrewBillingPlanId
  amountCents: number
  currency?: string | null
  current?: Partial<CrewBillingStateSnapshot>
  stripePaymentIntentId?: string | null
  idempotencyKey?: string | null
  actorUserId?: string | null
  actorLabel?: string | null
  publicNote?: string | null
  privateMetadata?: Record<string, unknown> | null
}

const MAX_PAYMENT_LINK_ID_LENGTH = 255

export function normalizeCrewPaymentLinkReference({
  paymentLinkReference,
  paymentLinkUrl,
}: CrewPaymentLinkReferenceInput): NormalizedCrewPaymentLinkReference {
  const referenceText = normalizeOptionalText(paymentLinkReference)
  const urlFromUrlField = normalizeCrewPaymentLinkUrl(paymentLinkUrl)
  const urlFromReference = normalizeCrewPaymentLinkUrl(referenceText)
  const reference = urlFromReference ? null : normalizePaymentLinkId(referenceText)

  return {
    reference,
    url: urlFromUrlField ?? urlFromReference,
  }
}

export function normalizeCrewPaymentLinkUrl(input: string | null | undefined) {
  return safeHttpUrl(normalizeOptionalText(input))
}

export function hasCrewPaymentLinkReference(
  paymentLink: NormalizedCrewPaymentLinkReference,
) {
  return paymentLink.reference !== null || paymentLink.url !== null
}

export function serializeCrewPaymentLinkSettings(
  settingsText: string | null,
  input: CrewPaymentLinkReferenceInput,
) {
  const paymentLink = normalizeCrewPaymentLinkReference(input)
  if (!hasCrewPaymentLinkReference(paymentLink)) return settingsText

  const baseSettings = parseSettingsObject(settingsText)
  const crewBilling = getPlainObject(baseSettings.crewBilling)

  return JSON.stringify(
    {
      ...baseSettings,
      crewBilling: {
        ...crewBilling,
        ...(paymentLink.reference
          ? { paymentLinkReference: paymentLink.reference }
          : {}),
        ...(paymentLink.url ? { paymentLinkUrl: paymentLink.url } : {}),
      },
    },
    null,
    2,
  )
}

export function getCrewPaymentLinkUrlFromSettings(settingsText: string | null) {
  const settings = parseSettingsObject(settingsText)

  const candidates = [
    getNestedString(settings, ["crewBilling", "paymentLinkUrl"]),
    getNestedString(settings, ["billing", "paymentLinkUrl"]),
    getNestedString(settings, ["billing", "crewPaymentLinkUrl"]),
    getNestedString(settings, ["crewBilling", "crewPaymentLinkUrl"]),
    getNestedString(settings, ["paymentLinkUrl"]),
    getNestedString(settings, ["crewPaymentLinkUrl"]),
  ]

  for (const candidate of candidates) {
    const safeUrl = normalizeCrewPaymentLinkUrl(candidate)
    if (safeUrl) return safeUrl
  }

  return null
}

export function buildCrewPaymentLinkSaleActionInput(
  input: CrewPaymentLinkSaleInput,
): PlanManualCrewBillingActionInput {
  const paymentLink = normalizeCrewPaymentLinkReference(input)
  const paymentLinkReference =
    paymentLink.reference ?? input.current?.stripe?.paymentLinkId ?? null

  return {
    action: MANUAL_CREW_BILLING_ACTION.RECONCILE_PAYMENT_LINK_SALE,
    competitionId: input.eventId,
    teamId: input.organizingTeamId,
    current: input.current,
    planId: input.planId,
    amountCents: input.amountCents,
    currency: input.currency,
    stripePaymentLinkId: paymentLinkReference,
    stripePaymentIntentId: input.stripePaymentIntentId,
    idempotencyKey: buildCrewPaymentLinkSaleIdempotencyKey({
      ...input,
      paymentLinkReference,
    }),
    actorUserId: input.actorUserId,
    actorLabel: input.actorLabel,
    publicNote: input.publicNote,
    privateMetadata: input.privateMetadata,
  }
}

export function buildCrewPaymentLinkSaleIdempotencyKey(
  input: Pick<
    CrewPaymentLinkSaleInput,
    | "eventId"
    | "organizingTeamId"
    | "planId"
    | "amountCents"
    | "currency"
    | "stripePaymentIntentId"
    | "idempotencyKey"
  > & { paymentLinkReference?: string | null },
) {
  const provided = normalizeOptionalText(input.idempotencyKey)
  if (provided) return provided

  const paymentLinkReference = normalizeOptionalText(input.paymentLinkReference)
  const paymentIntentId = normalizeOptionalText(input.stripePaymentIntentId)
  if (paymentLinkReference || paymentIntentId) {
    return joinCrewPaymentLinkIdempotencyParts(
      "payment-link",
      paymentLinkReference ?? "missing-link",
      paymentIntentId ?? "missing-payment-intent",
    )
  }

  return joinCrewPaymentLinkIdempotencyParts(
    "payment-link",
    "manual",
    input.eventId,
    input.organizingTeamId,
    input.planId,
    Math.max(0, Math.round(input.amountCents)),
    normalizeCurrency(input.currency),
  )
}

function normalizePaymentLinkId(input: string | null) {
  if (!input) return null
  return input.length <= MAX_PAYMENT_LINK_ID_LENGTH ? input : null
}

function joinCrewPaymentLinkIdempotencyParts(
  ...parts: Array<string | number>
) {
  return parts.map((part) => encodeURIComponent(String(part))).join(":")
}

function parseSettingsObject(settingsText: string | null) {
  if (!settingsText?.trim()) return {}

  try {
    const parsed: unknown = JSON.parse(settingsText)
    return getPlainObject(parsed)
  } catch {
    return { legacySettingsText: settingsText }
  }
}

function getPlainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function getNestedString(object: Record<string, unknown>, path: string[]) {
  let current: unknown = object
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null
    }
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === "string" ? current : null
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function normalizeCurrency(value: unknown) {
  const normalized = normalizeOptionalText(value)?.toLowerCase() ?? "usd"
  return /^[a-z]{3}$/.test(normalized) ? normalized : "usd"
}
