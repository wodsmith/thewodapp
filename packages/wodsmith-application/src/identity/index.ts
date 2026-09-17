export type {
  BrandedId,
  CompetitionDivisionId,
  CompetitionEventId,
  CompetitionId,
  InvalidIdentifier,
  LegacyCompetitionAccessTeamId,
  LegacyEventConfigurationId,
  LegacyProgrammingTrackId,
  LegacyScalingGroupId,
  OrganizationId,
  PersonalWorkspaceId,
  RegistrationId,
  SquadId,
  UserId,
} from "./ids"
export {
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
} from "./ids"
export type {
  IdentityCorruption,
  IdentityCorruptionCode,
} from "./legacy-adapter"
export { resolveLegacyCompetitionTopology } from "./legacy-adapter"
export type {
  LegacyCompetitionEventIdentityRow,
  LegacyCompetitionIdentityRow,
  LegacyCompetitionIdentitySnapshot,
  LegacyDivisionConfigurationIdentityRow,
  LegacyEventConfigurationIdentityRow,
  LegacyProgrammingTrackIdentityRow,
  LegacyRegistrationIdentityRow,
  LegacyScalingLevelIdentityRow,
  LegacyTeamIdentityRow,
  LegacyTeamMembershipIdentityRow,
  LegacyTeamType,
} from "./legacy-types"
export type {
  Competition,
  CompetitionAccessProjection,
  CompetitionDivision,
  CompetitionEvent,
  CompetitionTopology,
  Organization,
  Participation,
  PersonalWorkspace,
  Registration,
  RegistrationState,
  Squad,
  SquadMember,
  SubmissionWindow,
} from "./model"
export type {
  CompetitionNotFound,
  CompetitionTopologyLoadError,
  CompetitionTopologyStore,
  IdentityReadFailure,
  LegacyCompetitionIdentityReader,
} from "./store"
export { createLegacyCompetitionIdentityAdapter } from "./store"
