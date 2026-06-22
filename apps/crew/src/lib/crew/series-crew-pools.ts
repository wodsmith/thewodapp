// @lat: [[crew#Series Crew Pools]]
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

export interface SeriesCrewPoolCompetition {
  id: string
  name: string
  slug: string
  startDate: string
  endDate: string
}

export interface SeriesCrewPoolRosterRecord {
  rosterVolunteerId: string
  competitionId: string
  volunteerName: string
  rosterStatus: string
  availability: VolunteerAvailability | null
  roleTypes: VolunteerRoleType[]
}

export interface SeriesCrewPoolIdentityRecord {
  id: string
  teamId: string
  rosterVolunteerId: string
}

export interface SeriesCrewPoolHistoryRecord {
  identityId: string
  teamId: string
  competitionId: string | null
  groupId: string | null
  competitionName: string | null
  eventType: CrewVolunteerHistoryEventType
  visibilityScope: CrewVolunteerHistoryVisibilityScope
  roleType: VolunteerRoleType | null
  occurredAt: Date | string
}

export interface SeriesCrewPoolCredentialRecord {
  identityId: string
  teamId: string
  credentialType: CrewVolunteerCredentialType
  credentialLabel: string
  status: CrewVolunteerCredentialStatus
  visibilityScope: CrewVolunteerHistoryVisibilityScope
  expiresAt?: Date | string | null
  revokedAt?: Date | string | null
}

export interface SeriesCrewPoolInput {
  organizerTeamId: string
  groupId: string
  competitions: SeriesCrewPoolCompetition[]
  selectedCompetitionIds: string[]
  roster: SeriesCrewPoolRosterRecord[]
  identities: SeriesCrewPoolIdentityRecord[]
  historyEvents: SeriesCrewPoolHistoryRecord[]
  credentials: SeriesCrewPoolCredentialRecord[]
  maxPoolSize?: number
}

export interface SeriesCrewPoolEntry {
  poolKey: string
  volunteerName: string
  rosterEvents: Array<{
    competitionId: string
    competitionName: string
    rosterStatus: string
    availability: VolunteerAvailability | null
    roleTypes: VolunteerRoleType[]
    selected: boolean
  }>
  selectedCompetitionIds: string[]
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
    status: Extract<CrewVolunteerCredentialStatus, "self_reported" | "verified">
  }>
}

export interface SeriesCrewPoolViewModel {
  competitions: Array<
    SeriesCrewPoolCompetition & {
      selected: boolean
      rosterCount: number
    }
  >
  selectedCompetitionIds: string[]
  entries: SeriesCrewPoolEntry[]
  summary: {
    totalVolunteers: number
    rosterPlacements: number
    selectedCompetitions: number
    volunteersInSelectedCompetitions: number
    volunteersWithHistory: number
    safeCredentialCount: number
  }
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

export function buildSeriesCrewPoolViewModel({
  organizerTeamId,
  groupId,
  competitions,
  selectedCompetitionIds,
  roster,
  identities,
  historyEvents,
  credentials,
  maxPoolSize = 100,
}: SeriesCrewPoolInput): SeriesCrewPoolViewModel {
  const competitionById = new Map(
    competitions.map((competition) => [competition.id, competition]),
  )
  const selectedIds = new Set(
    selectedCompetitionIds.filter((id) => competitionById.has(id)),
  )
  const rosterById = new Map(
    roster
      .filter((record) => competitionById.has(record.competitionId))
      .map((record) => [record.rosterVolunteerId, record]),
  )
  const identityIdsByRosterId = new Map<string, Set<string>>()

  for (const identity of identities) {
    if (identity.teamId !== organizerTeamId) continue
    if (!rosterById.has(identity.rosterVolunteerId)) continue
    const identityIds =
      identityIdsByRosterId.get(identity.rosterVolunteerId) ?? new Set<string>()
    identityIds.add(identity.id)
    identityIdsByRosterId.set(identity.rosterVolunteerId, identityIds)
  }

  const entriesByKey = new Map<
    string,
    {
      poolKey: string
      identityIds: Set<string>
      rosterRecords: SeriesCrewPoolRosterRecord[]
    }
  >()

  for (const record of rosterById.values()) {
    const identityIds = identityIdsByRosterId.get(record.rosterVolunteerId)
    const poolKey = identityIds?.size
      ? `identity:${[...identityIds].sort().join(":")}`
      : `roster:${record.rosterVolunteerId}`
    const entry = entriesByKey.get(poolKey) ?? {
      poolKey,
      identityIds: new Set<string>(),
      rosterRecords: [],
    }
    for (const identityId of identityIds ?? []) {
      entry.identityIds.add(identityId)
    }
    entry.rosterRecords.push(record)
    entriesByKey.set(poolKey, entry)
  }

  const entries = [...entriesByKey.values()]
    .map((entry) => {
      const rosterRecords = sortRosterRecords(
        entry.rosterRecords,
        competitionById,
      )
      const priorHistory = historyEvents
        .filter((event) => {
          if (!entry.identityIds.has(event.identityId)) return false
          if (event.teamId !== organizerTeamId) return false
          if (event.groupId !== groupId) return false
          if (
            event.visibilityScope !==
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER
          ) {
            return false
          }
          if (event.competitionId && selectedIds.has(event.competitionId)) {
            return false
          }
          return countedEventTypes.has(event.eventType)
        })
        .sort(
          (left, right) => toTime(right.occurredAt) - toTime(left.occurredAt),
        )
      const safeCredentials = credentials
        .filter((credential) => {
          if (!entry.identityIds.has(credential.identityId)) return false
          if (credential.teamId !== organizerTeamId) return false
          if (
            credential.visibilityScope !==
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER
          ) {
            return false
          }
          if (!safeCredentialStatuses.has(credential.status)) return false
          if (credential.revokedAt) return false
          if (
            credential.expiresAt &&
            toTime(credential.expiresAt) < Date.now()
          ) {
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
      const rosterEvents = rosterRecords.map((record) => {
        const competition = competitionById.get(record.competitionId)
        return {
          competitionId: record.competitionId,
          competitionName: competition?.name ?? "Series event",
          rosterStatus: record.rosterStatus,
          availability: record.availability,
          roleTypes: record.roleTypes,
          selected: selectedIds.has(record.competitionId),
        }
      })

      return {
        poolKey: entry.poolKey,
        volunteerName: rosterRecords[0]?.volunteerName ?? "Volunteer",
        rosterEvents,
        selectedCompetitionIds: rosterEvents
          .filter((event) => event.selected)
          .map((event) => event.competitionId),
        priorEventCount: countPriorEvents(priorHistory),
        lastEvent: toLastEvent(priorHistory[0] ?? null),
        priorRoleTypes: uniqueRoleTypes(priorHistory),
        reliability: countReliabilityFacts(priorHistory),
        credentials: dedupeCredentials(safeCredentials),
      }
    })
    .sort(compareSeriesCrewPoolEntries)
    .slice(0, maxPoolSize)

  return {
    competitions: competitions.map((competition) => ({
      ...competition,
      selected: selectedIds.has(competition.id),
      rosterCount: new Set(
        roster
          .filter((record) => record.competitionId === competition.id)
          .map((record) => record.rosterVolunteerId),
      ).size,
    })),
    selectedCompetitionIds: [...selectedIds],
    entries,
    summary: {
      totalVolunteers: entries.length,
      rosterPlacements: rosterById.size,
      selectedCompetitions: selectedIds.size,
      volunteersInSelectedCompetitions: entries.filter(
        (entry) => entry.selectedCompetitionIds.length > 0,
      ).length,
      volunteersWithHistory: entries.filter(
        (entry) => entry.priorEventCount > 0,
      ).length,
      safeCredentialCount: entries.reduce(
        (total, entry) => total + entry.credentials.length,
        0,
      ),
    },
  }
}

function sortRosterRecords(
  records: SeriesCrewPoolRosterRecord[],
  competitionById: Map<string, SeriesCrewPoolCompetition>,
) {
  return [...records].sort((left, right) => {
    const leftCompetition = competitionById.get(left.competitionId)
    const rightCompetition = competitionById.get(right.competitionId)
    const dateCompare = (leftCompetition?.startDate ?? "").localeCompare(
      rightCompetition?.startDate ?? "",
    )
    if (dateCompare !== 0) return dateCompare
    return left.volunteerName.localeCompare(right.volunteerName)
  })
}

function countPriorEvents(events: SeriesCrewPoolHistoryRecord[]) {
  return new Set(events.map((event) => event.competitionId).filter(Boolean))
    .size
}

function toLastEvent(event: SeriesCrewPoolHistoryRecord | null) {
  if (!event) return null
  return {
    competitionId: event.competitionId,
    label: event.competitionName ?? "Series event",
    occurredAt: toIsoString(event.occurredAt),
  }
}

function uniqueRoleTypes(events: SeriesCrewPoolHistoryRecord[]) {
  return [
    ...new Set(events.map((event) => event.roleType).filter(Boolean)),
  ] as VolunteerRoleType[]
}

function countReliabilityFacts(events: SeriesCrewPoolHistoryRecord[]) {
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
    } else if (
      event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED
    ) {
      reliability.confirmed += 1
    } else if (event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.DECLINED) {
      reliability.declined += 1
    } else if (
      event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CHANGE_REQUESTED
    ) {
      reliability.changeRequested += 1
    } else if (event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.NO_SHOW) {
      reliability.noShow += 1
    } else if (
      event.eventType === CREW_VOLUNTEER_HISTORY_EVENT_TYPE.COMPLETED
    ) {
      reliability.completed += 1
    }
  }

  return reliability
}

function dedupeCredentials(credentials: SeriesCrewPoolEntry["credentials"]) {
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

function compareSeriesCrewPoolEntries(
  left: SeriesCrewPoolEntry,
  right: SeriesCrewPoolEntry,
) {
  const selectedDelta =
    right.selectedCompetitionIds.length - left.selectedCompetitionIds.length
  if (selectedDelta !== 0) return selectedDelta

  const eventCountDelta = right.priorEventCount - left.priorEventCount
  if (eventCountDelta !== 0) return eventCountDelta

  const leftLast = left.lastEvent ? toTime(left.lastEvent.occurredAt) : 0
  const rightLast = right.lastEvent ? toTime(right.lastEvent.occurredAt) : 0
  if (rightLast !== leftLast) return rightLast - leftLast

  return left.volunteerName.localeCompare(right.volunteerName)
}

function toIsoString(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime())
    ? new Date(0).toISOString()
    : date.toISOString()
}

function toTime(value: Date | string) {
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}
