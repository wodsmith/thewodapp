// @lat: [[crew#Regional Judge Discovery Pilot]]
import {
  CREW_VOLUNTEER_CONSENT_SCOPE,
  CREW_VOLUNTEER_CONSENT_STATUS,
  CREW_VOLUNTEER_CREDENTIAL_STATUS,
  CREW_VOLUNTEER_CREDENTIAL_TYPE,
  CREW_VOLUNTEER_DISCOVERY_AGE_STATUS,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE,
  CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE,
  CREW_VOLUNTEER_IDENTITY_SOURCE,
  CREW_VOLUNTEER_IDENTITY_STATUS,
  CREW_VOLUNTEER_INTRO_REQUEST_STATUS,
  type CrewVolunteerConsentScope,
  type CrewVolunteerConsentStatus,
  type CrewVolunteerCredentialStatus,
  type CrewVolunteerCredentialType,
  type CrewVolunteerDiscoveryAgeStatus,
  type CrewVolunteerHistoryEventType,
  type CrewVolunteerHistoryVisibilityScope,
  type CrewVolunteerIdentitySource,
  type CrewVolunteerIdentityStatus,
  type CrewVolunteerIntroRequestStatus,
} from "../../db/schemas/crew-volunteer-intelligence"
import type { VolunteerRoleType } from "../../db/schemas/volunteers"

export const CREW_REGIONAL_JUDGE_DISCOVERY_FLAG =
  "CREW_REGIONAL_JUDGE_DISCOVERY_ENABLED"

export const crewRegionalJudgeDiscoveryRoleTypes = [
  "judge",
  "head_judge",
] satisfies VolunteerRoleType[]

const crewRegionalJudgeDiscoveryRoleTypeSet = new Set<VolunteerRoleType>(
  crewRegionalJudgeDiscoveryRoleTypes,
)

export interface CrewRegionalJudgeDiscoveryIdentityRecord {
  id: string
  teamId: string
  identitySource: CrewVolunteerIdentitySource
  discoveryAgeStatus: CrewVolunteerDiscoveryAgeStatus
  status: CrewVolunteerIdentityStatus
}

export interface CrewRegionalJudgeDiscoveryConsentRecord {
  id: string
  identityId: string
  teamId: string
  scope: CrewVolunteerConsentScope
  status: CrewVolunteerConsentStatus
  grantedAt: Date | string
  revokedAt?: Date | string | null
  supersededByConsentId?: string | null
}

export interface CrewRegionalJudgeDiscoveryHistoryRecord {
  identityId: string
  teamId: string
  competitionId: string | null
  competitionName: string | null
  eventType: CrewVolunteerHistoryEventType
  visibilityScope: CrewVolunteerHistoryVisibilityScope
  roleType: VolunteerRoleType | null
  occurredAt: Date | string
  regionLabel?: string | null
}

export interface CrewRegionalJudgeDiscoveryCredentialRecord {
  identityId: string
  teamId: string
  credentialType: CrewVolunteerCredentialType
  credentialLabel: string
  status: CrewVolunteerCredentialStatus
  visibilityScope: CrewVolunteerHistoryVisibilityScope
  expiresAt?: Date | string | null
  revokedAt?: Date | string | null
}

export interface CrewRegionalJudgeDiscoveryIntroRequestRecord {
  id: string
  volunteerIdentityId: string
  status: CrewVolunteerIntroRequestStatus
  requestedAt: Date | string
}

export interface CrewRegionalJudgeDiscoveryGate {
  enabled: boolean
  flagName: typeof CREW_REGIONAL_JUDGE_DISCOVERY_FLAG
  disabledReason: string | null
}

export interface CrewRegionalJudgeDiscoveryCandidate {
  candidateId: string
  displayLabel: string
  regionLabel: string
  availabilitySummary: string
  roleTypes: VolunteerRoleType[]
  credentialSummary: Array<{
    credentialType: CrewVolunteerCredentialType
    credentialLabel: string
    status: Extract<CrewVolunteerCredentialStatus, "self_reported" | "verified">
  }>
  factualHistory: {
    priorEventCount: number
    assignedCount: number
    confirmedCount: number
    completedCount: number
    lastActivityAt: string | null
  }
  introRequest: {
    id: string
    status: Extract<CrewVolunteerIntroRequestStatus, "pending">
    requestedAt: string
    directContactShared: false
  } | null
}

export interface CrewRegionalJudgeDiscoveryViewModel {
  gate: CrewRegionalJudgeDiscoveryGate
  summary: {
    candidateCount: number
    pendingIntroRequestCount: number
    safeCredentialCount: number
  }
  candidates: CrewRegionalJudgeDiscoveryCandidate[]
  notices: string[]
}

export interface CrewRegionalJudgeDiscoveryInput {
  gate: CrewRegionalJudgeDiscoveryGate
  requestingTeamId: string
  currentCompetitionId: string
  identities: CrewRegionalJudgeDiscoveryIdentityRecord[]
  consents: CrewRegionalJudgeDiscoveryConsentRecord[]
  historyEvents: CrewRegionalJudgeDiscoveryHistoryRecord[]
  credentials: CrewRegionalJudgeDiscoveryCredentialRecord[]
  introRequests?: CrewRegionalJudgeDiscoveryIntroRequestRecord[]
  requestedRoleTypes?: VolunteerRoleType[]
  maxResults?: number
  now?: Date | string
}

export interface CrewRegionalJudgeIntroRequestView {
  requestId: string
  status: CrewVolunteerIntroRequestStatus
  outcome: "created" | "existing"
  directContactShared: false
  contactReveal: "deferred_until_volunteer_accepts"
}

const discoverableHistoryEventTypes = new Set<CrewVolunteerHistoryEventType>([
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.SIGNED_UP,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.ASSIGNED,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.COMPLETED,
])

const safeCredentialStatuses = new Set<CrewVolunteerCredentialStatus>([
  CREW_VOLUNTEER_CREDENTIAL_STATUS.SELF_REPORTED,
  CREW_VOLUNTEER_CREDENTIAL_STATUS.VERIFIED,
])

export function resolveCrewRegionalJudgeDiscoveryGate(
  value: unknown,
): CrewRegionalJudgeDiscoveryGate {
  const enabled = isCrewRegionalJudgeDiscoveryEnabledValue(value)
  return {
    enabled,
    flagName: CREW_REGIONAL_JUDGE_DISCOVERY_FLAG,
    disabledReason: enabled
      ? null
      : `${CREW_REGIONAL_JUDGE_DISCOVERY_FLAG} must be explicitly enabled before regional judge discovery returns candidates or records intro requests.`,
  }
}

export function isCrewRegionalJudgeDiscoveryEnabledValue(value: unknown) {
  return (
    value === true ||
    ["1", "true", "yes", "enabled"].includes(String(value ?? "").toLowerCase())
  )
}

export function buildCrewRegionalJudgeDiscoveryViewModel({
  gate,
  requestingTeamId,
  currentCompetitionId,
  identities,
  consents,
  historyEvents,
  credentials,
  introRequests = [],
  requestedRoleTypes = crewRegionalJudgeDiscoveryRoleTypes,
  maxResults = 25,
  now = new Date(),
}: CrewRegionalJudgeDiscoveryInput): CrewRegionalJudgeDiscoveryViewModel {
  if (!gate.enabled) {
    return {
      gate,
      summary: {
        candidateCount: 0,
        pendingIntroRequestCount: 0,
        safeCredentialCount: 0,
      },
      candidates: [],
      notices: disabledNotices(gate),
    }
  }

  const nowMs = toTime(now)
  const requestedRoles = new Set(requestedRoleTypes)
  const candidates = identities
    .flatMap((identity) =>
      buildDiscoveryCandidate({
        identity,
        requestingTeamId,
        currentCompetitionId,
        consents,
        historyEvents,
        credentials,
        introRequests,
        requestedRoles,
        nowMs,
      }),
    )
    .sort(compareCandidates)
    .slice(0, maxResults)
    .map((candidate, index) => ({
      ...candidate,
      displayLabel: `${candidate.roleTypes.includes("head_judge") ? "Opted-in head judge" : "Opted-in judge"} ${index + 1}`,
    }))

  return {
    gate,
    summary: {
      candidateCount: candidates.length,
      pendingIntroRequestCount: candidates.filter(
        (candidate) => candidate.introRequest?.status === "pending",
      ).length,
      safeCredentialCount: candidates.reduce(
        (total, candidate) => total + candidate.credentialSummary.length,
        0,
      ),
    },
    candidates,
    notices: [
      "Regional discovery is opt-in and blind: direct contact stays hidden until a later volunteer acceptance flow exists.",
      "Results use consented regional facts only and exclude raw contact details, private notes, billing data, public reputation labels, and negative badges.",
    ],
  }
}

export function buildCrewRegionalJudgeIntroRequestView({
  requestId,
  status,
  outcome,
}: {
  requestId: string
  status: CrewVolunteerIntroRequestStatus
  outcome: "created" | "existing"
}): CrewRegionalJudgeIntroRequestView {
  return {
    requestId,
    status,
    outcome,
    directContactShared: false,
    contactReveal: "deferred_until_volunteer_accepts",
  }
}

export function resolveCrewRegionalJudgeIntroRequestedRole({
  requestedRoleType,
  eligibleRoleTypes,
}: {
  requestedRoleType?: VolunteerRoleType | null
  eligibleRoleTypes: VolunteerRoleType[]
}): VolunteerRoleType | null {
  const eligibleRegionalRoleTypes = eligibleRoleTypes.filter((roleType) =>
    crewRegionalJudgeDiscoveryRoleTypeSet.has(roleType),
  )
  if (requestedRoleType == null) {
    return eligibleRegionalRoleTypes[0] ?? null
  }
  return eligibleRegionalRoleTypes.includes(requestedRoleType)
    ? requestedRoleType
    : null
}

function buildDiscoveryCandidate({
  identity,
  requestingTeamId,
  currentCompetitionId,
  consents,
  historyEvents,
  credentials,
  introRequests,
  requestedRoles,
  nowMs,
}: {
  identity: CrewRegionalJudgeDiscoveryIdentityRecord
  requestingTeamId: string
  currentCompetitionId: string
  consents: CrewRegionalJudgeDiscoveryConsentRecord[]
  historyEvents: CrewRegionalJudgeDiscoveryHistoryRecord[]
  credentials: CrewRegionalJudgeDiscoveryCredentialRecord[]
  introRequests: CrewRegionalJudgeDiscoveryIntroRequestRecord[]
  requestedRoles: Set<VolunteerRoleType>
  nowMs: number
}): CrewRegionalJudgeDiscoveryCandidate[] {
  if (identity.teamId === requestingTeamId) return []
  if (identity.status !== CREW_VOLUNTEER_IDENTITY_STATUS.ACTIVE) return []
  if (identity.identitySource === CREW_VOLUNTEER_IDENTITY_SOURCE.IMPORT) {
    return []
  }
  if (
    identity.discoveryAgeStatus !==
    CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.ADULT_CONFIRMED
  ) {
    return []
  }

  const activeConsent = findActiveRegionalDiscoveryConsent(identity, consents)
  if (!activeConsent) return []

  const safeHistory = historyEvents
    .filter((event) => {
      if (event.identityId !== identity.id) return false
      if (event.teamId !== identity.teamId) return false
      if (event.competitionId === currentCompetitionId) return false
      if (
        event.visibilityScope !==
        CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.CONSENTED_INTRO
      ) {
        return false
      }
      if (!discoverableHistoryEventTypes.has(event.eventType)) return false
      return event.roleType ? requestedRoles.has(event.roleType) : false
    })
    .sort((left, right) => toTime(right.occurredAt) - toTime(left.occurredAt))
  const safeCredentials = credentials
    .filter((credential) => {
      if (credential.identityId !== identity.id) return false
      if (credential.teamId !== identity.teamId) return false
      if (
        credential.visibilityScope !==
        CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.CONSENTED_INTRO
      ) {
        return false
      }
      if (!safeCredentialStatuses.has(credential.status)) return false
      if (credential.revokedAt) return false
      if (credential.expiresAt && toTime(credential.expiresAt) < nowMs) {
        return false
      }
      return (
        credential.credentialType ===
          CREW_VOLUNTEER_CREDENTIAL_TYPE.JUDGE_COURSE || safeHistory.length > 0
      )
    })
    .map((credential) => ({
      credentialType: credential.credentialType,
      credentialLabel: credential.credentialLabel,
      status: credential.status as Extract<
        CrewVolunteerCredentialStatus,
        "self_reported" | "verified"
      >,
    }))

  const hasJudgeCredential = safeCredentials.some(
    (credential) =>
      credential.credentialType === CREW_VOLUNTEER_CREDENTIAL_TYPE.JUDGE_COURSE,
  )
  if (safeHistory.length === 0 && !hasJudgeCredential) return []

  const roleTypes = uniqueRoleTypes(safeHistory)
  if (roleTypes.length === 0 && hasJudgeCredential) {
    roleTypes.push("judge")
  }
  if (!roleTypes.some((roleType) => requestedRoles.has(roleType))) return []

  const introRequest = introRequests
    .filter(
      (request) =>
        request.volunteerIdentityId === identity.id &&
        request.status === CREW_VOLUNTEER_INTRO_REQUEST_STATUS.PENDING,
    )
    .sort((left, right) => toTime(right.requestedAt) - toTime(left.requestedAt))
    .at(0)

  return [
    {
      candidateId: identity.id,
      displayLabel: "Opted-in judge",
      regionLabel: getRegionLabel(safeHistory),
      availabilitySummary: "Not shared in this pilot",
      roleTypes,
      credentialSummary: dedupeCredentials(safeCredentials),
      factualHistory: summarizeHistory(safeHistory),
      introRequest: introRequest
        ? {
            id: introRequest.id,
            status: CREW_VOLUNTEER_INTRO_REQUEST_STATUS.PENDING,
            requestedAt: toIsoString(introRequest.requestedAt),
            directContactShared: false,
          }
        : null,
    },
  ]
}

function findActiveRegionalDiscoveryConsent(
  identity: CrewRegionalJudgeDiscoveryIdentityRecord,
  consents: CrewRegionalJudgeDiscoveryConsentRecord[],
) {
  return consents
    .filter((consent) => {
      if (consent.identityId !== identity.id) return false
      if (consent.teamId !== identity.teamId) return false
      if (consent.scope !== CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY) {
        return false
      }
      if (consent.status !== CREW_VOLUNTEER_CONSENT_STATUS.GRANTED) {
        return false
      }
      if (consent.revokedAt) return false
      if (consent.supersededByConsentId) return false
      return true
    })
    .sort((left, right) => toTime(right.grantedAt) - toTime(left.grantedAt))
    .at(0)
}

function summarizeHistory(events: CrewRegionalJudgeDiscoveryHistoryRecord[]) {
  const summary = {
    priorEventCount: new Set(
      events.map((event) => event.competitionId).filter(Boolean),
    ).size,
    assignedCount: 0,
    confirmedCount: 0,
    completedCount: 0,
    lastActivityAt: events[0] ? toIsoString(events[0].occurredAt) : null,
  }

  for (const event of events) {
    if (event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.ASSIGNED) {
      summary.assignedCount += 1
    } else if (
      event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED
    ) {
      summary.confirmedCount += 1
    } else if (
      event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.COMPLETED
    ) {
      summary.completedCount += 1
    }
  }

  return summary
}

function getRegionLabel(events: CrewRegionalJudgeDiscoveryHistoryRecord[]) {
  return (
    events.find((event) => event.regionLabel?.trim())?.regionLabel?.trim() ??
    "Region not shared"
  )
}

function uniqueRoleTypes(events: CrewRegionalJudgeDiscoveryHistoryRecord[]) {
  return [
    ...new Set(events.map((event) => event.roleType).filter(Boolean)),
  ] as VolunteerRoleType[]
}

function dedupeCredentials(
  credentials: CrewRegionalJudgeDiscoveryCandidate["credentialSummary"],
) {
  const seen = new Set<string>()
  return credentials.filter((credential) => {
    const key = [
      credential.credentialType,
      credential.credentialLabel.toLowerCase(),
      credential.status,
    ].join("|")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function compareCandidates(
  left: CrewRegionalJudgeDiscoveryCandidate,
  right: CrewRegionalJudgeDiscoveryCandidate,
) {
  const pendingDelta =
    Number(Boolean(left.introRequest)) - Number(Boolean(right.introRequest))
  if (pendingDelta !== 0) return pendingDelta

  const credentialDelta =
    right.credentialSummary.length - left.credentialSummary.length
  if (credentialDelta !== 0) return credentialDelta

  const eventCountDelta =
    right.factualHistory.priorEventCount - left.factualHistory.priorEventCount
  if (eventCountDelta !== 0) return eventCountDelta

  return (
    toTime(right.factualHistory.lastActivityAt) -
    toTime(left.factualHistory.lastActivityAt)
  )
}

function disabledNotices(gate: CrewRegionalJudgeDiscoveryGate) {
  return [
    gate.disabledReason ??
      "Regional judge discovery is disabled until explicitly enabled.",
    "No discovery candidates are loaded and no intro requests can be recorded while this gate is off.",
  ]
}

function toIsoString(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime())
    ? new Date(0).toISOString()
    : date.toISOString()
}

function toTime(value: Date | string | null | undefined) {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}
