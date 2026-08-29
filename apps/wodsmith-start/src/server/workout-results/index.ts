export {
  type CompetitionWorkoutResultInput,
  type NormalizedCompetitionWorkoutResult,
  normalizeCompetitionWorkoutResult,
} from "./normalize"
export {
  type CreatePersonalWorkoutResultInput,
  createPersonalWorkoutResult,
  type NormalizedSubmittedPersonalWorkoutResult,
  normalizeSubmittedPersonalWorkoutResult,
  type SubmitPersonalWorkoutResultInput,
  submitPersonalWorkoutResult,
  type UpdatePersonalWorkoutResultInput,
  updatePersonalWorkoutResult,
} from "./personal"
export {
  type CompetitionWorkoutResultTarget,
  replaceCompetitionWorkoutResult,
} from "./replace"
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
} from "./review"
export {
  type AthleteSelfEntryWorkoutResultInput,
  type AthleteSelfEntryWorkoutResultTarget,
  type NormalizedAthleteSelfEntryWorkoutResult,
  normalizeAthleteSelfEntryWorkoutResult,
  persistAthleteSelfEntryWorkoutResult,
} from "./self-entry"
export {
  normalizeSubmittedVideoWorkoutResult,
  persistSubmittedVideoWorkoutResult,
  type SubmittedVideoWorkoutResultInput,
  type SubmittedVideoWorkoutResultTarget,
} from "./video"
