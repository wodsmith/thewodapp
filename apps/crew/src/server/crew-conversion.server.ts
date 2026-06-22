// @lat: [[crew#Full WODsmith Conversion Assistant]]
import { and, count, eq, gt } from "drizzle-orm"
import { getDb } from "../db"
import {
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "../db/schemas/competitions"
import { competitionDivisionsTable } from "../db/schemas/commerce"
import { crewEventSettingsTable } from "../db/schemas/crew-event-settings"
import {
  crewEventConversionsTable,
  type CrewEventConversionStatus,
} from "../db/schemas/crew-volunteer-intelligence"
import { teamTable } from "../db/schemas/teams"
import { waiversTable } from "../db/schemas/waivers"
import {
  buildCrewConversionAssistantViewModel,
  type CrewConversionAssistantViewModel,
} from "../lib/crew/conversion-assistant"
import { getSiteUrl } from "../lib/env"
import { getCrewEvent } from "./crew-event-settings.server"
import { getCrewReadinessPage } from "./crew-readiness.server"

export interface CrewConversionAssistantPageData {
  viewModel: CrewConversionAssistantViewModel
}

export async function getCrewConversionAssistantPage(data: {
  eventId: string
}): Promise<CrewConversionAssistantPageData> {
  const [{ event }, readiness] = await Promise.all([
    getCrewEvent({ eventId: data.eventId }),
    getCrewReadinessPage({ eventId: data.eventId }),
  ])

  if (!event) {
    throw new Error("Crew event not found")
  }

  const [fullEvent, counts, conversionStatus] = await Promise.all([
    loadCrewConversionEvent(data.eventId),
    loadCrewConversionCounts(data.eventId),
    loadCrewConversionStatus(data.eventId),
  ])

  if (!fullEvent) {
    throw new Error("Crew event not found")
  }

  const links = buildCrewConversionLinks({
    eventId: fullEvent.id,
    slug: fullEvent.slug,
    teamSlug: fullEvent.teamSlug,
    wodsmithBaseUrl: getSiteUrl(),
  })

  return {
    viewModel: buildCrewConversionAssistantViewModel({
      event: {
        id: fullEvent.id,
        name: fullEvent.name,
        slug: fullEvent.slug,
        crewOnly: fullEvent.crewOnly,
        status: fullEvent.status,
        visibility: fullEvent.visibility,
        registrationOpensAt: fullEvent.registrationOpensAt,
        registrationClosesAt: fullEvent.registrationClosesAt,
        defaultRegistrationFeeCents: fullEvent.defaultRegistrationFeeCents ?? 0,
        settings: fullEvent.settings,
      },
      team: {
        slug: fullEvent.teamSlug,
        stripeAccountStatus: fullEvent.stripeAccountStatus,
      },
      counts,
      readiness,
      billing: {
        state: fullEvent.crewBillingState,
        planId: fullEvent.crewBillingPlanId,
        creditCents: fullEvent.crewCreditCents,
        fullPlatformCreditCents: fullEvent.fullPlatformCreditCents,
      },
      conversionStatus,
      links,
    }),
  }
}

async function loadCrewConversionEvent(eventId: string) {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      slug: competitionsTable.slug,
      status: competitionsTable.status,
      visibility: competitionsTable.visibility,
      registrationOpensAt: competitionsTable.registrationOpensAt,
      registrationClosesAt: competitionsTable.registrationClosesAt,
      defaultRegistrationFeeCents:
        competitionsTable.defaultRegistrationFeeCents,
      settings: competitionsTable.settings,
      teamSlug: teamTable.slug,
      stripeAccountStatus: teamTable.stripeAccountStatus,
      crewOnly: crewEventSettingsTable.crewOnly,
      crewBillingState: crewEventSettingsTable.crewBillingState,
      crewBillingPlanId: crewEventSettingsTable.crewBillingPlanId,
      crewCreditCents: crewEventSettingsTable.crewCreditCents,
      fullPlatformCreditCents: crewEventSettingsTable.fullPlatformCreditCents,
    })
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .innerJoin(teamTable, eq(competitionsTable.organizingTeamId, teamTable.id))
    .where(eq(crewEventSettingsTable.competitionId, eventId))
    .limit(1)

  return event ?? null
}

async function loadCrewConversionCounts(competitionId: string) {
  const db = getDb()
  const [
    divisionRows,
    divisionFeeRows,
    athleteWaiverRows,
    activeRegistrationRows,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(competitionDivisionsTable)
      .where(eq(competitionDivisionsTable.competitionId, competitionId)),
    db
      .select({ count: count() })
      .from(competitionDivisionsTable)
      .where(
        and(
          eq(competitionDivisionsTable.competitionId, competitionId),
          gt(competitionDivisionsTable.feeCents, 0),
        ),
      ),
    db
      .select({ count: count() })
      .from(waiversTable)
      .where(
        and(
          eq(waiversTable.competitionId, competitionId),
          eq(waiversTable.required, true),
        ),
      ),
    db
      .select({ count: count() })
      .from(competitionRegistrationsTable)
      .where(
        and(
          eq(competitionRegistrationsTable.eventId, competitionId),
          eq(competitionRegistrationsTable.status, REGISTRATION_STATUS.ACTIVE),
        ),
      ),
  ])

  return {
    divisionCount: divisionRows[0]?.count ?? 0,
    divisionFeeCount: divisionFeeRows[0]?.count ?? 0,
    paidDivisionCount: divisionFeeRows[0]?.count ?? 0,
    athleteWaiverCount: athleteWaiverRows[0]?.count ?? 0,
    activeRegistrationCount: activeRegistrationRows[0]?.count ?? 0,
  }
}

async function loadCrewConversionStatus(
  competitionId: string,
): Promise<CrewEventConversionStatus | null> {
  const db = getDb()
  const [conversion] = await db
    .select({ status: crewEventConversionsTable.status })
    .from(crewEventConversionsTable)
    .where(eq(crewEventConversionsTable.competitionId, competitionId))
    .limit(1)

  return conversion?.status ?? null
}

function buildCrewConversionLinks({
  eventId,
  slug,
  teamSlug,
  wodsmithBaseUrl,
}: {
  eventId: string
  slug: string
  teamSlug: string
  wodsmithBaseUrl: string
}) {
  const base = trimTrailingSlash(wodsmithBaseUrl)
  const organizer = `${base}/compete/organizer/${eventId}`
  const publicCompetition = `${base}/compete/${slug}`

  return {
    crewEvent: `/events/${eventId}`,
    crewSetup: `/events/${eventId}/setup`,
    crewImports: `/events/${eventId}/imports`,
    crewVolunteers: `/events/${eventId}/volunteers`,
    crewShifts: `/events/${eventId}/shifts`,
    crewJudges: `/events/${eventId}/judges`,
    crewBilling: `/events/${eventId}/billing`,
    wodsmithOverview: organizer,
    wodsmithDivisions: `${organizer}/divisions`,
    wodsmithEdit: `${organizer}/edit`,
    wodsmithPricing: `${organizer}/pricing`,
    wodsmithScoring: `${organizer}/scoring`,
    wodsmithWaivers: `${organizer}/waivers`,
    wodsmithRevenue: `${organizer}/revenue`,
    wodsmithPayouts: `${base}/compete/organizer/settings/payouts/${teamSlug}?returnTo=${encodeURIComponent(`${organizer}/revenue`)}`,
    publicPage: publicCompetition,
    athleteRegistration: `${publicCompetition}/register`,
  }
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value
}
