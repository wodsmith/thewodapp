// @lat: [[crew#Crew Admin Shell]]
import { eq } from "drizzle-orm"
import { getDb } from "../db"
import { competitionsTable } from "../db/schemas/competitions"
import { crewEventSettingsTable } from "../db/schemas/crew-event-settings"
import { buildCrewBillingPageViewModel } from "../lib/crew/billing-page"
import { getCrewPaymentLinkUrlFromSettings } from "../lib/crew/payment-link-sales"
import { formatCrewValue } from "../lib/crew-event-display"
import {
  calculateSetupProgress,
  parseCrewSettings,
} from "../lib/crew-event-setup"
import { getCrewBillingPage } from "./crew-billing.server"
import { getCrewConversionAssistantPage } from "./crew-conversion.server"
import { listCrewEvents } from "./crew-event-settings.server"
import { requireLocalCrewOperatorAccess } from "./crew-local-access"
import { getCrewReadinessPage } from "./crew-readiness.server"
import { getCrewEventRosterShiftSummary } from "./crew-roster-shift.server"

export interface CrewAdminEventListItem {
  id: string
  name: string
  slug: string
  startDate: string
  endDate: string
  lifecycle: string
  conciergeStatus: string
  crewPlan: string
  setupProgress: {
    completed: number
    total: number
    percent: number
  }
  billingState: string
  billingPlanId: string | null
  sourcePlatform: string | null
}

export interface CrewAdminEventHeader {
  id: string
  name: string
  slug: string
  startDate: string
  endDate: string
  status: string
  visibility: string
  organizingTeamId: string
  competitionTeamId: string | null
  lifecycle: string
  conciergeStatus: string
  crewPlan: string
  crewOnly: boolean
}

export interface CrewAdminEventDetailView {
  event: CrewAdminEventHeader
  setup: {
    completed: number
    total: number
    percent: number
    desiredGoLiveDate: string | null
    staffingLead: string | null
    volunteerTarget: string | null
    sourceContact: string | null
    parseError: string | null
  }
  billing: {
    planId: string | null
    planLabel: string
    stateLabel: string
    sourceLabel: string
    amountLabel: string
    upgradeCreditLabel: string
    refundedLabel: string
    paymentLinkId: string | null
    checkoutSessionId: string | null
    paymentIntentId: string | null
    auditEventCount: number
  }
  source: {
    platform: string | null
    eventUrl: string | null
    externalRegistrationUrl: string | null
    acquisitionSource: string | null
  }
  readiness: {
    highestStatus: string
    ready: number
    total: number
    needsAttention: number
    blocked: number
    progressPercent: number
    nextAction: string
  }
  diagnostics: {
    setupChecks: string
    venuesAndLanes: string
    workoutsAndHeats: string
    imports: string
    roster: string
    shiftCoverage: string
    confirmations: string
    judgeVersions: number
  }
  operatorNotes: {
    assumptions: string
    internalNotes: string
  }
}

export type CrewAdminReadinessData = Awaited<
  ReturnType<typeof getCrewReadinessPage>
>

export type CrewAdminBillingData = Awaited<
  ReturnType<typeof getCrewBillingPage>
> & {
  viewModel: ReturnType<typeof buildCrewBillingPageViewModel>
}

export type CrewAdminConversionData = Awaited<
  ReturnType<typeof getCrewConversionAssistantPage>
>

export async function getCrewAdminEventList(): Promise<{
  events: CrewAdminEventListItem[]
}> {
  requireLocalCrewOperatorAccess("Crew admin")

  const { events } = await listCrewEvents()
  return {
    events: events.map((event) => {
      const setupProgress = calculateSetupProgress(
        parseCrewSettings(event.settings.settings).setup,
      )

      return {
        id: event.competition.id,
        name: event.competition.name,
        slug: event.competition.slug,
        startDate: event.competition.startDate,
        endDate: event.competition.endDate,
        lifecycle: event.settings.lifecycle,
        conciergeStatus: event.settings.conciergeStatus,
        crewPlan: event.settings.crewPlan,
        setupProgress,
        billingState: event.settings.crewBillingState,
        billingPlanId: event.settings.crewBillingPlanId,
        sourcePlatform: event.settings.sourcePlatform,
      }
    }),
  }
}

export async function getCrewAdminEventDetail(data: {
  eventId: string
}): Promise<{ view: CrewAdminEventDetailView }> {
  requireLocalCrewOperatorAccess("Crew admin")

  const event = await requireCrewAdminEvent(data.eventId)
  const [rosterShiftSummary, readiness, billing] = await Promise.all([
    getCrewEventRosterShiftSummary({ eventId: data.eventId }),
    getCrewReadinessPage({ eventId: data.eventId }),
    getCrewAdminBilling(data),
  ])
  const parsedSettings = parseCrewSettings(event.settingsText)
  const setupProgress = calculateSetupProgress(parsedSettings.setup)
  const readinessNextAction =
    readiness.readiness.items.find((item) => item.status === "blocked") ??
    readiness.readiness.items.find((item) => item.status === "needs_attention")

  return {
    view: {
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status,
        visibility: event.visibility,
        organizingTeamId: event.organizingTeamId,
        competitionTeamId: event.competitionTeamId,
        lifecycle: event.lifecycle,
        conciergeStatus: event.conciergeStatus,
        crewPlan: event.crewPlan,
        crewOnly: event.crewOnly,
      },
      setup: {
        completed: setupProgress.completed,
        total: setupProgress.total,
        percent: setupProgress.percent,
        desiredGoLiveDate: nullableText(parsedSettings.setup.desiredGoLiveDate),
        staffingLead: nullableText(parsedSettings.setup.staffingLead),
        volunteerTarget: nullableText(parsedSettings.setup.volunteerTarget),
        sourceContact: nullableText(
          [
            parsedSettings.setup.sourceContactName,
            parsedSettings.setup.sourceContactEmail,
          ]
            .filter(Boolean)
            .join(" | "),
        ),
        parseError: parsedSettings.parseError,
      },
      billing: {
        planId: billing.billing.planId,
        planLabel: billing.viewModel.plan.label,
        stateLabel: billing.viewModel.billing.stateLabel,
        sourceLabel: billing.viewModel.billing.sourceLabel,
        amountLabel: billing.viewModel.billing.amountLabel,
        upgradeCreditLabel: billing.viewModel.billing.upgradeCreditLabel,
        refundedLabel: billing.viewModel.billing.refundedLabel,
        paymentLinkId: billing.billing.stripe.paymentLinkId,
        checkoutSessionId: billing.billing.stripe.checkoutSessionId,
        paymentIntentId: billing.billing.stripe.paymentIntentId,
        auditEventCount: billing.auditEvents.length,
      },
      source: {
        platform: event.sourcePlatform,
        eventUrl: event.sourceEventUrl,
        externalRegistrationUrl: event.externalRegistrationUrl,
        acquisitionSource: event.acquisitionSource,
      },
      readiness: {
        highestStatus: readiness.readiness.summary.highestStatus,
        ready: readiness.readiness.summary.ready,
        total: readiness.readiness.summary.total,
        needsAttention: readiness.readiness.summary.needsAttention,
        blocked: readiness.readiness.summary.blocked,
        progressPercent: readiness.readiness.summary.progressPercent,
        nextAction: readinessNextAction
          ? `${readinessNextAction.label}: ${readinessNextAction.summary}`
          : "No blocking admin action found.",
      },
      diagnostics: {
        setupChecks: `${readiness.facts.setup.completed}/${readiness.facts.setup.total}`,
        venuesAndLanes: `${readiness.facts.venues.venueCount} / ${readiness.facts.venues.totalLaneCount}`,
        workoutsAndHeats: `${readiness.facts.schedule.workoutCount} / ${readiness.facts.schedule.heatCount}`,
        imports: `${readiness.facts.imports.appliedVolunteerImportCount}/${readiness.facts.imports.volunteerImportCount} volunteer, ${readiness.facts.imports.appliedHeatScheduleImportCount}/${readiness.facts.imports.heatScheduleImportCount} heat`,
        roster: `${rosterShiftSummary.rosterSummary.total} total, ${readiness.facts.roster.assignable} assignable`,
        shiftCoverage: `${rosterShiftSummary.shiftSummary.assignedSlots}/${rosterShiftSummary.shiftSummary.capacity}`,
        confirmations: `${rosterShiftSummary.shiftSummary.confirmationSummary.confirmed}/${rosterShiftSummary.shiftSummary.assignedSlots}`,
        judgeVersions: readiness.facts.judge.activeVersionCount,
      },
      operatorNotes: {
        assumptions:
          parsedSettings.setup.assumptions || "No assumptions recorded.",
        internalNotes:
          parsedSettings.setup.internalNotes || "No internal notes recorded.",
      },
    },
  }
}

export async function getCrewAdminReadiness(data: {
  eventId: string
}): Promise<CrewAdminReadinessData> {
  requireLocalCrewOperatorAccess("Crew admin readiness")
  return getCrewReadinessPage(data)
}

export async function getCrewAdminBilling(data: {
  eventId: string
}): Promise<CrewAdminBillingData> {
  requireLocalCrewOperatorAccess("Crew admin billing")

  const [billing, event] = await Promise.all([
    getCrewBillingPage(data),
    requireCrewAdminEvent(data.eventId),
  ])
  const paymentLinkUrl = getCrewPaymentLinkUrlFromSettings(event.settingsText)

  return {
    ...billing,
    viewModel: buildCrewBillingPageViewModel({
      billing: billing.billing,
      paymentLink: {
        id: billing.billing.stripe.paymentLinkId,
        url: paymentLinkUrl,
      },
      checkoutEnabled: false,
    }),
  }
}

export async function getCrewAdminConversion(data: {
  eventId: string
}): Promise<CrewAdminConversionData> {
  requireLocalCrewOperatorAccess("Crew admin conversion")
  return getCrewConversionAssistantPage(data)
}

async function requireCrewAdminEvent(eventId: string) {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      slug: competitionsTable.slug,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
      status: competitionsTable.status,
      visibility: competitionsTable.visibility,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
      crewOnly: crewEventSettingsTable.crewOnly,
      lifecycle: crewEventSettingsTable.lifecycle,
      conciergeStatus: crewEventSettingsTable.conciergeStatus,
      crewPlan: crewEventSettingsTable.crewPlan,
      sourcePlatform: crewEventSettingsTable.sourcePlatform,
      sourceEventUrl: crewEventSettingsTable.sourceEventUrl,
      externalRegistrationUrl: crewEventSettingsTable.externalRegistrationUrl,
      acquisitionSource: crewEventSettingsTable.acquisitionSource,
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

  return event
}

function nullableText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function formatCrewAdminValue(value: string | null | undefined) {
  return value ? formatCrewValue(value) : "Not set"
}
