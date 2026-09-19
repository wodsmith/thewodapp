import { err, ok, type Result } from "../core/result"

declare const identityBrand: unique symbol

export type BrandedId<TName extends string> = string & {
  readonly [identityBrand]: TName
}

export type OrganizationId = BrandedId<"OrganizationId">
export type PersonalWorkspaceId = BrandedId<"PersonalWorkspaceId">
export type CompetitionId = BrandedId<"CompetitionId">
export type CompetitionEventId = BrandedId<"CompetitionEventId">
export type CompetitionDivisionId = BrandedId<"CompetitionDivisionId">
export type RegistrationId = BrandedId<"RegistrationId">
export type SquadId = BrandedId<"SquadId">
export type UserId = BrandedId<"UserId">

export type LegacyCompetitionAccessTeamId =
  BrandedId<"LegacyCompetitionAccessTeamId">
export type LegacyEventConfigurationId = BrandedId<"LegacyEventConfigurationId">
export type LegacyProgrammingTrackId = BrandedId<"LegacyProgrammingTrackId">
export type LegacyScalingGroupId = BrandedId<"LegacyScalingGroupId">

export interface InvalidIdentifier {
  readonly kind: "InvalidIdentifier"
  readonly value: string
  readonly identity: string
  readonly expectedPrefix: string
}

type IdDecoder<TId extends string> = (
  value: string,
) => Result<TId, InvalidIdentifier>

function decoder<TId extends string>(
  identity: string,
  expectedPrefix: string,
): IdDecoder<TId> {
  return (value) => {
    if (
      !value.startsWith(expectedPrefix) ||
      value.length === expectedPrefix.length
    ) {
      return err({
        kind: "InvalidIdentifier",
        value,
        identity,
        expectedPrefix,
      })
    }

    return ok(value as TId)
  }
}

export const decodeOrganizationId = decoder<OrganizationId>(
  "OrganizationId",
  "team_",
)
export const decodePersonalWorkspaceId = decoder<PersonalWorkspaceId>(
  "PersonalWorkspaceId",
  "team_",
)
export const decodeCompetitionId = decoder<CompetitionId>(
  "CompetitionId",
  "comp_",
)
export const decodeCompetitionEventId = decoder<CompetitionEventId>(
  "CompetitionEventId",
  "trwk_",
)
export const decodeCompetitionDivisionId = decoder<CompetitionDivisionId>(
  "CompetitionDivisionId",
  "slvl_",
)
export const decodeRegistrationId = decoder<RegistrationId>(
  "RegistrationId",
  "creg_",
)
export const decodeSquadId = decoder<SquadId>("SquadId", "team_")
export const decodeUserId = decoder<UserId>("UserId", "usr_")

export const decodeLegacyCompetitionAccessTeamId =
  decoder<LegacyCompetitionAccessTeamId>(
    "LegacyCompetitionAccessTeamId",
    "team_",
  )
export const decodeLegacyEventConfigurationId =
  decoder<LegacyEventConfigurationId>("LegacyEventConfigurationId", "cevt_")
export const decodeLegacyProgrammingTrackId = decoder<LegacyProgrammingTrackId>(
  "LegacyProgrammingTrackId",
  "ptrk_",
)
export const decodeLegacyScalingGroupId = decoder<LegacyScalingGroupId>(
  "LegacyScalingGroupId",
  "sgrp_",
)
