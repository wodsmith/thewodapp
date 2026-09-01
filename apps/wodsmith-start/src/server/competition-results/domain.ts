import type { ScoreStatus } from "@/db/schemas/workouts"

export type CompetitionResultSource =
  | "athlete-entry"
  | "judge-entry"
  | "organizer-entry"
  | "video-submission"
  | "import"

export type DivisionScope =
  | { kind: "open" }
  | { kind: "division"; divisionId: string }

export interface CompetitionResultRoundClaim {
  score: string
  parts?: [string, string]
  /** Explicit performance state. Missing means scored for legacy clients. */
  status?: "scored" | "cap"
  /** Reps completed when this round ended at the time cap. */
  secondaryScore?: string | null
}

export interface CompetitionResultClaim {
  score?: string
  status: ScoreStatus
  tiebreakScore?: string | null
  secondaryScore?: string | null
  roundScores?: CompetitionResultRoundClaim[]
}

export interface RecordCompetitionResultCommand {
  type: "record"
  source: CompetitionResultSource
  actorUserId?: string
  athleteUserId: string
  trackWorkoutId: string
  divisionScope: DivisionScope
  claim: CompetitionResultClaim
  recordedAt?: Date
  /** Optional consistency assertions for legacy callers during cutover. */
  expectedWorkoutId?: string
  expectedOwnerTeamId?: string
}

export interface CompetitionResultReceipt {
  scoreId: string
  isNew: boolean
}

export type CompetitionResultErrorCode =
  | "programmed_workout_not_found"
  | "programmed_workout_mismatch"
  | "invalid_score"
  | "invalid_round_score"
  | "incomplete_rounds"
  | "invalid_cap"
  | "invalid_tiebreak"
  | "persistence_failed"

export class CompetitionResultError extends Error {
  constructor(
    public readonly code: CompetitionResultErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "CompetitionResultError"
  }
}

export function divisionScopeFromId(divisionId: string | null): DivisionScope {
  return divisionId ? { kind: "division", divisionId } : { kind: "open" }
}

export function divisionIdFromScope(scope: DivisionScope): string | null {
  return scope.kind === "division" ? scope.divisionId : null
}
