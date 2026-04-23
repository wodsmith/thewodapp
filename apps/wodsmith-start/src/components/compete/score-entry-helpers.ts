import type { WorkoutScheme } from "@/lib/scoring"

/**
 * UI-facing helpers shared across the athlete submission form and the
 * organizer/volunteer reviewer surfaces so score-entry inputs label,
 * placeholder, and help-text consistently.
 */

export function getSchemeLabel(scheme: WorkoutScheme): string {
  switch (scheme) {
    case "time":
    case "time-with-cap":
    case "emom":
      return "Time"
    case "rounds-reps":
      return "Rounds + Reps"
    case "reps":
      return "Reps"
    case "load":
      return "Load (lbs)"
    case "calories":
      return "Calories"
    case "meters":
      return "Meters"
    case "feet":
      return "Feet"
    case "points":
      return "Points"
    case "pass-fail":
      return "Rounds Passed"
    default:
      return "Score"
  }
}

export function getScorePlaceholder(scheme: WorkoutScheme): string {
  switch (scheme) {
    case "time":
    case "time-with-cap":
    case "emom":
      return "e.g., 5:30 or 330"
    case "rounds-reps":
      return "e.g., 5+12 or 5.12"
    case "reps":
      return "e.g., 150"
    case "load":
      return "e.g., 225"
    case "calories":
      return "e.g., 50"
    case "meters":
      return "e.g., 1000"
    case "feet":
      return "e.g., 3000"
    case "points":
      return "e.g., 100"
    case "pass-fail":
      return "Rounds passed"
    default:
      return "Enter score"
  }
}

export function getScoreHelpText(
  scheme: WorkoutScheme,
  timeCap?: number | null,
): string {
  switch (scheme) {
    case "time":
      return "Enter as minutes:seconds (5:30) or total seconds (330)"
    case "time-with-cap":
      return timeCap
        ? `Enter as minutes:seconds (5:30) or total seconds. Time cap: ${Math.floor(timeCap / 60)}:${String(timeCap % 60).padStart(2, "0")}`
        : "Enter as minutes:seconds (5:30) or total seconds"
    case "rounds-reps":
      return "Enter as rounds+reps (5+12) or rounds.reps (5.12)"
    case "emom":
      return "Enter as minutes:seconds or total seconds"
    default:
      return ""
  }
}
