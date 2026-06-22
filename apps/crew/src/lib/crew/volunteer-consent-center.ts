import {
  CREW_VOLUNTEER_CONSENT_SCOPE,
  CREW_VOLUNTEER_CONSENT_STATUS,
  CREW_VOLUNTEER_DISCOVERY_AGE_STATUS,
  type CrewVolunteerConsentScope,
  type CrewVolunteerConsentSource,
  type CrewVolunteerConsentStatus,
  type CrewVolunteerDiscoveryAgeStatus,
} from "../../db/schemas/crew-volunteer-intelligence"

export const CREW_VOLUNTEER_CONSENT_CENTER_VERSION = "2026-06-21.v1"
export const CREW_VOLUNTEER_CONSENT_CENTER_SURFACE = "public_consent_center"

export const CREW_VOLUNTEER_CONSENT_CENTER_SCOPES = [
  CREW_VOLUNTEER_CONSENT_SCOPE.COMMUNICATION_HISTORY,
  CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY,
] as const

export type CrewVolunteerConsentCenterScope =
  (typeof CREW_VOLUNTEER_CONSENT_CENTER_SCOPES)[number]

export type CrewVolunteerConsentCenterAction = "grant" | "revoke"

export interface CrewVolunteerConsentCenterRecord {
  id: string
  scope: CrewVolunteerConsentScope
  status: CrewVolunteerConsentStatus
  consentTextVersion: string
  source: CrewVolunteerConsentSource
  sourceSurface: string
  grantedAt: Date | string
  revokedAt: Date | string | null
  supersededByConsentId: string | null
  updatedAt?: Date | string | null
}

export interface CrewVolunteerConsentCenterViewInput {
  eventName: string
  volunteerLabel: string
  identityAgeStatus: CrewVolunteerDiscoveryAgeStatus | null
  consentRecords: CrewVolunteerConsentCenterRecord[]
}

export interface CrewVolunteerConsentCenterScopeView {
  scope: CrewVolunteerConsentCenterScope
  label: string
  description: string
  granted: boolean
  canGrant: boolean
  canRevoke: boolean
  disabledReason: string | null
  currentConsentId: string | null
  statusLabel: string
  lastUpdatedAt: string | null
  consentTextVersion: string | null
}

export interface CrewVolunteerConsentCenterView {
  eventName: string
  volunteerLabel: string
  scopes: CrewVolunteerConsentCenterScopeView[]
  notices: string[]
}

export interface CrewVolunteerConsentMutationInput {
  action: CrewVolunteerConsentCenterAction
  scope: CrewVolunteerConsentCenterScope
  identityAgeStatus: CrewVolunteerDiscoveryAgeStatus | null
  activeConsentId?: string | null
}

export type CrewVolunteerConsentMutationResolution =
  | { ok: true; outcome: "grant" | "revoke" | "idempotent" }
  | { ok: false; reason: "scope_not_supported" | "regional_age_blocked" }

export function buildCrewVolunteerConsentCenterView({
  eventName,
  volunteerLabel,
  identityAgeStatus,
  consentRecords,
}: CrewVolunteerConsentCenterViewInput): CrewVolunteerConsentCenterView {
  const currentByScope = new Map<
    CrewVolunteerConsentCenterScope,
    CrewVolunteerConsentCenterRecord
  >()
  const sortedRecords = [...consentRecords].sort(compareConsentRecordsDesc)

  for (const record of sortedRecords) {
    if (!isCrewVolunteerConsentCenterScope(record.scope)) continue
    if (currentByScope.has(record.scope)) continue
    currentByScope.set(record.scope, record)
  }

  return {
    eventName,
    volunteerLabel,
    scopes: CREW_VOLUNTEER_CONSENT_CENTER_SCOPES.map((scope) =>
      buildScopeView(
        scope,
        currentByScope.get(scope) ?? null,
        identityAgeStatus,
      ),
    ),
    notices: [
      "SMS messaging is not enabled from this consent center.",
      "Regional discovery stays off unless you explicitly opt in and the account is eligible.",
    ],
  }
}

export function resolveCrewVolunteerConsentMutation({
  action,
  scope,
  identityAgeStatus,
  activeConsentId,
}: CrewVolunteerConsentMutationInput): CrewVolunteerConsentMutationResolution {
  if (!isCrewVolunteerConsentCenterScope(scope)) {
    return { ok: false, reason: "scope_not_supported" }
  }
  if (
    action === "grant" &&
    scope === CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY &&
    identityAgeStatus !== CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.ADULT_CONFIRMED
  ) {
    return { ok: false, reason: "regional_age_blocked" }
  }
  if (action === "grant" && activeConsentId) {
    return { ok: true, outcome: "idempotent" }
  }
  if (action === "revoke" && !activeConsentId) {
    return { ok: true, outcome: "idempotent" }
  }
  return { ok: true, outcome: action }
}

export function isCrewVolunteerConsentCenterScope(
  scope: string,
): scope is CrewVolunteerConsentCenterScope {
  return CREW_VOLUNTEER_CONSENT_CENTER_SCOPES.includes(
    scope as CrewVolunteerConsentCenterScope,
  )
}

export function getCrewVolunteerConsentText(params: {
  scope: CrewVolunteerConsentCenterScope
  action: CrewVolunteerConsentCenterAction
}) {
  if (params.scope === CREW_VOLUNTEER_CONSENT_SCOPE.COMMUNICATION_HISTORY) {
    return params.action === "grant"
      ? "I agree that WODsmith Crew may keep my crew communication history for this organizing team so future event crew workflows can use factual prior email and assignment response context. This does not enable SMS messaging."
      : "I revoke permission for WODsmith Crew to use my crew communication history for future event crew workflows. This does not delete prior audit records."
  }

  return params.action === "grant"
    ? "I agree that WODsmith Crew may mark me as eligible for regional volunteer discovery after eligibility checks. Discovery must not expose my raw email, phone, private notes, billing data, or emergency contact details."
    : "I revoke permission for WODsmith Crew to include me in future regional volunteer discovery. This does not delete prior audit records."
}

export async function hashCrewVolunteerConsentText(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `${CREW_VOLUNTEER_CONSENT_CENTER_VERSION}:${text}`,
    ),
  )
  return `sha256:${bytesToHex(new Uint8Array(digest))}`
}

function buildScopeView(
  scope: CrewVolunteerConsentCenterScope,
  record: CrewVolunteerConsentCenterRecord | null,
  identityAgeStatus: CrewVolunteerDiscoveryAgeStatus | null,
): CrewVolunteerConsentCenterScopeView {
  const granted = record?.status === CREW_VOLUNTEER_CONSENT_STATUS.GRANTED
  const regionalAgeBlocked =
    scope === CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY &&
    identityAgeStatus !== CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.ADULT_CONFIRMED

  return {
    scope,
    label:
      scope === CREW_VOLUNTEER_CONSENT_SCOPE.COMMUNICATION_HISTORY
        ? "Communication history"
        : "Regional discovery",
    description:
      scope === CREW_VOLUNTEER_CONSENT_SCOPE.COMMUNICATION_HISTORY
        ? "Let this organizing team use factual crew communication and assignment response history for future Crew workflows."
        : "Allow future regional volunteer discovery only after eligibility checks. Raw contact and private metadata stay hidden.",
    granted,
    canGrant: !granted && !regionalAgeBlocked,
    canRevoke: granted,
    disabledReason: regionalAgeBlocked
      ? "Regional discovery requires adult eligibility before opt-in."
      : null,
    currentConsentId: record?.id ?? null,
    statusLabel: granted
      ? "Granted"
      : record?.status === CREW_VOLUNTEER_CONSENT_STATUS.REVOKED
        ? "Revoked"
        : "Not granted",
    lastUpdatedAt: record
      ? toIsoString(record.revokedAt ?? record.updatedAt ?? record.grantedAt)
      : null,
    consentTextVersion: record?.consentTextVersion ?? null,
  }
}

function compareConsentRecordsDesc(
  left: CrewVolunteerConsentCenterRecord,
  right: CrewVolunteerConsentCenterRecord,
) {
  const effectiveDiff = getConsentSortTime(right) - getConsentSortTime(left)
  if (effectiveDiff !== 0) return effectiveDiff
  return toTime(right.grantedAt) - toTime(left.grantedAt)
}

function getConsentSortTime(record: CrewVolunteerConsentCenterRecord) {
  return toTime(record.revokedAt ?? record.updatedAt ?? record.grantedAt)
}

function toTime(value: Date | string | null | undefined) {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}

function toIsoString(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  )
}
