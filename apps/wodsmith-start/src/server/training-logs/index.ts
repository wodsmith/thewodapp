/**
 * Personal training-log boundary.
 *
 * Competition code must not import from this module. The implementation still
 * reuses the neutral scoring kernel while the public domain surface remains
 * separate from competition results.
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
} from "../workout-results/personal"
