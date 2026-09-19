import type {
  CompetitionDivisionId,
  CompetitionEventId,
  CompetitionId,
  OrganizationId,
  RegistrationId,
  SquadId,
} from "./ids"

type IsAssignable<TFrom, TTo> = TFrom extends TTo ? true : false
type AssertFalse<TValue extends false> = TValue

type EventIsNotCompetition = AssertFalse<
  IsAssignable<CompetitionEventId, CompetitionId>
>
type DivisionIsNotEvent = AssertFalse<
  IsAssignable<CompetitionDivisionId, CompetitionEventId>
>
type OrganizationIsNotCompetition = AssertFalse<
  IsAssignable<OrganizationId, CompetitionId>
>
type SquadIsNotRegistration = AssertFalse<IsAssignable<SquadId, RegistrationId>>

export type IdentityCompileTimeContract =
  | EventIsNotCompetition
  | DivisionIsNotEvent
  | OrganizationIsNotCompetition
  | SquadIsNotRegistration
