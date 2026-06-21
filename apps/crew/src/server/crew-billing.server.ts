// @lat: [[crew#Crew Billing State And Audit]]
// @lat: [[crew#Manual Paid And Founder Grants]]
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
import {
  type CrewBillingAuditEvent,
  type CrewBillingAppendPlan,
  isCrewBillingDuplicateEntryError,
  type ManualCrewBillingActionType,
  normalizeCrewBillingState,
  planCrewBillingAuditAppend,
  planManualCrewBillingAction,
  type CrewBillingPlanId,
  type CrewBillingStateSnapshot,
} from "../lib/crew/billing-state"
import { requireLocalCrewOperatorAccess } from "./crew-local-access"

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

export interface RecordManualCrewBillingActionInput extends GetCrewBillingInput {
  action: ManualCrewBillingActionType
  planId?: string | null
  amountCents?: number | null
  currency?: string | null
  fullPlatformCreditCents?: number | null
  privateFounderPriceCents?: number | null
  refundedCents?: number | null
  stripePaymentIntentId?: string | null
  idempotencyKey?: string | null
  actorUserId?: string | null
  actorLabel?: string | null
  publicNote?: string | null
  privateMetadata?: Record<string, unknown> | null
}

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
    return toCrewBillingJsonObject(value) ?? {}
  }

  return undefined
}
