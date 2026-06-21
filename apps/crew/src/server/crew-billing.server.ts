// @lat: [[crew#Crew Billing State And Audit]]
// @lat: [[crew#Manual Paid And Founder Grants]]
// @lat: [[crew#Billing Page And Upgrade CTA]]
import { env } from "cloudflare:workers"
import { desc, eq } from "drizzle-orm"
import { getDb } from "../db"
import {
  type CrewBillingEvent,
  type CrewBillingEventType,
  type NewCrewBillingEvent,
  crewBillingEventsTable,
} from "../db/schemas/crew-billing-events"
import {
  type CrewBillingSource,
  type CrewBillingState,
  crewEventSettingsTable,
} from "../db/schemas/crew-event-settings"
import { competitionsTable } from "../db/schemas/competitions"
import { TEAM_PERMISSIONS } from "../db/schemas/teams"
import { ROLES_ENUM } from "../db/schema"
import {
  buildCrewBillingPageViewModel,
  canViewCrewBillingPage,
  type CrewBillingPageViewModel,
} from "../lib/crew/billing-page"
import {
  type CrewBillingAuditEvent,
  type CrewBillingAppendPlan,
  isCrewBillingDuplicateEntryError,
  normalizeCrewBillingState,
  planCrewBillingAuditAppend,
  planManualCrewBillingAction,
  type PlanManualCrewBillingActionInput,
  type CrewBillingPlanId,
  type CrewBillingStateSnapshot,
} from "../lib/crew/billing-state"
import { getSessionFromCookie } from "../utils/auth"
import {
  hasLocalCrewOperatorAccess,
  requireLocalCrewOperatorAccess,
} from "./crew-local-access"

export interface GetCrewBillingInput {
  eventId: string
}

export interface RecordCrewBillingEventInput extends GetCrewBillingInput {
  eventType: CrewBillingEventType
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

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

export type RecordManualCrewBillingActionInput = GetCrewBillingInput &
  DistributiveOmit<
    PlanManualCrewBillingActionInput,
    | "competitionId"
    | "teamId"
    | "current"
    | "stripePaymentLinkId"
    | "stripeCheckoutSessionId"
  >

type CrewBillingJsonValue =
  | string
  | number
  | boolean
  | null
  | CrewBillingJsonValue[]
  | { [key: string]: CrewBillingJsonValue }

type CrewBillingAuditEventRow = Omit<CrewBillingEvent, "privateMetadata"> & {
  privateMetadata: Record<string, CrewBillingJsonValue> | null
}

export interface CrewBillingPageData {
  event: {
    id: string
    name: string
    organizingTeamId: string
    competitionTeamId: string | null
  }
  billing: CrewBillingStateSnapshot
  auditEvents: CrewBillingAuditEventRow[]
}

export interface CrewBillingOrganizerPageData {
  event: {
    id: string
    name: string
  }
  viewModel: CrewBillingPageViewModel
}

type CrewBillingScope = CrewBillingPageData["event"] & {
  state: CrewBillingState
  source: CrewBillingSource | null
  planId: CrewBillingPlanId | null
  amountCents: number
  currency: string
  stripePaymentLinkId: string | null
  stripeCheckoutSessionId: string | null
  stripePaymentIntentId: string | null
  founderOverride: boolean
  creditCents: number
  fullPlatformCreditCents: number
  refundedCents: number
  settingsText: string | null
}

export async function getCrewBillingPage(
  data: GetCrewBillingInput,
): Promise<CrewBillingPageData> {
  requireLocalCrewOperatorAccess("Crew billing")

  const scope = await requireCrewBillingScope(data.eventId)
  const auditEvents = await listCrewBillingEventsForEvent(data.eventId)

  return {
    event: toCrewBillingEventSummary(scope),
    billing: toCrewBillingSnapshot(scope),
    auditEvents: auditEvents.map(toCrewBillingAuditEventRow),
  }
}

export async function getCrewBillingOrganizerPage(
  data: GetCrewBillingInput,
): Promise<CrewBillingOrganizerPageData> {
  const scope = await requireCrewBillingScope(data.eventId)
  await requireCrewBillingOrganizerAccess(scope)

  const billing = toCrewBillingSnapshot(scope)
  const paymentLinkUrl = getCrewPaymentLinkUrlFromSettings(scope.settingsText)

  return {
    event: {
      id: scope.id,
      name: scope.name,
    },
    viewModel: buildCrewBillingPageViewModel({
      billing,
      paymentLink: {
        id: billing.stripe.paymentLinkId,
        url: paymentLinkUrl,
      },
      checkoutEnabled: isCrewStripeCheckoutEnabled(),
    }),
  }
}

export async function recordCrewBillingEvent(
  data: RecordCrewBillingEventInput,
): Promise<CrewBillingPageData> {
  requireLocalCrewOperatorAccess("Crew billing")

  const scope = await requireCrewBillingScope(data.eventId)
  const current = toCrewBillingSnapshot(scope)
  const existingEvents = await listCrewBillingEventsForEvent(data.eventId)
  const appendPlan = planCrewBillingAuditAppend(existingEvents, {
    ...data,
    competitionId: data.eventId,
    teamId: scope.organizingTeamId,
    current,
  })

  return persistCrewBillingAppend(data, appendPlan)
}

export async function recordManualCrewBillingAction(
  data: RecordManualCrewBillingActionInput,
): Promise<CrewBillingPageData> {
  requireLocalCrewOperatorAccess("Crew billing")

  const scope = await requireCrewBillingScope(data.eventId)
  const current = toCrewBillingSnapshot(scope)
  const existingEvents = await listCrewBillingEventsForEvent(data.eventId)
  const appendPlan = planManualCrewBillingAction(existingEvents, {
    ...data,
    competitionId: data.eventId,
    teamId: scope.organizingTeamId,
    current,
  })

  return persistCrewBillingAppend(data, appendPlan)
}

async function persistCrewBillingAppend(
  data: GetCrewBillingInput,
  appendPlan: CrewBillingAppendPlan,
) {
  if (appendPlan.action === "skip_duplicate") {
    return getCrewBillingPage(data)
  }

  const db = getDb()
  const { event, settingsPatch } = appendPlan

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(crewBillingEventsTable)
        .values(toNewCrewBillingEvent(event))
      await tx
        .update(crewEventSettingsTable)
        .set({
          ...settingsPatch,
          updatedAt: new Date(),
        })
        .where(eq(crewEventSettingsTable.competitionId, data.eventId))
    })
  } catch (error) {
    if (isCrewBillingDuplicateEntryError(error)) {
      return getCrewBillingPage(data)
    }
    throw error
  }

  return getCrewBillingPage(data)
}

async function requireCrewBillingScope(
  eventId: string,
): Promise<CrewBillingScope> {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
      state: crewEventSettingsTable.crewBillingState,
      source: crewEventSettingsTable.crewBillingSource,
      planId: crewEventSettingsTable.crewBillingPlanId,
      amountCents: crewEventSettingsTable.crewBillingAmountCents,
      currency: crewEventSettingsTable.crewBillingCurrency,
      stripePaymentLinkId: crewEventSettingsTable.crewStripePaymentLinkId,
      stripeCheckoutSessionId:
        crewEventSettingsTable.crewStripeCheckoutSessionId,
      stripePaymentIntentId: crewEventSettingsTable.crewStripePaymentIntentId,
      founderOverride: crewEventSettingsTable.crewFounderOverride,
      creditCents: crewEventSettingsTable.crewCreditCents,
      fullPlatformCreditCents: crewEventSettingsTable.fullPlatformCreditCents,
      refundedCents: crewEventSettingsTable.crewRefundedCents,
      settingsText: crewEventSettingsTable.settings,
    })
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(crewEventSettingsTable.competitionId, eventId))
    .limit(1)

  if (!event) {
    throw new Error("Crew event not found")
  }

  return {
    ...event,
    planId: event.planId as CrewBillingPlanId | null,
  }
}

async function requireCrewBillingOrganizerAccess(scope: CrewBillingScope) {
  const session = await getSessionFromCookie().catch(() => null)
  const canView = canViewCrewBillingPage({
    isLocalCrewOperator: hasLocalCrewOperatorAccess(),
    isSiteAdmin: session?.user.role === ROLES_ENUM.ADMIN,
    teams:
      session?.teams?.map((team) => ({
        id: team.id,
        permissions: team.permissions,
      })) ?? [],
    event: {
      organizingTeamId: scope.organizingTeamId,
      competitionTeamId: scope.competitionTeamId,
    },
    billingPermission: TEAM_PERMISSIONS.ACCESS_BILLING,
  })

  if (!canView) {
    throw new Error("FORBIDDEN: You don't have access to Crew billing")
  }
}

async function listCrewBillingEventsForEvent(eventId: string) {
  const db = getDb()
  return db
    .select()
    .from(crewBillingEventsTable)
    .where(eq(crewBillingEventsTable.competitionId, eventId))
    .orderBy(desc(crewBillingEventsTable.createdAt))
}

function toCrewBillingEventSummary(scope: CrewBillingScope) {
  return {
    id: scope.id,
    name: scope.name,
    organizingTeamId: scope.organizingTeamId,
    competitionTeamId: scope.competitionTeamId,
  }
}

function toCrewBillingSnapshot(scope: CrewBillingScope) {
  return normalizeCrewBillingState({
    state: scope.state,
    source: scope.source,
    planId: scope.planId,
    amountCents: scope.amountCents,
    currency: scope.currency,
    stripe: {
      paymentLinkId: scope.stripePaymentLinkId,
      checkoutSessionId: scope.stripeCheckoutSessionId,
      paymentIntentId: scope.stripePaymentIntentId,
    },
    founderOverride: scope.founderOverride,
    creditCents: scope.creditCents,
    fullPlatformCreditCents: scope.fullPlatformCreditCents,
    refundedCents: scope.refundedCents,
  })
}

function toNewCrewBillingEvent(
  event: CrewBillingAuditEvent,
): NewCrewBillingEvent {
  return {
    competitionId: event.competitionId,
    teamId: event.teamId,
    eventType: event.eventType,
    billingState: event.billingState,
    billingSource: event.billingSource,
    planId: event.planId,
    amountCents: event.amountCents,
    currency: event.currency,
    creditCents: event.creditCents,
    refundedCents: event.refundedCents,
    stripePaymentLinkId: event.stripePaymentLinkId,
    stripeCheckoutSessionId: event.stripeCheckoutSessionId,
    stripePaymentIntentId: event.stripePaymentIntentId,
    idempotencyKey: event.idempotencyKey,
    actorUserId: event.actorUserId,
    actorLabel: event.actorLabel,
    publicNote: event.publicNote,
    privateMetadata: event.privateMetadata,
  }
}

function toCrewBillingAuditEventRow(
  event: CrewBillingEvent,
): CrewBillingAuditEventRow {
  return {
    ...event,
    privateMetadata: toCrewBillingJsonObject(event.privateMetadata),
  }
}

function toCrewBillingJsonObject(
  value: unknown,
): Record<string, CrewBillingJsonValue> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const output: Record<string, CrewBillingJsonValue> = {}
  for (const [key, child] of Object.entries(value)) {
    const jsonValue = toCrewBillingJsonValue(child)
    if (jsonValue !== undefined) {
      output[key] = jsonValue
    }
  }

  return Object.keys(output).length > 0 ? output : null
}

function toCrewBillingJsonValue(
  value: unknown,
): CrewBillingJsonValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map(toCrewBillingJsonValue)
      .filter((child): child is CrewBillingJsonValue => child !== undefined)
  }

  if (typeof value === "object") {
    return toCrewBillingJsonObject(value) ?? undefined
  }

  return undefined
}

function getCrewPaymentLinkUrlFromSettings(settingsText: string | null) {
  const settings = parseSettingsObject(settingsText)
  if (!settings) return null

  const candidates = [
    getNestedString(settings, ["billing", "paymentLinkUrl"]),
    getNestedString(settings, ["billing", "crewPaymentLinkUrl"]),
    getNestedString(settings, ["crewBilling", "paymentLinkUrl"]),
    getNestedString(settings, ["crewBilling", "crewPaymentLinkUrl"]),
    getNestedString(settings, ["paymentLinkUrl"]),
    getNestedString(settings, ["crewPaymentLinkUrl"]),
  ]

  for (const candidate of candidates) {
    const safeUrl = getSafeHttpUrl(candidate)
    if (safeUrl) return safeUrl
  }

  return null
}

function parseSettingsObject(settingsText: string | null) {
  if (!settingsText) return null

  try {
    const parsed: unknown = JSON.parse(settingsText)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function getNestedString(
  object: Record<string, unknown>,
  path: string[],
): string | null {
  let current: unknown = object
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null
    }
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === "string" ? current : null
}

function getSafeHttpUrl(value: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function isCrewStripeCheckoutEnabled() {
  const runtimeEnv = env as typeof env & {
    CREW_STRIPE_CHECKOUT_ENABLED?: string | boolean
  }
  const value = runtimeEnv.CREW_STRIPE_CHECKOUT_ENABLED
  return (
    value === true ||
    ["1", "true", "yes", "enabled"].includes(String(value ?? "").toLowerCase())
  )
}
