export {
  type CompetitionResultRevision,
  decideCompetitionResult,
  type ProgrammedWorkoutDefinition,
} from "./decision"
export {
  type CompetitionResultClaim,
  CompetitionResultError,
  type CompetitionResultReceipt,
  type CompetitionResultRoundClaim,
  type DivisionScope,
  divisionIdFromScope,
  divisionScopeFromId,
  type RecordCompetitionResultCommand,
} from "./domain"
export {
  insertManualSubmissionWorkoutResult,
  type ManualSubmissionWorkoutResultTarget,
  updateReviewedSubmissionWorkoutResult,
} from "./repository"
export {
  type ManualSubmissionWorkoutResultInput,
  type NormalizedReviewedSubmissionWorkoutResult,
  normalizeInvalidatedSubmissionWorkoutResult,
  normalizeManualSubmissionWorkoutResult,
  normalizeSubmissionScoreAdjustment,
  type SubmissionScoreAdjustmentInput,
} from "./review"
export { recordCompetitionResult } from "./service"
