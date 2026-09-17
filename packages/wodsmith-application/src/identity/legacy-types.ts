export type LegacyTeamType =
  | "gym"
  | "competition_event"
  | "competition_team"
  | "personal"
  | string

export interface LegacyTeamIdentityRow {
  readonly id: string
  readonly name: string
  readonly type: LegacyTeamType
  readonly isPersonalTeam: boolean
  readonly personalTeamOwnerId: string | null
  readonly parentOrganizationId: string | null
  readonly competitionMetadata: string | null
}

export interface LegacyCompetitionIdentityRow {
  readonly id: string
  readonly organizingTeamId: string
  readonly competitionTeamId: string
  readonly name: string
}

export interface LegacyProgrammingTrackIdentityRow {
  readonly id: string
  readonly competitionId: string | null
}

export interface LegacyCompetitionEventIdentityRow {
  readonly id: string
  readonly trackId: string
  readonly parentEventId: string | null
  readonly name: string
}

export interface LegacyEventConfigurationIdentityRow {
  readonly id: string
  readonly competitionId: string
  readonly trackWorkoutId: string
  readonly submissionOpensAt: string | null
  readonly submissionClosesAt: string | null
}

export interface LegacyScalingLevelIdentityRow {
  readonly id: string
  readonly scalingGroupId: string
  readonly label: string
  readonly position: number
  readonly teamSize: number
}

export interface LegacyDivisionConfigurationIdentityRow {
  readonly id: string
  readonly competitionId: string
  readonly divisionId: string
  readonly feeCents: number
  readonly description: string | null
  readonly maxSpots: number | null
}

export interface LegacyRegistrationIdentityRow {
  readonly id: string
  readonly eventId: string
  readonly userId: string
  readonly divisionId: string | null
  readonly status: "active" | "removed"
  readonly athleteTeamId: string | null
}

export interface LegacyTeamMembershipIdentityRow {
  readonly teamId: string
  readonly userId: string
  readonly roleId: string
  readonly isActive: boolean
}

export interface LegacyCompetitionIdentitySnapshot {
  readonly competition: LegacyCompetitionIdentityRow
  readonly teams: readonly LegacyTeamIdentityRow[]
  readonly tracks: readonly LegacyProgrammingTrackIdentityRow[]
  readonly events: readonly LegacyCompetitionEventIdentityRow[]
  readonly eventConfigurations: readonly LegacyEventConfigurationIdentityRow[]
  readonly selectedScalingGroupId: string
  readonly scalingLevels: readonly LegacyScalingLevelIdentityRow[]
  readonly divisionConfigurations: readonly LegacyDivisionConfigurationIdentityRow[]
  readonly registrations: readonly LegacyRegistrationIdentityRow[]
  readonly memberships?: readonly LegacyTeamMembershipIdentityRow[]
}
