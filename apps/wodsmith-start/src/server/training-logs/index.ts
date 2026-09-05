/**
 * Personal training-log boundary.
 *
 * Competition code must not import from this module. Personal writes share only
 * pure scoring helpers with competition results.
 */
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
