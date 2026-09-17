import type {
  CompetitionDivisionId,
  CompetitionEventId,
  CompetitionId,
  LegacyCompetitionAccessTeamId,
  OrganizationId,
  PersonalWorkspaceId,
  RegistrationId,
  SquadId,
  UserId,
} from "./ids"

export interface Organization {
  readonly id: OrganizationId
  readonly name: string
}

export interface PersonalWorkspace {
  readonly id: PersonalWorkspaceId
  readonly ownerId: UserId
  readonly name: string
}

export interface Competition {
  readonly id: CompetitionId
  readonly organizationId: OrganizationId
  readonly name: string
}

export interface SubmissionWindow {
  readonly opensAt: string | null
  readonly closesAt: string | null
}

export interface CompetitionEvent {
  readonly id: CompetitionEventId
  readonly competitionId: CompetitionId
  readonly parentEventId: CompetitionEventId | null
  readonly name: string
  readonly submissionWindow: SubmissionWindow | null
}

export interface CompetitionDivision {
  readonly id: CompetitionDivisionId
  readonly competitionId: CompetitionId
  readonly label: string
  readonly order: number
  readonly teamSize: number
  readonly feeCents: number | null
  readonly description: string | null
  readonly maxSpots: number | null
  readonly sourceScalingLevelId: CompetitionDivisionId
}

export type Participation =
  | Readonly<{ kind: "individual"; athleteId: UserId }>
  | Readonly<{ kind: "squad"; squadId: SquadId }>

export type RegistrationState =
  | Readonly<{ kind: "active" }>
  | Readonly<{ kind: "removed" }>

export interface Registration {
  readonly id: RegistrationId
  readonly competitionId: CompetitionId
  readonly divisionId: CompetitionDivisionId
  readonly participation: Participation
  readonly state: RegistrationState
}

export interface SquadMember {
  readonly userId: UserId
  readonly role: "captain" | "member"
}

export interface Squad {
  readonly id: SquadId
  readonly competitionId: CompetitionId
  readonly divisionId: CompetitionDivisionId
  readonly name: string
  readonly captainId: UserId
  readonly members: readonly SquadMember[]
}

export interface CompetitionAccessProjection {
  readonly legacyAccessTeamId: LegacyCompetitionAccessTeamId
  readonly participantIds: ReadonlySet<UserId>
}

export interface CompetitionTopology {
  readonly competition: Competition
  readonly organization: Organization
  readonly personalWorkspaces: ReadonlyMap<
    PersonalWorkspaceId,
    PersonalWorkspace
  >
  readonly events: ReadonlyMap<CompetitionEventId, CompetitionEvent>
  readonly divisions: ReadonlyMap<CompetitionDivisionId, CompetitionDivision>
  readonly registrations: ReadonlyMap<RegistrationId, Registration>
  readonly squads: ReadonlyMap<SquadId, Squad>
  readonly access: CompetitionAccessProjection
}
