import { err, ok, type Result } from "../core/result"
import type {
  CompetitionDivisionId,
  CompetitionEventId,
  CompetitionId,
  OrganizationId,
  RegistrationId,
  UserId,
} from "../identity"

declare const scoreResultBrand: unique symbol
export type ScoreResultId = string & {
  readonly [scoreResultBrand]: "ScoreResultId"
}

export type ScoreDivisionScope =
  | Readonly<{ kind: "open" }>
  | Readonly<{
      kind: "division"
      divisionId: CompetitionDivisionId
    }>

export interface RemoveCompetitionScoreCommand {
  readonly kind: "RemoveCompetitionScore"
  readonly competitionId: CompetitionId
  readonly organizationId: OrganizationId
  readonly competitionEventId: CompetitionEventId
  readonly athleteId: UserId
  readonly division: ScoreDivisionScope
  readonly reason: "organizer-clear"
}

/** A storage adapter grants authority only after resolving the whole tuple. */
export interface ParticipationEventProof {
  readonly registrationId: RegistrationId
  readonly competitionId: CompetitionId
  readonly organizationId: OrganizationId
  readonly competitionEventId: CompetitionEventId
  readonly athleteId: UserId
  readonly division: ScoreDivisionScope
}

export type ScoreCommandError =
  | Readonly<{ kind: "CompetitionNotFound" }>
  | Readonly<{ kind: "EventNotFound" }>
  | Readonly<{ kind: "ParticipationNotFound" }>
  | Readonly<{ kind: "AmbiguousParticipation" }>
  | Readonly<{
      kind: "ContextMismatch"
      mismatches: readonly (
        | "competition"
        | "organization"
        | "event"
        | "athlete"
        | "division"
      )[]
    }>
  | Readonly<{
      kind: "StorageUnavailable"
      retryable: true
      cause: unknown
    }>

export interface ResultRemoved {
  readonly kind: "ResultRemoved"
  readonly registrationId: RegistrationId
  readonly competitionEventId: CompetitionEventId
  readonly removedResultIds: readonly ScoreResultId[]
  readonly reason: "organizer-clear"
}

export interface ScoreRemovalDecision {
  readonly resultIds: readonly ScoreResultId[]
  readonly facts: readonly ResultRemoved[]
}

export interface ScoreRemovalReceipt {
  readonly operation: "remove-competition-score"
  readonly outcome: "accepted"
  readonly aggregateIds: Readonly<{
    registrationId: RegistrationId
    competitionEventId: CompetitionEventId
  }>
  readonly removedCount: number
  readonly implementationVersion: "score-removal-v1"
}

function sameDivision(
  left: ScoreDivisionScope,
  right: ScoreDivisionScope,
): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === "open" ||
      (right.kind === "division" && left.divisionId === right.divisionId))
  )
}

/** Purely decides whether an identity proof authorizes the requested removal. */
export function decideScoreRemoval(input: {
  command: RemoveCompetitionScoreCommand
  identity: ParticipationEventProof
  resultIds: readonly ScoreResultId[]
}): Result<ScoreRemovalDecision, ScoreCommandError> {
  const { command, identity, resultIds } = input
  const mismatches: Extract<
    ScoreCommandError,
    { kind: "ContextMismatch" }
  >["mismatches"][number][] = []

  if (command.competitionId !== identity.competitionId)
    mismatches.push("competition")
  if (command.organizationId !== identity.organizationId)
    mismatches.push("organization")
  if (command.competitionEventId !== identity.competitionEventId)
    mismatches.push("event")
  if (command.athleteId !== identity.athleteId) mismatches.push("athlete")
  if (!sameDivision(command.division, identity.division))
    mismatches.push("division")

  if (mismatches.length > 0) return err({ kind: "ContextMismatch", mismatches })

  return ok({
    resultIds,
    facts:
      resultIds.length === 0
        ? []
        : [
            {
              kind: "ResultRemoved",
              registrationId: identity.registrationId,
              competitionEventId: identity.competitionEventId,
              removedResultIds: resultIds,
              reason: command.reason,
            },
          ],
  })
}

export interface ScoreRemovalTransaction {
  resolveIdentity(
    command: RemoveCompetitionScoreCommand,
  ): Promise<Result<ParticipationEventProof, ScoreCommandError>>
  findResultIds(
    identity: ParticipationEventProof,
  ): Promise<readonly ScoreResultId[]>
  removeRoundProjections(resultIds: readonly ScoreResultId[]): Promise<void>
  removeResultProjections(resultIds: readonly ScoreResultId[]): Promise<void>
}

export interface ScoreRemovalStore {
  transaction<T>(work: (tx: ScoreRemovalTransaction) => Promise<T>): Promise<T>
}

/** Owns identity resolution and both projection deletes in one transaction. */
export async function handleRemoveCompetitionScore(input: {
  command: RemoveCompetitionScoreCommand
  store: ScoreRemovalStore
}): Promise<Result<ScoreRemovalReceipt, ScoreCommandError>> {
  const { command, store } = input

  try {
    return await store.transaction(async (tx) => {
      const identityResult = await tx.resolveIdentity(command)
      if (!identityResult.ok) return identityResult

      const resultIds = await tx.findResultIds(identityResult.value)
      const decision = decideScoreRemoval({
        command,
        identity: identityResult.value,
        resultIds,
      })
      if (!decision.ok) return decision

      if (decision.value.resultIds.length > 0) {
        await tx.removeRoundProjections(decision.value.resultIds)
        await tx.removeResultProjections(decision.value.resultIds)
      }

      return ok({
        operation: "remove-competition-score",
        outcome: "accepted",
        aggregateIds: {
          registrationId: identityResult.value.registrationId,
          competitionEventId: identityResult.value.competitionEventId,
        },
        removedCount: decision.value.resultIds.length,
        implementationVersion: "score-removal-v1",
      })
    })
  } catch (cause) {
    return err({ kind: "StorageUnavailable", retryable: true, cause })
  }
}
