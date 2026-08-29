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
  normalizeSubmittedVideoWorkoutResult,
  persistSubmittedVideoWorkoutResult,
  type SubmittedVideoWorkoutResultInput,
  type SubmittedVideoWorkoutResultTarget,
} from "./video"
