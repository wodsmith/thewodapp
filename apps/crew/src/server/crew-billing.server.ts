// @lat: [[crew#Crew Billing State And Audit]]
// @lat: [[crew#Manual Paid And Founder Grants]]
// @lat: [[crew#Billing Page And Upgrade CTA]]
// @lat: [[crew#Stripe Payment Link Sales]]
// @lat: [[crew#Crew Checkout Sessions]]
// @lat: [[crew#Crew Stripe Webhooks]]
import { env } from "cloudflare:workers"
import { and, desc, eq, isNull, or } from "drizzle-orm"
import { getDb } from "../db"
import { ROLES_ENUM } from "../db/schema"
import { competitionsTable } from "../db/schemas/competitions"
import {
  CREW_BILLING_EVENT_TYPE,
  type CrewBillingEvent,
  type CrewBillingEventType,
  crewBillingEventsTable,
  type NewCrewBillingEvent,
} from "../db/schemas/crew-billing-events"
import {
  CREW_BILLING_SOURCE,
  CREW_BILLING_STATE,
  type CrewBillingSource,
  type CrewBillingState,
  crewEventSettingsTable,
} from "../db/schemas/crew-event-settings"
import { planTable } from "../db/schemas/entitlements"
import { TEAM_PERMISSIONS } from "../db/schemas/teams"
import {
  buildCrewBillingPageViewModel,
  type CrewBillingPageViewModel,
  canViewCrewBillingPage,
} from "../lib/crew/billing-page"
import {
  type CrewBillingAppendPlan,
  type CrewBillingAuditEvent,
  type CrewBillingPlanId,
  type CrewBillingStateSnapshot,
  isCrewBillingDuplicateEntryError,
  normalizeCrewBillingState,
  type PlanManualCrewBillingActionInput,
  planCrewBillingAuditAppend,
  planManualCrewBillingAction,
} from "../lib/crew/billing-state"
import {
  assertCrewCheckoutCanStart,
  buildCrewCheckoutBillingEventId,
  buildCrewCheckoutIdempotencyKey,
  buildCrewCheckoutSessionCreateParams,
  type CrewCheckoutCatalogPlan,
  type CrewCheckoutPlanId,
  isCrewStripeCheckoutEnabledValue,
  isReusableCrewCheckoutPendingClaim,
  normalizeCrewCheckoutCatalogPlan,
  resolveCrewCheckoutPlanId,
} from "../lib/crew/checkout-sessions"
import {
  CrewCheckoutWebhookValidationError,
  type CrewCheckoutWebhookCompletionInput,
  planCrewCheckoutWebhookCompletion,
} from "../lib/crew/checkout-webhooks"
import {
  buildCrewPaymentLinkSaleActionInput,
  getCrewPaymentLinkUrlFromSettings,
  hasCrewPaymentLinkReference,
  normalizeCrewPaymentLinkReference,
  serializeCrewPaymentLinkSettings,
} from "../lib/crew/payment-link-sales"
import { getAppUrl } from "../lib/env"
import { getStripe } from "../lib/stripe"
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

export interface RecordCrewPaymentLinkInput extends GetCrewBillingInput {
  paymentLinkReference?: string | null
  paymentLinkUrl?: string | null
}

export interface ReconcileCrewPaymentLinkSaleInput
  extends RecordCrewPaymentLinkInput {
  planId: CrewBillingPlanId
  amountCents: number
  currency?: string | null
  stripePaymentIntentId?: string | null
  idempotencyKey?: string | null
  actorUserId?: string | null
  actorLabel?: string | null
  publicNote?: string | null
  privateMetadata?: Record<string, unknown> | null
}

export interface CreateCrewCheckoutSessionInput extends GetCrewBillingInput {
  planId?: CrewCheckoutPlanId | null
}

export interface CreateCrewCheckoutSessionResult {
  checkoutUrl: string
}

export interface CompleteCrewCheckoutSessionFromWebhookResult {
  status: "completed" | "duplicate"
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
  settingsId: string
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

export async function recordCrewPaymentLinkReference(
  data: RecordCrewPaymentLinkInput,
): Promise<CrewBillingPageData> {
  requireLocalCrewOperatorAccess("Crew billing")

  const scope = await requireCrewBillingScope(data.eventId)
  const paymentLink = normalizeCrewPaymentLinkReference(data)
  if (!hasCrewPaymentLinkReference(paymentLink)) {
    throw new Error("Crew Payment Link recording requires a reference or URL.")
  }

  await updateCrewPaymentLinkSettings({
    eventId: data.eventId,
    settingsText: serializeCrewPaymentLinkSettings(scope.settingsText, data),
    paymentLinkReference: paymentLink.reference ?? undefined,
  })

  return getCrewBillingPage(data)
}

export async function reconcileCrewPaymentLinkSale(
  data: ReconcileCrewPaymentLinkSaleInput,
): Promise<CrewBillingPageData> {
  requireLocalCrewOperatorAccess("Crew billing")

  const scope = await requireCrewBillingScope(data.eventId)
  const current = toCrewBillingSnapshot(scope)
  const existingEvents = await listCrewBillingEventsForEvent(data.eventId)
  const paymentLink = normalizeCrewPaymentLinkReference(data)
  const appendPlan = planManualCrewBillingAction(
    existingEvents,
    buildCrewPaymentLinkSaleActionInput({
      ...data,
      eventId: scope.id,
      organizingTeamId: scope.organizingTeamId,
      current,
    }),
  )

  return persistCrewBillingAppend(data, appendPlan, {
    settingsText: hasCrewPaymentLinkReference(paymentLink)
      ? serializeCrewPaymentLinkSettings(scope.settingsText, data)
      : undefined,
    paymentLinkReference: paymentLink.reference ?? undefined,
    current,
  })
}

export async function createCrewCheckoutSession(
  data: CreateCrewCheckoutSessionInput,
): Promise<CreateCrewCheckoutSessionResult> {
  if (!isCrewStripeCheckoutEnabled()) {
    throw new Error("Crew Checkout is not enabled.")
  }

  const scope = await requireCrewBillingScope(data.eventId)
  const session = await requireCrewBillingOrganizerAccess(scope)
  const current = toCrewBillingSnapshot(scope)

  const planId = resolveCrewCheckoutPlanId({
    requestedPlanId: data.planId,
    currentPlanId: current.planId,
  })
  const plan = await requireCrewCheckoutPlan(planId)
  const checkoutIdempotencyKey = buildCrewCheckoutIdempotencyKey({
    competitionId: scope.id,
    teamId: scope.organizingTeamId,
    crewPlan: plan.id,
    amountCents: plan.price,
  })
  const billingEventId = buildCrewCheckoutBillingEventId(checkoutIdempotencyKey)

  const claimCurrent = await claimCrewCheckoutSessionStart({
    eventId: scope.id,
    current,
    plan,
  })
  const existingEvents = await listCrewBillingEventsForEvent(scope.id)

  const checkoutSession = await getStripe().checkout.sessions.create(
    buildCrewCheckoutSessionCreateParams({
      eventName: scope.name,
      plan,
      appUrl: getAppUrl(),
      teamId: scope.organizingTeamId,
      competitionId: scope.id,
      crewPlan: plan.id,
      crewEventSettingsId: scope.settingsId,
      billingEventId,
      checkoutIdempotencyKey,
    }),
    { idempotencyKey: checkoutIdempotencyKey },
  )

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a Checkout URL.")
  }

  const appendPlan = planCrewBillingAuditAppend(existingEvents, {
    id: billingEventId,
    competitionId: scope.id,
    teamId: scope.organizingTeamId,
    eventType: CREW_BILLING_EVENT_TYPE.CHECKOUT_SESSION_CREATED,
    current: claimCurrent,
    planId: plan.id,
    amountCents: plan.price,
    currency: plan.currency,
    stripeCheckoutSessionId: checkoutSession.id,
    idempotencyKey: checkoutIdempotencyKey,
    actorUserId: session?.user.id,
    actorLabel: session?.user.email,
  })

  await persistCrewCheckoutSessionCreated(data, appendPlan)

  return { checkoutUrl: checkoutSession.url }
}

export async function completeCrewCheckoutSessionFromWebhook(
  data: CrewCheckoutWebhookCompletionInput,
): Promise<CompleteCrewCheckoutSessionFromWebhookResult> {
  const scope = await requireCrewBillingScope(data.eventId)

  if (
    scope.organizingTeamId !== data.teamId ||
    scope.settingsId !== data.crewEventSettingsId
  ) {
    throw new CrewCheckoutWebhookValidationError(
      "Crew Checkout metadata is outside the event billing scope.",
    )
  }

  const current = toCrewBillingSnapshot(scope)
  const existingEvents = await listCrewBillingEventsForEvent(data.eventId)
  const completionPlan = planCrewCheckoutWebhookCompletion({
    current,
    existingEvents,
    completion: data,
  })

  if (completionPlan.action === "skip_duplicate") {
    return { status: "duplicate" }
  }

  return persistCrewCheckoutCompletedFromWebhook(
    data,
    completionPlan.appendPlan,
  )
}

async function claimCrewCheckoutSessionStart({
  eventId,
  current,
  plan,
}: {
  eventId: string
  current: CrewBillingStateSnapshot
  plan: CrewCheckoutCatalogPlan
}) {
  if (
    isReusableCrewCheckoutPendingClaim({
      billing: current,
      crewPlan: plan.id,
      amountCents: plan.price,
      currency: plan.currency,
    })
  ) {
    return current
  }

  assertCrewCheckoutCanStart(current)

  const claimPatch = buildCrewCheckoutClaimSnapshot(current, plan)
  const result = await getDb()
    .update(crewEventSettingsTable)
    .set({
      crewBillingState: claimPatch.state,
      crewBillingSource: claimPatch.source,
      crewBillingPlanId: claimPatch.planId,
      crewBillingAmountCents: claimPatch.amountCents,
      crewBillingCurrency: claimPatch.currency,
      crewStripeCheckoutSessionId: null,
      crewStripePaymentIntentId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(crewEventSettingsTable.competitionId, eventId),
        eq(crewEventSettingsTable.crewBillingState, current.state),
      ),
    )

  if (getAffectedRows(result) > 0) return claimPatch

  const latest = toCrewBillingSnapshot(await requireCrewBillingScope(eventId))
  if (
    isReusableCrewCheckoutPendingClaim({
      billing: latest,
      crewPlan: plan.id,
      amountCents: plan.price,
      currency: plan.currency,
    })
  ) {
    return latest
  }

  assertCrewCheckoutCanStart(latest)
  throw new Error("Crew Checkout could not start because billing changed.")
}

function buildCrewCheckoutClaimSnapshot(
  current: CrewBillingStateSnapshot,
  plan: CrewCheckoutCatalogPlan,
): CrewBillingStateSnapshot {
  return {
    ...current,
    state: CREW_BILLING_STATE.PENDING,
    source: CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
    planId: plan.id,
    amountCents: plan.price,
    currency: plan.currency,
    stripe: {
      ...current.stripe,
      checkoutSessionId: null,
      paymentIntentId: null,
    },
  }
}

function getAffectedRows(result: unknown) {
  return (
    (result as { rowsAffected?: number }).rowsAffected ??
    (result as { affectedRows?: number }).affectedRows ??
    (Array.isArray(result)
      ? (result[0] as { affectedRows?: number } | undefined)?.affectedRows
      : undefined) ??
    0
  )
}

async function persistCrewBillingAppend(
  data: GetCrewBillingInput,
  appendPlan: CrewBillingAppendPlan,
  options: {
    settingsText?: string | null
    paymentLinkReference?: string | null
    current?: CrewBillingStateSnapshot
  } = {},
) {
  if (appendPlan.action === "skip_duplicate") {
    if (
      options.settingsText !== undefined ||
      options.paymentLinkReference !== undefined
    ) {
      await updateCrewPaymentLinkSettings({
        eventId: data.eventId,
        settingsText: options.settingsText,
        paymentLinkReference:
          options.paymentLinkReference ??
          options.current?.stripe.paymentLinkId ??
          null,
      })
    }
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
          ...(options.settingsText !== undefined
            ? { settings: options.settingsText }
            : {}),
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

async function persistCrewCheckoutSessionCreated(
  data: GetCrewBillingInput,
  appendPlan: CrewBillingAppendPlan,
) {
  if (appendPlan.action === "skip_duplicate") return

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
    if (isCrewBillingDuplicateEntryError(error)) return
    throw error
  }
}

async function persistCrewCheckoutCompletedFromWebhook(
  data: CrewCheckoutWebhookCompletionInput,
  appendPlan: Extract<CrewBillingAppendPlan, { action: "append" }>,
): Promise<CompleteCrewCheckoutSessionFromWebhookResult> {
  const db = getDb()
  const { event, settingsPatch } = appendPlan

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(crewBillingEventsTable)
        .values(toNewCrewBillingEvent(event))
      const result = await tx
        .update(crewEventSettingsTable)
        .set({
          ...settingsPatch,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(crewEventSettingsTable.competitionId, data.eventId),
            eq(crewEventSettingsTable.id, data.crewEventSettingsId),
            eq(
              crewEventSettingsTable.crewBillingState,
              CREW_BILLING_STATE.PENDING,
            ),
            eq(
              crewEventSettingsTable.crewBillingSource,
              CREW_BILLING_SOURCE.STRIPE_CHECKOUT,
            ),
            or(
              isNull(crewEventSettingsTable.crewStripeCheckoutSessionId),
              eq(
                crewEventSettingsTable.crewStripeCheckoutSessionId,
                data.sessionId,
              ),
            ),
          ),
        )

      if (getAffectedRows(result) === 0) {
        throw new CrewCheckoutWebhookValidationError(
          "Crew Checkout billing state is no longer pending for this session.",
        )
      }
    })
  } catch (error) {
    if (isCrewBillingDuplicateEntryError(error)) {
      return { status: "duplicate" }
    }
    throw error
  }

  return { status: "completed" }
}

async function updateCrewPaymentLinkSettings({
  eventId,
  settingsText,
  paymentLinkReference,
}: {
  eventId: string
  settingsText?: string | null
  paymentLinkReference?: string | null
}) {
  if (settingsText === undefined && paymentLinkReference === undefined) return

  const db = getDb()
  await db
    .update(crewEventSettingsTable)
    .set({
      ...(settingsText !== undefined ? { settings: settingsText } : {}),
      ...(paymentLinkReference !== undefined
        ? { crewStripePaymentLinkId: paymentLinkReference }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(crewEventSettingsTable.competitionId, eventId))
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
      settingsId: crewEventSettingsTable.id,
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

  return session
}

async function requireCrewCheckoutPlan(planId: CrewCheckoutPlanId) {
  const db = getDb()
  const [plan] = await db
    .select({
      id: planTable.id,
      name: planTable.name,
      description: planTable.description,
      price: planTable.price,
      interval: planTable.interval,
      isActive: planTable.isActive,
      isPublic: planTable.isPublic,
    })
    .from(planTable)
    .where(and(eq(planTable.id, planId), eq(planTable.isActive, 1)))
    .limit(1)

  return normalizeCrewCheckoutCatalogPlan(plan ?? null)
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
    id: event.id ?? undefined,
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

function isCrewStripeCheckoutEnabled() {
  const runtimeEnv = env as typeof env & {
    CREW_STRIPE_CHECKOUT_ENABLED?: string | boolean
  }
  return isCrewStripeCheckoutEnabledValue(
    runtimeEnv.CREW_STRIPE_CHECKOUT_ENABLED,
  )
}
