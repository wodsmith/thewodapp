export {
  insertManualSubmissionWorkoutResult,
  type ManualSubmissionWorkoutResultInput,
  type ManualSubmissionWorkoutResultTarget,
  type NormalizedReviewedSubmissionWorkoutResult,
  normalizeInvalidatedSubmissionWorkoutResult,
  normalizeManualSubmissionWorkoutResult,
  normalizeSubmissionScoreAdjustment,
  type SubmissionScoreAdjustmentInput,
  updateReviewedSubmissionWorkoutResult,
} from "../workout-results/review"
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
  type CompetitionResultSource,
  type DivisionScope,
  divisionIdFromScope,
  divisionScopeFromId,
  type RecordCompetitionResultCommand,
} from "./domain"
export { recordCompetitionResult } from "./service"
