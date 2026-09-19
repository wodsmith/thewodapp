import { err, ok, type Result } from "../core/result"
import {
  type CompetitionDivisionId,
  type CompetitionEventId,
  decodeCompetitionDivisionId,
  decodeCompetitionEventId,
  decodeCompetitionId,
  decodeLegacyCompetitionAccessTeamId,
  decodeLegacyEventConfigurationId,
  decodeLegacyProgrammingTrackId,
  decodeLegacyScalingGroupId,
  decodeOrganizationId,
  decodePersonalWorkspaceId,
  decodeRegistrationId,
  decodeSquadId,
  decodeUserId,
  type InvalidIdentifier,
  type PersonalWorkspaceId,
  type RegistrationId,
  type SquadId,
  type UserId,
} from "./ids"
import type {
  LegacyCompetitionIdentitySnapshot,
  LegacyDivisionConfigurationIdentityRow,
  LegacyTeamIdentityRow,
} from "./legacy-types"
import type {
  CompetitionDivision,
  CompetitionEvent,
  CompetitionTopology,
  DivisionSelection,
  PersonalWorkspace,
  Registration,
  Squad,
  SubmissionWindow,
} from "./model"

export type IdentityCorruptionCode =
  | "INVALID_IDENTIFIER"
  | "MISSING_ORGANIZATION"
  | "INVALID_ORGANIZATION_SHAPE"
  | "MISSING_COMPETITION_ACCESS_TEAM"
  | "INVALID_COMPETITION_ACCESS_TEAM"
  | "INVALID_PERSONAL_WORKSPACE"
  | "MISSING_TRACK"
  | "MISSING_EVENT"
  | "CROSS_COMPETITION_EVENT"
  | "CROSS_COMPETITION_PARENT_EVENT"
  | "DUPLICATE_EVENT_CONFIGURATION"
  | "INVALID_DIVISION"
  | "DIVISION_OUTSIDE_COMPETITION"
  | "DUPLICATE_DIVISION_CONFIGURATION"
  | "CROSS_COMPETITION_REGISTRATION"
  | "PARTICIPATION_MODE_MISMATCH"
  | "MISSING_SQUAD"
  | "INVALID_SQUAD"
  | "SNAPSHOT_COMPETITION_MISMATCH"
  | "CROSS_COMPETITION_SQUAD"
  | "CROSS_DIVISION_SQUAD"
  | "MISSING_SQUAD_CAPTAIN"
  | "CONFLICTING_SQUAD_CAPTAIN"

export interface IdentityCorruption {
  readonly kind: "IdentityCorruption"
  readonly code: IdentityCorruptionCode
  readonly source: Readonly<{ table: string; rowId: string }>
  readonly invariant: string
  readonly relatedIds: readonly string[]
  readonly identifierError?: InvalidIdentifier
}

function corrupt(
  code: IdentityCorruptionCode,
  table: string,
  rowId: string,
  invariant: string,
  relatedIds: readonly string[] = [],
  identifierError?: InvalidIdentifier,
): IdentityCorruption {
  return {
    kind: "IdentityCorruption",
    code,
    source: { table, rowId },
    invariant,
    relatedIds,
    ...(identifierError ? { identifierError } : {}),
  }
}

function decodeAt<TId extends string>(
  decode: (value: string) => Result<TId, InvalidIdentifier>,
  value: string,
  table: string,
  rowId: string,
): Result<TId, IdentityCorruption> {
  const result = decode(value)
  if (result.ok === true) return result

  return err(
    corrupt(
      "INVALID_IDENTIFIER",
      table,
      rowId,
      `${result.error.identity} must use ${result.error.expectedPrefix}`,
      [value],
      result.error,
    ),
  )
}

function parseSquadMetadata(
  row: LegacyTeamIdentityRow,
): Result<
  Readonly<{ competitionId: string; divisionId: string }> | null,
  IdentityCorruption
> {
  // Demo creation relies on the parent access team and registrations instead.
  if (row.competitionMetadata === null) return ok(null)

  try {
    const parsed: unknown = JSON.parse(row.competitionMetadata)
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("competitionId" in parsed) ||
      typeof parsed.competitionId !== "string" ||
      !("divisionId" in parsed) ||
      typeof parsed.divisionId !== "string"
    ) {
      return err(
        corrupt(
          "INVALID_SQUAD",
          "teams",
          row.id,
          "Squad metadata must contain string competitionId and divisionId values",
        ),
      )
    }

    return ok({
      competitionId: parsed.competitionId,
      divisionId: parsed.divisionId,
    })
  } catch {
    return err(
      corrupt(
        "INVALID_SQUAD",
        "teams",
        row.id,
        "Squad metadata must be valid JSON",
      ),
    )
  }
}

/** Validate known persisted aliases without rewriting storage identity. */
function legacyDecoder<TId extends string>(
  decode: (value: string) => Result<TId, InvalidIdentifier>,
  legacyPrefix: string,
  canonicalPrefix: string,
): (value: string) => Result<TId, InvalidIdentifier> {
  return (value) => {
    if (!value.startsWith(legacyPrefix)) return decode(value)
    const result = decode(canonicalPrefix + value.slice(legacyPrefix.length))
    return result.ok ? ok(value as TId) : decode(value)
  }
}

const decodePersistedEventId = legacyDecoder(
  decodeCompetitionEventId,
  "tw_",
  "trwk_",
)
const decodePersistedTrackId = legacyDecoder(
  decodeLegacyProgrammingTrackId,
  "track_",
  "ptrk_",
)

/**
 * Converts the legacy storage graph into one validated, context-owned topology.
 * No storage-shaped ID or row escapes this boundary.
 */
export function resolveLegacyCompetitionTopology(
  snapshot: LegacyCompetitionIdentitySnapshot,
): Result<CompetitionTopology, IdentityCorruption> {
  const competitionIdResult = decodeAt(
    decodeCompetitionId,
    snapshot.competition.id,
    "competitions",
    snapshot.competition.id,
  )
  if (competitionIdResult.ok === false) return err(competitionIdResult.error)
  const competitionId = competitionIdResult.value

  const organizationIdResult = decodeAt(
    decodeOrganizationId,
    snapshot.competition.organizingTeamId,
    "competitions",
    snapshot.competition.id,
  )
  if (organizationIdResult.ok === false) return err(organizationIdResult.error)
  const organizationId = organizationIdResult.value

  const teamById = new Map(snapshot.teams.map((team) => [team.id, team]))
  const organizationRow = teamById.get(snapshot.competition.organizingTeamId)
  if (!organizationRow) {
    return err(
      corrupt(
        "MISSING_ORGANIZATION",
        "competitions",
        snapshot.competition.id,
        "A competition must resolve to one organizing organization",
        [snapshot.competition.organizingTeamId],
      ),
    )
  }
  if (
    organizationRow.type !== "gym" ||
    organizationRow.isPersonalTeam ||
    organizationRow.personalTeamOwnerId !== null
  ) {
    return err(
      corrupt(
        "INVALID_ORGANIZATION_SHAPE",
        "teams",
        organizationRow.id,
        "An organization cannot also be a personal workspace or competition team",
      ),
    )
  }

  const accessTeamIdResult = decodeAt(
    decodeLegacyCompetitionAccessTeamId,
    snapshot.competition.competitionTeamId,
    "competitions",
    snapshot.competition.id,
  )
  if (accessTeamIdResult.ok === false) return err(accessTeamIdResult.error)
  const accessTeam = teamById.get(snapshot.competition.competitionTeamId)
  if (!accessTeam) {
    return err(
      corrupt(
        "MISSING_COMPETITION_ACCESS_TEAM",
        "competitions",
        snapshot.competition.id,
        "The legacy competition access projection must resolve to one team",
        [snapshot.competition.competitionTeamId],
      ),
    )
  }
  if (
    accessTeam.type !== "competition_event" ||
    accessTeam.isPersonalTeam ||
    accessTeam.parentOrganizationId !== organizationRow.id
  ) {
    return err(
      corrupt(
        "INVALID_COMPETITION_ACCESS_TEAM",
        "teams",
        accessTeam.id,
        "The access team must be a non-personal child of the organizing organization",
        [organizationRow.id],
      ),
    )
  }

  const personalWorkspaces = new Map<PersonalWorkspaceId, PersonalWorkspace>()
  for (const team of snapshot.teams) {
    if (!team.isPersonalTeam && team.type !== "personal") continue
    if (
      !team.isPersonalTeam ||
      (team.type !== "gym" && team.type !== "personal") ||
      team.personalTeamOwnerId === null ||
      team.parentOrganizationId !== null
    ) {
      return err(
        corrupt(
          "INVALID_PERSONAL_WORKSPACE",
          "teams",
          team.id,
          "A personal workspace must have one owner and no parent organization",
        ),
      )
    }
    const workspaceIdResult = decodeAt(
      decodePersonalWorkspaceId,
      team.id,
      "teams",
      team.id,
    )
    if (workspaceIdResult.ok === false) return err(workspaceIdResult.error)
    const ownerIdResult = decodeAt(
      decodeUserId,
      team.personalTeamOwnerId,
      "teams",
      team.id,
    )
    if (ownerIdResult.ok === false) return err(ownerIdResult.error)
    personalWorkspaces.set(workspaceIdResult.value, {
      id: workspaceIdResult.value,
      ownerId: ownerIdResult.value,
      name: team.name,
    })
  }

  const trackOwnerById = new Map<string, string | null>()
  for (const track of snapshot.tracks) {
    const trackIdResult = decodeAt(
      decodePersistedTrackId,
      track.id,
      "programming_tracks",
      track.id,
    )
    if (trackIdResult.ok === false) return err(trackIdResult.error)
    if (track.competitionId !== null) {
      const ownerResult = decodeAt(
        decodeCompetitionId,
        track.competitionId,
        "programming_tracks",
        track.id,
      )
      if (ownerResult.ok === false) return err(ownerResult.error)
    }
    trackOwnerById.set(track.id, track.competitionId)
  }

  const rawEventById = new Map(
    snapshot.events.map((event) => [event.id, event]),
  )
  const eventOwner = (eventId: string): string | null | undefined => {
    const event = rawEventById.get(eventId)
    return event ? trackOwnerById.get(event.trackId) : undefined
  }
  const windowByEventId = new Map<CompetitionEventId, SubmissionWindow>()
  for (const configuration of snapshot.eventConfigurations) {
    const configIdResult = decodeAt(
      decodeLegacyEventConfigurationId,
      configuration.id,
      "competition_events",
      configuration.id,
    )
    if (configIdResult.ok === false) return err(configIdResult.error)
    const configurationCompetitionIdResult = decodeAt(
      decodeCompetitionId,
      configuration.competitionId,
      "competition_events",
      configuration.id,
    )
    if (configurationCompetitionIdResult.ok === false)
      return err(configurationCompetitionIdResult.error)
    const configuredEventOwner = eventOwner(configuration.trackWorkoutId)
    if (configuredEventOwner === undefined) {
      return err(
        corrupt(
          "MISSING_EVENT",
          "competition_events",
          configuration.id,
          "Window configuration must resolve to one event occurrence",
          [configuration.trackWorkoutId],
        ),
      )
    }
    if (
      configurationCompetitionIdResult.value !== competitionId ||
      configuredEventOwner !== competitionId
    ) {
      return err(
        corrupt(
          "CROSS_COMPETITION_EVENT",
          "competition_events",
          configuration.id,
          "Window configuration and event occurrence must belong to the same competition",
          [configuration.competitionId, configuration.trackWorkoutId],
        ),
      )
    }
    const eventIdResult = decodeAt(
      decodePersistedEventId,
      configuration.trackWorkoutId,
      "competition_events",
      configuration.id,
    )
    if (eventIdResult.ok === false) return err(eventIdResult.error)
    if (windowByEventId.has(eventIdResult.value)) {
      return err(
        corrupt(
          "DUPLICATE_EVENT_CONFIGURATION",
          "competition_events",
          configuration.id,
          "An event occurrence may have at most one submission window",
          [configuration.trackWorkoutId],
        ),
      )
    }
    windowByEventId.set(eventIdResult.value, {
      opensAt: configuration.submissionOpensAt,
      closesAt: configuration.submissionClosesAt,
    })
  }

  const events = new Map<CompetitionEventId, CompetitionEvent>()
  for (const event of snapshot.events) {
    const owner = trackOwnerById.get(event.trackId)
    if (owner === undefined) {
      return err(
        corrupt(
          "MISSING_TRACK",
          "track_workouts",
          event.id,
          "Every event occurrence must resolve through a programming track",
          [event.trackId],
        ),
      )
    }
    if (owner !== competitionId) continue
    const eventIdResult = decodeAt(
      decodePersistedEventId,
      event.id,
      "track_workouts",
      event.id,
    )
    if (eventIdResult.ok === false) return err(eventIdResult.error)
    let parentEventId: CompetitionEventId | null = null
    if (event.parentEventId !== null) {
      if (eventOwner(event.parentEventId) !== competitionId) {
        return err(
          corrupt(
            "CROSS_COMPETITION_PARENT_EVENT",
            "track_workouts",
            event.id,
            "A parent and child event must belong to the same competition",
            [event.parentEventId],
          ),
        )
      }
      const parentResult = decodeAt(
        decodePersistedEventId,
        event.parentEventId,
        "track_workouts",
        event.id,
      )
      if (parentResult.ok === false) return err(parentResult.error)
      parentEventId = parentResult.value
    }
    events.set(eventIdResult.value, {
      id: eventIdResult.value,
      competitionId,
      parentEventId,
      name: event.name,
      submissionWindow: windowByEventId.get(eventIdResult.value) ?? null,
    })
  }

  if (snapshot.selectedScalingGroupId !== null) {
    const scalingGroupResult = decodeAt(
      decodeLegacyScalingGroupId,
      snapshot.selectedScalingGroupId,
      "competitions",
      snapshot.competition.id,
    )
    if (scalingGroupResult.ok === false) return err(scalingGroupResult.error)
  }

  const currentDivisionConfigurations: LegacyDivisionConfigurationIdentityRow[] =
    []
  for (const configuration of snapshot.divisionConfigurations) {
    const ownerIdResult = decodeAt(
      decodeCompetitionId,
      configuration.competitionId,
      "competition_divisions",
      configuration.id,
    )
    if (ownerIdResult.ok === false) return err(ownerIdResult.error)
    if (ownerIdResult.value === competitionId) {
      currentDivisionConfigurations.push(configuration)
    }
  }
  const divisionConfigurationById = new Map(
    currentDivisionConfigurations.map((configuration) => [
      configuration.divisionId,
      configuration,
    ]),
  )
  if (divisionConfigurationById.size !== currentDivisionConfigurations.length) {
    const duplicate = currentDivisionConfigurations.find(
      (configuration, index, all) =>
        configuration.competitionId === competitionId &&
        all.findIndex(
          (candidate) =>
            candidate.competitionId === configuration.competitionId &&
            candidate.divisionId === configuration.divisionId,
        ) !== index,
    )
    return err(
      corrupt(
        "DUPLICATE_DIVISION_CONFIGURATION",
        "competition_divisions",
        duplicate?.id ?? snapshot.competition.id,
        "A competition division may have at most one configuration row",
        duplicate ? [duplicate.divisionId] : [],
      ),
    )
  }

  const divisions = new Map<CompetitionDivisionId, CompetitionDivision>()
  for (const level of snapshot.scalingLevels) {
    if (level.scalingGroupId !== snapshot.selectedScalingGroupId) continue
    const divisionIdResult = decodeAt(
      decodeCompetitionDivisionId,
      level.id,
      "scaling_levels",
      level.id,
    )
    if (divisionIdResult.ok === false) return err(divisionIdResult.error)
    if (!Number.isInteger(level.teamSize) || level.teamSize < 1) {
      return err(
        corrupt(
          "INVALID_DIVISION",
          "scaling_levels",
          level.id,
          "Competition division team size must be a positive integer",
        ),
      )
    }
    const configuration = divisionConfigurationById.get(level.id)
    divisions.set(divisionIdResult.value, {
      id: divisionIdResult.value,
      competitionId,
      label: level.label,
      order: level.position,
      teamSize: level.teamSize,
      feeCents: configuration?.feeCents ?? null,
      description: configuration?.description ?? null,
      maxSpots: configuration?.maxSpots ?? null,
      sourceScalingLevelId: divisionIdResult.value,
    })
  }
  for (const configuration of currentDivisionConfigurations) {
    const divisionResult = decodeAt(
      decodeCompetitionDivisionId,
      configuration.divisionId,
      "competition_divisions",
      configuration.id,
    )
    if (divisionResult.ok === false) return err(divisionResult.error)
    if (!divisions.has(divisionResult.value)) {
      return err(
        corrupt(
          "DIVISION_OUTSIDE_COMPETITION",
          "competition_divisions",
          configuration.id,
          "Division configuration must target the competition's selected division set",
          [configuration.divisionId],
        ),
      )
    }
  }

  const memberships = snapshot.memberships ?? []
  const squads = new Map<SquadId, Squad>()
  const registrations = new Map<RegistrationId, Registration>()
  const participantIds = new Set<UserId>()
  for (const row of snapshot.registrations) {
    const registrationIdResult = decodeAt(
      decodeRegistrationId,
      row.id,
      "competition_registrations",
      row.id,
    )
    if (registrationIdResult.ok === false)
      return err(registrationIdResult.error)
    const registrationCompetitionIdResult = decodeAt(
      decodeCompetitionId,
      row.eventId,
      "competition_registrations",
      row.id,
    )
    if (registrationCompetitionIdResult.ok === false)
      return err(registrationCompetitionIdResult.error)
    if (registrationCompetitionIdResult.value !== competitionId) {
      return err(
        corrupt(
          "CROSS_COMPETITION_REGISTRATION",
          "competition_registrations",
          row.id,
          "Registration and competition must have the same identity",
          [row.eventId, competitionId],
        ),
      )
    }
    let selection: DivisionSelection = { kind: "open" }
    let division: CompetitionDivision | undefined
    if (row.divisionId !== null) {
      const divisionIdResult = decodeAt(
        decodeCompetitionDivisionId,
        row.divisionId,
        "competition_registrations",
        row.id,
      )
      if (divisionIdResult.ok === false) return err(divisionIdResult.error)
      division = divisions.get(divisionIdResult.value)
      if (!division) {
        return err(
          corrupt(
            "DIVISION_OUTSIDE_COMPETITION",
            "competition_registrations",
            row.id,
            "A registration division must belong to its competition",
            [row.divisionId, competitionId],
          ),
        )
      }
      selection = { kind: "named", divisionId: division.id }
    }
    const athleteIdResult = decodeAt(
      decodeUserId,
      row.userId,
      "competition_registrations",
      row.id,
    )
    if (athleteIdResult.ok === false) return err(athleteIdResult.error)

    let participation: Registration["participation"]
    if (row.athleteTeamId === null) {
      if (division && division.teamSize !== 1) {
        return err(
          corrupt(
            "PARTICIPATION_MODE_MISMATCH",
            "competition_registrations",
            row.id,
            "A squad division registration must reference a squad",
            [division.id],
          ),
        )
      }
      participation = { kind: "individual", athleteId: athleteIdResult.value }
      if (row.status === "active") participantIds.add(athleteIdResult.value)
    } else {
      if (division?.teamSize === 1) {
        return err(
          corrupt(
            "PARTICIPATION_MODE_MISMATCH",
            "competition_registrations",
            row.id,
            "An individual division registration cannot reference a squad",
            [division.id, row.athleteTeamId],
          ),
        )
      }
      const squadIdResult = decodeAt(
        decodeSquadId,
        row.athleteTeamId,
        "competition_registrations",
        row.id,
      )
      if (squadIdResult.ok === false) return err(squadIdResult.error)
      const squadRow = teamById.get(row.athleteTeamId)
      if (!squadRow) {
        return err(
          corrupt(
            "MISSING_SQUAD",
            "competition_registrations",
            row.id,
            "A squad registration must resolve to one legacy squad row",
            [row.athleteTeamId],
          ),
        )
      }
      if (
        squadRow.type !== "competition_team" ||
        squadRow.parentOrganizationId !== accessTeam.id
      ) {
        return err(
          corrupt(
            "INVALID_SQUAD",
            "teams",
            squadRow.id,
            "A legacy squad must be a child of the competition access team",
            [accessTeam.id],
          ),
        )
      }
      const metadata = parseSquadMetadata(squadRow)
      if (metadata.ok === false) return err(metadata.error)
      if (metadata.value !== null) {
        const squadCompetitionIdResult = decodeAt(
          decodeCompetitionId,
          metadata.value.competitionId,
          "teams",
          squadRow.id,
        )
        if (squadCompetitionIdResult.ok === false)
          return err(squadCompetitionIdResult.error)
        const squadDivisionIdResult = decodeAt(
          decodeCompetitionDivisionId,
          metadata.value.divisionId,
          "teams",
          squadRow.id,
        )
        if (squadDivisionIdResult.ok === false)
          return err(squadDivisionIdResult.error)
        if (squadCompetitionIdResult.value !== competitionId) {
          return err(
            corrupt(
              "CROSS_COMPETITION_SQUAD",
              "teams",
              squadRow.id,
              "Squad and registration must belong to the same competition",
              [metadata.value.competitionId, competitionId],
            ),
          )
        }
      }
      // Transfers update registrations, leaving the old metadata division behind.
      const previousSquad = squads.get(squadIdResult.value)
      if (
        previousSquad &&
        (previousSquad.division.kind !== selection.kind ||
          (previousSquad.division.kind === "named" &&
            selection.kind === "named" &&
            previousSquad.division.divisionId !== selection.divisionId))
      ) {
        return err(
          corrupt(
            "CROSS_DIVISION_SQUAD",
            "teams",
            squadRow.id,
            "All registrations for a squad must agree on its division",
          ),
        )
      }
      const captainIdResult = decodeAt(
        decodeUserId,
        row.captainUserId ?? row.userId,
        "competition_registrations",
        row.id,
      )
      if (captainIdResult.ok === false) return err(captainIdResult.error)
      if (previousSquad && previousSquad.captainId !== captainIdResult.value) {
        return err(
          corrupt(
            "CONFLICTING_SQUAD_CAPTAIN",
            "competition_registrations",
            row.id,
            "All registrations for a squad must agree on its captain",
            [previousSquad.captainId, captainIdResult.value],
          ),
        )
      }
      const memberRows = memberships.filter(
        (membership) =>
          membership.teamId === squadRow.id && membership.isActive,
      )
      const members: Array<Squad["members"][number]> = []
      let hasCaptain = false
      for (const membership of memberRows) {
        const memberIdResult = decodeAt(
          decodeUserId,
          membership.userId,
          "team_memberships",
          `${membership.teamId}:${membership.userId}`,
        )
        if (memberIdResult.ok === false) return err(memberIdResult.error)
        const role =
          memberIdResult.value === captainIdResult.value ? "captain" : "member"
        if (
          memberIdResult.value === captainIdResult.value &&
          (row.captainUserId != null || membership.roleId === "captain")
        ) {
          hasCaptain = true
        }
        members.push({ userId: memberIdResult.value, role })
        if (row.status === "active") participantIds.add(memberIdResult.value)
      }
      if (row.status === "active" && !hasCaptain) {
        return err(
          corrupt(
            "MISSING_SQUAD_CAPTAIN",
            "teams",
            squadRow.id,
            "An active squad must have its declared captain in the active roster",
            [captainIdResult.value],
          ),
        )
      }
      squads.set(squadIdResult.value, {
        id: squadIdResult.value,
        competitionId,
        division: selection,
        name: squadRow.name,
        captainId: captainIdResult.value,
        members,
      })
      participation = { kind: "squad", squadId: squadIdResult.value }
    }

    registrations.set(registrationIdResult.value, {
      id: registrationIdResult.value,
      competitionId,
      division: selection,
      participation,
      state: { kind: row.status },
    })
  }

  return ok({
    competition: {
      id: competitionId,
      organizationId,
      name: snapshot.competition.name,
    },
    organization: { id: organizationId, name: organizationRow.name },
    personalWorkspaces,
    events,
    divisions,
    registrations,
    squads,
    access: {
      legacyAccessTeamId: accessTeamIdResult.value,
      participantIds,
    },
  })
}
