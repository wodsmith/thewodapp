// @lat: [[crew#Strategic Moat Privacy Model]]
import {
  CREW_VOLUNTEER_CREDENTIAL_STATUS,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE,
  CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE,
  type CrewVolunteerCredentialStatus,
  type CrewVolunteerCredentialType,
  type CrewVolunteerHistoryEventType,
  type CrewVolunteerHistoryVisibilityScope,
} from "../../db/schemas/crew-volunteer-intelligence"
import type {
  VolunteerAvailability,
  VolunteerRoleType,
} from "../../db/schemas/volunteers"

export interface ReturningVolunteerRosterEntry {
  id: string
  name: string
  status: string
  availability: VolunteerAvailability | null
  roleTypes: VolunteerRoleType[]
}

export interface ReturningVolunteerIdentityRecord {
  id: string
  teamId: string
  rosterVolunteerId: string
}

export interface ReturningVolunteerHistoryRecord {
  identityId: string
  teamId: string
  competitionId: string | null
  competitionName: string | null
  eventType: CrewVolunteerHistoryEventType
  visibilityScope: CrewVolunteerHistoryVisibilityScope
  roleType: VolunteerRoleType | null
  occurredAt: Date | string
}

export interface ReturningVolunteerCredentialRecord {
  identityId: string
  teamId: string
  credentialType: CrewVolunteerCredentialType
  credentialLabel: string
  status: CrewVolunteerCredentialStatus
  visibilityScope: CrewVolunteerHistoryVisibilityScope
  expiresAt?: Date | string | null
  revokedAt?: Date | string | null
}

export interface ReturningVolunteerSummaryInput {
  organizerTeamId: string
  currentCompetitionId: string
  roster: ReturningVolunteerRosterEntry[]
  identities: ReturningVolunteerIdentityRecord[]
  historyEvents: ReturningVolunteerHistoryRecord[]
  credentials: ReturningVolunteerCredentialRecord[]
  maxSuggestions?: number
}

export interface CrewReturningVolunteerSuggestion {
  rosterVolunteerId: string
  volunteerName: string
  rosterStatus: string
  currentAvailability: VolunteerAvailability | null
  currentRoleTypes: VolunteerRoleType[]
  priorEventCount: number
  lastEvent: {
    competitionId: string | null
    label: string
    occurredAt: string
  } | null
  priorRoleTypes: VolunteerRoleType[]
  reliability: {
    signedUp: number
    imported: number
    assigned: number
    confirmed: number
    declined: number
    changeRequested: number
    noShow: number
    completed: number
  }
  credentials: Array<{
    credentialType: CrewVolunteerCredentialType
    credentialLabel: string
    status: Extract<
      CrewVolunteerCredentialStatus,
      "self_reported" | "verified"
    >
  }>
}

const countedEventTypes = new Set<CrewVolunteerHistoryEventType>([
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.SIGNED_UP,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.IMPORTED,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.ASSIGNED,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.DECLINED,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CHANGE_REQUESTED,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.NO_SHOW,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE.COMPLETED,
])

const safeCredentialStatuses = new Set<CrewVolunteerCredentialStatus>([
  CREW_VOLUNTEER_CREDENTIAL_STATUS.SELF_REPORTED,
  CREW_VOLUNTEER_CREDENTIAL_STATUS.VERIFIED,
])

export function buildReturningVolunteerSuggestions({
  organizerTeamId,
  currentCompetitionId,
  roster,
  identities,
  historyEvents,
  credentials,
  maxSuggestions = 8,
}: ReturningVolunteerSummaryInput): CrewReturningVolunteerSuggestion[] {
  const rosterById = new Map(roster.map((volunteer) => [volunteer.id, volunteer]))
  const identityIdsByRosterId = new Map<string, Set<string>>()

  for (const identity of identities) {
    if (identity.teamId !== organizerTeamId) continue
    if (!rosterById.has(identity.rosterVolunteerId)) continue
    const identityIds =
      identityIdsByRosterId.get(identity.rosterVolunteerId) ?? new Set<string>()
    identityIds.add(identity.id)
    identityIdsByRosterId.set(identity.rosterVolunteerId, identityIds)
  }

  return [...identityIdsByRosterId.entries()]
    .flatMap(([rosterVolunteerId, identityIds]) => {
      const volunteer = rosterById.get(rosterVolunteerId)
      if (!volunteer) return []

      const priorHistory = historyEvents
        .filter((event) => {
          if (!identityIds.has(event.identityId)) return false
          if (event.teamId !== organizerTeamId) return false
          if (
            event.visibilityScope !==
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER
          ) {
            return false
          }
          if (event.competitionId === currentCompetitionId) return false
          return countedEventTypes.has(event.eventType)
        })
        .sort(
          (left, right) =>
            toTime(right.occurredAt) - toTime(left.occurredAt),
        )

      if (priorHistory.length === 0) return []

      const safeCredentials = credentials
        .filter((credential) => {
          if (!identityIds.has(credential.identityId)) return false
          if (credential.teamId !== organizerTeamId) return false
          if (
            credential.visibilityScope !==
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER
          ) {
            return false
          }
          if (!safeCredentialStatuses.has(credential.status)) return false
          if (credential.revokedAt) return false
          if (credential.expiresAt && toTime(credential.expiresAt) < Date.now()) {
            return false
          }
          return true
        })
        .map((credential) => ({
          credentialType: credential.credentialType,
          credentialLabel: credential.credentialLabel,
          status: credential.status as Extract<
            CrewVolunteerCredentialStatus,
            "self_reported" | "verified"
          >,
        }))

      return [
        {
          rosterVolunteerId,
          volunteerName: volunteer.name,
          rosterStatus: volunteer.status,
          currentAvailability: volunteer.availability,
          currentRoleTypes: volunteer.roleTypes,
          priorEventCount: countPriorEvents(priorHistory),
          lastEvent: toLastEvent(priorHistory[0] ?? null),
          priorRoleTypes: uniqueRoleTypes(priorHistory),
          reliability: countReliabilityFacts(priorHistory),
          credentials: dedupeCredentials(safeCredentials),
        },
      ]
    })
    .sort(compareReturningVolunteerSuggestions)
    .slice(0, maxSuggestions)
}

function countPriorEvents(events: ReturningVolunteerHistoryRecord[]) {
  return new Set(
    events.map((event) => event.competitionId).filter(Boolean),
  ).size
}

function toLastEvent(event: ReturningVolunteerHistoryRecord | null) {
  if (!event) return null
  return {
    competitionId: event.competitionId,
    label: event.competitionName ?? "Prior event",
    occurredAt: toIsoString(event.occurredAt),
  }
}

function uniqueRoleTypes(events: ReturningVolunteerHistoryRecord[]) {
  return [
    ...new Set(events.map((event) => event.roleType).filter(Boolean)),
  ] as VolunteerRoleType[]
}

function countReliabilityFacts(events: ReturningVolunteerHistoryRecord[]) {
  const reliability = {
    signedUp: 0,
    imported: 0,
    assigned: 0,
    confirmed: 0,
    declined: 0,
    changeRequested: 0,
    noShow: 0,
    completed: 0,
  }

  for (const event of events) {
    if (event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.SIGNED_UP) {
      reliability.signedUp += 1
    } else if (event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.IMPORTED) {
      reliability.imported += 1
    } else if (event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.ASSIGNED) {
      reliability.assigned += 1
    } else if (event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED) {
      reliability.confirmed += 1
    } else if (event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.DECLINED) {
      reliability.declined += 1
    } else if (
      event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CHANGE_REQUESTED
    ) {
      reliability.changeRequested += 1
    } else if (event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.NO_SHOW) {
      reliability.noShow += 1
    } else if (event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.COMPLETED) {
      reliability.completed += 1
    }
  }

  return reliability
}

function dedupeCredentials(
  credentials: CrewReturningVolunteerSuggestion["credentials"],
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

function compareReturningVolunteerSuggestions(
  left: CrewReturningVolunteerSuggestion,
  right: CrewReturningVolunteerSuggestion,
) {
  const eventCountDelta = right.priorEventCount - left.priorEventCount
  if (eventCountDelta !== 0) return eventCountDelta

  const leftLast = left.lastEvent ? toTime(left.lastEvent.occurredAt) : 0
  const rightLast = right.lastEvent ? toTime(right.lastEvent.occurredAt) : 0
  if (rightLast !== leftLast) return rightLast - leftLast

  return left.volunteerName.localeCompare(right.volunteerName)
}

function toIsoString(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
}

function toTime(value: Date | string) {
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}
