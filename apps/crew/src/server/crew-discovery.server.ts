// @lat: [[crew#Regional Judge Discovery Pilot]]
import { env } from "cloudflare:workers"
import { and, desc, eq, gt, inArray, isNull, ne, or } from "drizzle-orm"
import { getDb } from "../db"
import { addressesTable } from "../db/schemas/addresses"
import { competitionsTable } from "../db/schemas/competitions"
import { createCrewVolunteerIntroRequestId } from "../db/schemas/common"
import {
  CREW_VOLUNTEER_CONSENT_SCOPE,
  CREW_VOLUNTEER_CONSENT_STATUS,
  CREW_VOLUNTEER_CREDENTIAL_STATUS,
  CREW_VOLUNTEER_DISCOVERY_AGE_STATUS,
  CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE,
  CREW_VOLUNTEER_IDENTITY_SOURCE,
  CREW_VOLUNTEER_IDENTITY_STATUS,
  CREW_VOLUNTEER_INTRO_REQUEST_STATUS,
  crewVolunteerConsentsTable,
  crewVolunteerCredentialsTable,
  crewVolunteerHistoryEventsTable,
  crewVolunteerIdentitiesTable,
  crewVolunteerIntroRequestsTable,
} from "../db/schemas/crew-volunteer-intelligence"
import type { VolunteerRoleType } from "../db/schemas/volunteers"
import {
  buildCrewRegionalJudgeDiscoveryViewModel,
  buildCrewRegionalJudgeIntroRequestView,
  crewRegionalJudgeDiscoveryRoleTypes,
  resolveCrewRegionalJudgeDiscoveryGate,
  type CrewRegionalJudgeDiscoveryViewModel,
  type CrewRegionalJudgeIntroRequestView,
} from "../lib/crew/regional-judge-discovery"
import { getSessionFromCookie } from "../utils/auth"
import {
  requireCrewDepartmentLeadEvent,
  requireCrewDepartmentLeadFullAccess,
  type CrewDepartmentLeadEvent,
} from "./crew-department-lead.server"

type CrewDiscoveryRuntimeEnv = typeof env & {
  CREW_REGIONAL_JUDGE_DISCOVERY_ENABLED?: string | boolean
}

export interface CrewRegionalJudgeDiscoveryPageData {
  viewModel: CrewRegionalJudgeDiscoveryViewModel
}

export interface CrewRegionalJudgeIntroRequestResult {
  success: true
  request: CrewRegionalJudgeIntroRequestView
}

export async function getCrewRegionalJudgeDiscoveryPage(data: {
  eventId: string
}): Promise<CrewRegionalJudgeDiscoveryPageData> {
  const scope = await requireCrewRegionalJudgeDiscoveryScope(data.eventId)
  const gate = getCrewRegionalJudgeDiscoveryGate()

  if (!gate.enabled) {
    return {
      viewModel: buildCrewRegionalJudgeDiscoveryViewModel({
        gate,
        requestingTeamId: scope.organizingTeamId,
        currentCompetitionId: scope.id,
        identities: [],
        consents: [],
        historyEvents: [],
        credentials: [],
      }),
    }
  }

  const viewModel = await loadCrewRegionalJudgeDiscoveryView(scope)
  return { viewModel }
}

export async function requestCrewRegionalJudgeIntro(data: {
  eventId: string
  candidateId: string
  requestedRoleType?: VolunteerRoleType | null
}): Promise<CrewRegionalJudgeIntroRequestResult> {
  const scope = await requireCrewRegionalJudgeDiscoveryScope(data.eventId)
  const gate = getCrewRegionalJudgeDiscoveryGate()
  if (!gate.enabled) {
    throw new Error(
      "Regional judge discovery is disabled. No intro request was recorded.",
    )
  }

  const viewModel = await loadCrewRegionalJudgeDiscoveryView(scope)
  const candidate = viewModel.candidates.find(
    (item) => item.candidateId === data.candidateId,
  )
  if (!candidate) {
    throw new Error("That regional judge candidate is no longer eligible.")
  }

  const activeConsent = await findActiveDiscoveryConsentForCandidate({
    scope,
    candidateId: data.candidateId,
  })
  if (!activeConsent) {
    throw new Error("That regional judge candidate is no longer eligible.")
  }

  const db = getDb()
  const [existing] = await db
    .select({
      id: crewVolunteerIntroRequestsTable.id,
      status: crewVolunteerIntroRequestsTable.status,
    })
    .from(crewVolunteerIntroRequestsTable)
    .where(
      and(
        eq(
          crewVolunteerIntroRequestsTable.requestingTeamId,
          scope.organizingTeamId,
        ),
        eq(crewVolunteerIntroRequestsTable.requestingCompetitionId, scope.id),
        eq(
          crewVolunteerIntroRequestsTable.volunteerIdentityId,
          data.candidateId,
        ),
        eq(
          crewVolunteerIntroRequestsTable.status,
          CREW_VOLUNTEER_INTRO_REQUEST_STATUS.PENDING,
        ),
      ),
    )
    .orderBy(desc(crewVolunteerIntroRequestsTable.requestedAt))
    .limit(1)

  if (existing) {
    return {
      success: true,
      request: buildCrewRegionalJudgeIntroRequestView({
        requestId: existing.id,
        status: existing.status,
        outcome: "existing",
      }),
    }
  }

  const session = await getSessionFromCookie().catch(() => null)
  const now = new Date()
  const requestId = createCrewVolunteerIntroRequestId()
  await db.insert(crewVolunteerIntroRequestsTable).values({
    id: requestId,
    requestingTeamId: scope.organizingTeamId,
    requestingCompetitionId: scope.id,
    volunteerIdentityId: data.candidateId,
    discoveryConsentId: activeConsent.consentId,
    requestedRoleType:
      data.requestedRoleType ?? candidate.roleTypes[0] ?? "judge",
    startsAt: null,
    endsAt: null,
    status: CREW_VOLUNTEER_INTRO_REQUEST_STATUS.PENDING,
    requestedByUserId: session?.userId ?? null,
    requestedAt: now,
    respondedByUserId: null,
    respondedAt: null,
    expiresAt: null,
    resultInvitationId: null,
    resultMembershipId: null,
    createdAt: now,
    updatedAt: now,
  })

  return {
    success: true,
    request: buildCrewRegionalJudgeIntroRequestView({
      requestId,
      status: CREW_VOLUNTEER_INTRO_REQUEST_STATUS.PENDING,
      outcome: "created",
    }),
  }
}

async function requireCrewRegionalJudgeDiscoveryScope(eventId: string) {
  const event = await requireCrewDepartmentLeadEvent(eventId)
  await requireCrewDepartmentLeadFullAccess(event)
  return event
}

async function loadCrewRegionalJudgeDiscoveryView(
  scope: CrewDepartmentLeadEvent,
) {
  const gate = getCrewRegionalJudgeDiscoveryGate()
  const db = getDb()
  const now = new Date()
  const identityConsentRows = await db
    .select({
      identity: {
        id: crewVolunteerIdentitiesTable.id,
        teamId: crewVolunteerIdentitiesTable.teamId,
        identitySource: crewVolunteerIdentitiesTable.identitySource,
        discoveryAgeStatus: crewVolunteerIdentitiesTable.discoveryAgeStatus,
        status: crewVolunteerIdentitiesTable.status,
      },
      consent: {
        id: crewVolunteerConsentsTable.id,
        identityId: crewVolunteerConsentsTable.identityId,
        teamId: crewVolunteerConsentsTable.teamId,
        scope: crewVolunteerConsentsTable.scope,
        status: crewVolunteerConsentsTable.status,
        grantedAt: crewVolunteerConsentsTable.grantedAt,
        revokedAt: crewVolunteerConsentsTable.revokedAt,
        supersededByConsentId: crewVolunteerConsentsTable.supersededByConsentId,
      },
    })
    .from(crewVolunteerIdentitiesTable)
    .innerJoin(
      crewVolunteerConsentsTable,
      and(
        eq(
          crewVolunteerConsentsTable.identityId,
          crewVolunteerIdentitiesTable.id,
        ),
        eq(
          crewVolunteerConsentsTable.teamId,
          crewVolunteerIdentitiesTable.teamId,
        ),
      ),
    )
    .where(
      and(
        ne(crewVolunteerIdentitiesTable.teamId, scope.organizingTeamId),
        eq(
          crewVolunteerIdentitiesTable.status,
          CREW_VOLUNTEER_IDENTITY_STATUS.ACTIVE,
        ),
        ne(
          crewVolunteerIdentitiesTable.identitySource,
          CREW_VOLUNTEER_IDENTITY_SOURCE.IMPORT,
        ),
        eq(
          crewVolunteerIdentitiesTable.discoveryAgeStatus,
          CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.ADULT_CONFIRMED,
        ),
        eq(
          crewVolunteerConsentsTable.scope,
          CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY,
        ),
        eq(
          crewVolunteerConsentsTable.status,
          CREW_VOLUNTEER_CONSENT_STATUS.GRANTED,
        ),
        isNull(crewVolunteerConsentsTable.revokedAt),
        isNull(crewVolunteerConsentsTable.supersededByConsentId),
      ),
    )
    .orderBy(desc(crewVolunteerConsentsTable.grantedAt))
    .limit(250)

  const identitiesById = new Map(
    identityConsentRows.map((row) => [row.identity.id, row.identity]),
  )
  const identities = [...identitiesById.values()]
  const identityIds = [...identitiesById.keys()]
  if (identityIds.length === 0) {
    return buildCrewRegionalJudgeDiscoveryViewModel({
      gate,
      requestingTeamId: scope.organizingTeamId,
      currentCompetitionId: scope.id,
      identities: [],
      consents: [],
      historyEvents: [],
      credentials: [],
      now,
    })
  }

  const [historyRows, credentialRows, introRequests] = await Promise.all([
    db
      .select({
        identityId: crewVolunteerHistoryEventsTable.identityId,
        teamId: crewVolunteerHistoryEventsTable.teamId,
        competitionId: crewVolunteerHistoryEventsTable.competitionId,
        competitionName: competitionsTable.name,
        eventType: crewVolunteerHistoryEventsTable.eventType,
        visibilityScope: crewVolunteerHistoryEventsTable.visibilityScope,
        roleType: crewVolunteerHistoryEventsTable.roleType,
        occurredAt: crewVolunteerHistoryEventsTable.occurredAt,
        stateProvince: addressesTable.stateProvince,
        countryCode: addressesTable.countryCode,
        timezone: competitionsTable.timezone,
      })
      .from(crewVolunteerHistoryEventsTable)
      .leftJoin(
        competitionsTable,
        eq(crewVolunteerHistoryEventsTable.competitionId, competitionsTable.id),
      )
      .leftJoin(
        addressesTable,
        eq(competitionsTable.primaryAddressId, addressesTable.id),
      )
      .where(
        and(
          inArray(crewVolunteerHistoryEventsTable.identityId, identityIds),
          eq(
            crewVolunteerHistoryEventsTable.visibilityScope,
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.CONSENTED_INTRO,
          ),
        ),
      ),
    db
      .select({
        identityId: crewVolunteerCredentialsTable.identityId,
        teamId: crewVolunteerCredentialsTable.teamId,
        credentialType: crewVolunteerCredentialsTable.credentialType,
        credentialLabel: crewVolunteerCredentialsTable.credentialLabel,
        status: crewVolunteerCredentialsTable.status,
        visibilityScope: crewVolunteerCredentialsTable.visibilityScope,
        expiresAt: crewVolunteerCredentialsTable.expiresAt,
        revokedAt: crewVolunteerCredentialsTable.revokedAt,
      })
      .from(crewVolunteerCredentialsTable)
      .where(
        and(
          inArray(crewVolunteerCredentialsTable.identityId, identityIds),
          eq(
            crewVolunteerCredentialsTable.visibilityScope,
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.CONSENTED_INTRO,
          ),
          inArray(crewVolunteerCredentialsTable.status, [
            CREW_VOLUNTEER_CREDENTIAL_STATUS.SELF_REPORTED,
            CREW_VOLUNTEER_CREDENTIAL_STATUS.VERIFIED,
          ]),
          isNull(crewVolunteerCredentialsTable.revokedAt),
          or(
            isNull(crewVolunteerCredentialsTable.expiresAt),
            gt(crewVolunteerCredentialsTable.expiresAt, now),
          ),
        ),
      ),
    db
      .select({
        id: crewVolunteerIntroRequestsTable.id,
        volunteerIdentityId:
          crewVolunteerIntroRequestsTable.volunteerIdentityId,
        status: crewVolunteerIntroRequestsTable.status,
        requestedAt: crewVolunteerIntroRequestsTable.requestedAt,
      })
      .from(crewVolunteerIntroRequestsTable)
      .where(
        and(
          eq(
            crewVolunteerIntroRequestsTable.requestingTeamId,
            scope.organizingTeamId,
          ),
          eq(crewVolunteerIntroRequestsTable.requestingCompetitionId, scope.id),
          inArray(
            crewVolunteerIntroRequestsTable.volunteerIdentityId,
            identityIds,
          ),
          eq(
            crewVolunteerIntroRequestsTable.status,
            CREW_VOLUNTEER_INTRO_REQUEST_STATUS.PENDING,
          ),
        ),
      ),
  ])

  return buildCrewRegionalJudgeDiscoveryViewModel({
    gate,
    requestingTeamId: scope.organizingTeamId,
    currentCompetitionId: scope.id,
    identities,
    consents: identityConsentRows.map((row) => row.consent),
    historyEvents: historyRows.map((row) => ({
      identityId: row.identityId,
      teamId: row.teamId,
      competitionId: row.competitionId,
      competitionName: row.competitionName,
      eventType: row.eventType,
      visibilityScope: row.visibilityScope,
      roleType: row.roleType,
      occurredAt: row.occurredAt,
      regionLabel: formatRegionalDiscoveryRegion(row),
    })),
    credentials: credentialRows,
    introRequests,
    requestedRoleTypes: crewRegionalJudgeDiscoveryRoleTypes,
    now,
  })
}

async function findActiveDiscoveryConsentForCandidate({
  scope,
  candidateId,
}: {
  scope: CrewDepartmentLeadEvent
  candidateId: string
}) {
  const db = getDb()
  const [row] = await db
    .select({
      identityId: crewVolunteerIdentitiesTable.id,
      consentId: crewVolunteerConsentsTable.id,
    })
    .from(crewVolunteerIdentitiesTable)
    .innerJoin(
      crewVolunteerConsentsTable,
      and(
        eq(
          crewVolunteerConsentsTable.identityId,
          crewVolunteerIdentitiesTable.id,
        ),
        eq(
          crewVolunteerConsentsTable.teamId,
          crewVolunteerIdentitiesTable.teamId,
        ),
      ),
    )
    .where(
      and(
        eq(crewVolunteerIdentitiesTable.id, candidateId),
        ne(crewVolunteerIdentitiesTable.teamId, scope.organizingTeamId),
        eq(
          crewVolunteerIdentitiesTable.status,
          CREW_VOLUNTEER_IDENTITY_STATUS.ACTIVE,
        ),
        ne(
          crewVolunteerIdentitiesTable.identitySource,
          CREW_VOLUNTEER_IDENTITY_SOURCE.IMPORT,
        ),
        eq(
          crewVolunteerIdentitiesTable.discoveryAgeStatus,
          CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.ADULT_CONFIRMED,
        ),
        eq(
          crewVolunteerConsentsTable.scope,
          CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY,
        ),
        eq(
          crewVolunteerConsentsTable.status,
          CREW_VOLUNTEER_CONSENT_STATUS.GRANTED,
        ),
        isNull(crewVolunteerConsentsTable.revokedAt),
        isNull(crewVolunteerConsentsTable.supersededByConsentId),
      ),
    )
    .orderBy(desc(crewVolunteerConsentsTable.grantedAt))
    .limit(1)

  return row ?? null
}

function getCrewRegionalJudgeDiscoveryGate() {
  const runtimeEnv = env as CrewDiscoveryRuntimeEnv
  return resolveCrewRegionalJudgeDiscoveryGate(
    runtimeEnv.CREW_REGIONAL_JUDGE_DISCOVERY_ENABLED,
  )
}

function formatRegionalDiscoveryRegion(row: {
  stateProvince: string | null
  countryCode: string | null
  timezone: string | null
}) {
  const parts = [row.stateProvince, row.countryCode]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
  if (parts.length > 0) return parts.join(", ")
  return row.timezone?.replaceAll("_", " ") ?? null
}
