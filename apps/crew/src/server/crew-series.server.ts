// @lat: [[crew#Series Crew Pools]]
import { and, asc, eq, gt, inArray, isNull, or } from "drizzle-orm"
import { getDb } from "../db"
import {
  competitionGroupsTable,
  competitionsTable,
} from "../db/schemas/competitions"
import { crewEventSettingsTable } from "../db/schemas/crew-event-settings"
import {
  CREW_VOLUNTEER_CREDENTIAL_STATUS,
  CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE,
  crewVolunteerCredentialsTable,
  crewVolunteerHistoryEventsTable,
  crewVolunteerIdentitiesTable,
} from "../db/schemas/crew-volunteer-intelligence"
import { TEAM_PERMISSIONS } from "../db/schemas/teams"
import {
  buildSeriesCrewPoolViewModel,
  type SeriesCrewPoolIdentityRecord,
  type SeriesCrewPoolViewModel,
} from "../lib/crew/series-crew-pools"
import type { CrewRosterVolunteer } from "../lib/crew/roster-shifts"
import { requireTeamPermission } from "../utils/team-auth"
import { hashCrewVolunteerContactAnchor } from "./crew-volunteer-history.server"
import { loadCrewRoster } from "./crew-roster-shift.server"

export interface CrewSeriesCrewPoolPageData {
  group: {
    id: string
    name: string
    slug: string
    description: string | null
  }
  selectedCompetitionIds: string[]
  pool: SeriesCrewPoolViewModel
}

interface CrewSeriesCrewPoolInput {
  groupId: string
  selectedCompetitionIds?: string[]
}

interface SeriesCrewPoolRosterSource {
  rosterVolunteerId: string
  emailHash: string | null
  membershipId: string | null
  invitationId: string | null
}

export async function getCrewSeriesCrewPoolPage(
  data: CrewSeriesCrewPoolInput,
): Promise<CrewSeriesCrewPoolPageData> {
  const db = getDb()
  const [group] = await db
    .select({
      id: competitionGroupsTable.id,
      name: competitionGroupsTable.name,
      slug: competitionGroupsTable.slug,
      description: competitionGroupsTable.description,
      organizingTeamId: competitionGroupsTable.organizingTeamId,
    })
    .from(competitionGroupsTable)
    .where(eq(competitionGroupsTable.id, data.groupId))
    .limit(1)

  if (!group) {
    throw new Error("Series group not found")
  }

  await requireTeamPermission(
    group.organizingTeamId,
    TEAM_PERMISSIONS.ACCESS_DASHBOARD,
  )

  const competitions = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      slug: competitionsTable.slug,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
    })
    .from(competitionsTable)
    .innerJoin(
      crewEventSettingsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(
      and(
        eq(competitionsTable.groupId, group.id),
        eq(competitionsTable.organizingTeamId, group.organizingTeamId),
      ),
    )
    .orderBy(asc(competitionsTable.startDate), asc(competitionsTable.name))

  const selectedCompetitionIds = normalizeSelectedCompetitionIds(
    data.selectedCompetitionIds,
    competitions.map((competition) => competition.id),
  )
  const rosterLoads = await Promise.all(
    competitions.map(async (competition) => ({
      competition,
      roster: await loadCrewRoster(competition.competitionTeamId),
    })),
  )
  const rosterRecords = rosterLoads.flatMap(({ competition, roster }) =>
    roster.map((volunteer) => ({
      rosterVolunteerId: toSeriesRosterVolunteerId(competition.id, volunteer),
      competitionId: competition.id,
      volunteerName: volunteer.name,
      rosterStatus: volunteer.status,
      availability: volunteer.availability,
      roleTypes: volunteer.roleTypes,
    })),
  )
  const rosterSources = await buildSeriesCrewPoolRosterSources(rosterLoads)
  const identities = await loadSeriesCrewPoolIdentityMatches({
    organizerTeamId: group.organizingTeamId,
    rosterSources,
  })
  const identityIds = uniqueText(identities.map((identity) => identity.id))
  const [historyEvents, credentials] =
    identityIds.length > 0
      ? await Promise.all([
          db
            .select({
              identityId: crewVolunteerHistoryEventsTable.identityId,
              teamId: crewVolunteerHistoryEventsTable.teamId,
              competitionId: crewVolunteerHistoryEventsTable.competitionId,
              groupId: crewVolunteerHistoryEventsTable.groupId,
              competitionName: competitionsTable.name,
              eventType: crewVolunteerHistoryEventsTable.eventType,
              visibilityScope: crewVolunteerHistoryEventsTable.visibilityScope,
              roleType: crewVolunteerHistoryEventsTable.roleType,
              occurredAt: crewVolunteerHistoryEventsTable.occurredAt,
            })
            .from(crewVolunteerHistoryEventsTable)
            .leftJoin(
              competitionsTable,
              eq(
                crewVolunteerHistoryEventsTable.competitionId,
                competitionsTable.id,
              ),
            )
            .where(
              and(
                eq(
                  crewVolunteerHistoryEventsTable.teamId,
                  group.organizingTeamId,
                ),
                eq(crewVolunteerHistoryEventsTable.groupId, group.id),
                inArray(
                  crewVolunteerHistoryEventsTable.identityId,
                  identityIds,
                ),
                eq(
                  crewVolunteerHistoryEventsTable.visibilityScope,
                  CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
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
                eq(
                  crewVolunteerCredentialsTable.teamId,
                  group.organizingTeamId,
                ),
                inArray(crewVolunteerCredentialsTable.identityId, identityIds),
                eq(
                  crewVolunteerCredentialsTable.visibilityScope,
                  CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
                ),
                inArray(crewVolunteerCredentialsTable.status, [
                  CREW_VOLUNTEER_CREDENTIAL_STATUS.SELF_REPORTED,
                  CREW_VOLUNTEER_CREDENTIAL_STATUS.VERIFIED,
                ]),
                isNull(crewVolunteerCredentialsTable.revokedAt),
                or(
                  isNull(crewVolunteerCredentialsTable.expiresAt),
                  gt(crewVolunteerCredentialsTable.expiresAt, new Date()),
                ),
              ),
            ),
        ])
      : [[], []]
  const pool = buildSeriesCrewPoolViewModel({
    organizerTeamId: group.organizingTeamId,
    groupId: group.id,
    competitions: competitions.map((competition) => ({
      id: competition.id,
      name: competition.name,
      slug: competition.slug,
      startDate: competition.startDate,
      endDate: competition.endDate,
    })),
    selectedCompetitionIds,
    roster: rosterRecords,
    identities,
    historyEvents,
    credentials,
  })

  return {
    group: {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
    },
    selectedCompetitionIds: pool.selectedCompetitionIds,
    pool,
  }
}

function normalizeSelectedCompetitionIds(
  selectedCompetitionIds: string[] | undefined,
  competitionIds: string[],
) {
  const competitionIdSet = new Set(competitionIds)
  const selected = uniqueText(selectedCompetitionIds ?? []).filter((id) =>
    competitionIdSet.has(id),
  )

  return selected.length > 0 ? selected : competitionIds.slice(0, 1)
}

async function buildSeriesCrewPoolRosterSources(
  rosterLoads: Array<{
    competition: { id: string }
    roster: CrewRosterVolunteer[]
  }>,
) {
  const sources: SeriesCrewPoolRosterSource[] = []

  for (const { competition, roster } of rosterLoads) {
    for (const volunteer of roster) {
      sources.push({
        rosterVolunteerId: toSeriesRosterVolunteerId(competition.id, volunteer),
        emailHash: await hashCrewVolunteerContactAnchor(
          "email",
          volunteer.email,
        ),
        membershipId: volunteer.membershipId,
        invitationId: volunteer.invitationId,
      })
    }
  }

  return sources
}

async function loadSeriesCrewPoolIdentityMatches({
  organizerTeamId,
  rosterSources,
}: {
  organizerTeamId: string
  rosterSources: SeriesCrewPoolRosterSource[]
}) {
  const emailHashes = uniqueText(
    rosterSources.map((source) => source.emailHash),
  )
  const membershipIds = uniqueText(
    rosterSources.map((source) => source.membershipId),
  )
  const invitationIds = uniqueText(
    rosterSources.map((source) => source.invitationId),
  )
  const identityConditions = [
    emailHashes.length > 0
      ? inArray(crewVolunteerIdentitiesTable.emailHash, emailHashes)
      : null,
    membershipIds.length > 0
      ? inArray(crewVolunteerIdentitiesTable.sourceMembershipId, membershipIds)
      : null,
    invitationIds.length > 0
      ? inArray(crewVolunteerIdentitiesTable.sourceInvitationId, invitationIds)
      : null,
  ].filter((condition): condition is NonNullable<typeof condition> =>
    Boolean(condition),
  )

  if (identityConditions.length === 0) return []

  const db = getDb()
  const identityRows = await db
    .select({
      id: crewVolunteerIdentitiesTable.id,
      teamId: crewVolunteerIdentitiesTable.teamId,
      emailHash: crewVolunteerIdentitiesTable.emailHash,
      sourceMembershipId: crewVolunteerIdentitiesTable.sourceMembershipId,
      sourceInvitationId: crewVolunteerIdentitiesTable.sourceInvitationId,
    })
    .from(crewVolunteerIdentitiesTable)
    .where(
      and(
        eq(crewVolunteerIdentitiesTable.teamId, organizerTeamId),
        identityConditions.length === 1
          ? identityConditions[0]
          : or(...identityConditions),
      ),
    )

  const matches: SeriesCrewPoolIdentityRecord[] = []
  const seen = new Set<string>()

  for (const source of rosterSources) {
    for (const identity of identityRows) {
      const matchedByEmail =
        source.emailHash !== null && identity.emailHash === source.emailHash
      const matchedByMembership =
        source.membershipId !== null &&
        identity.sourceMembershipId === source.membershipId
      const matchedByInvitation =
        source.invitationId !== null &&
        identity.sourceInvitationId === source.invitationId

      if (!matchedByEmail && !matchedByMembership && !matchedByInvitation) {
        continue
      }

      const key = `${source.rosterVolunteerId}:${identity.id}`
      if (seen.has(key)) continue
      seen.add(key)
      matches.push({
        id: identity.id,
        teamId: identity.teamId,
        rosterVolunteerId: source.rosterVolunteerId,
      })
    }
  }

  return matches
}

function toSeriesRosterVolunteerId(
  competitionId: string,
  volunteer: Pick<CrewRosterVolunteer, "id">,
) {
  return `${competitionId}:${volunteer.id}`
}

function uniqueText(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}
