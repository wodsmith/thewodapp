/** Raised only after ownership and current destination access have passed. */
export class WorkoutImportSessionExpiredError extends Error {
  constructor() {
    super("Workout import session expired")
    this.name = "WorkoutImportSessionExpiredError"
  }
}
