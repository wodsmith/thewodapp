/**
 * Sort direction utilities
 */

import { DEFAULT_SCORE_TYPES, SCHEME_SORT_DIRECTIONS } from "../constants"
import type { ScoreType, SortDirection, WorkoutScheme } from "../types"

/**
 * Get the sort direction for a workout scheme.
 * 
 * Some schemes are "lower is better" (time), others are "higher is better" (reps).
 * The scoreType can override the default direction.
 *
 * @param scheme - Workout scheme
 * @param scoreType - Optional score type override
 *
 * @example
 * getSortDirection("time")           // → "asc" (lower time is better)
 * getSortDirection("rounds-reps")    // → "desc" (higher is better)
 * getSortDirection("load")           // → "desc" (higher load is better)
 * getSortDirection("time", "max")    // → "desc" (max override)
 */
export function getSortDirection(
	scheme: WorkoutScheme,
	scoreType?: ScoreType,
): SortDirection {
	// If scoreType is explicitly provided, use its implied direction
	if (scoreType) {
		// "min" means lower is better → sort ascending
		// "max" means higher is better → sort descending
		// Other types (sum, average, first, last) use scheme default
		if (scoreType === "min") return "asc"
		if (scoreType === "max") return "desc"
	}

	// Use scheme's default direction
	return SCHEME_SORT_DIRECTIONS[scheme]
}

/**
 * Check if lower values are better for sorting.
 *
 * @example
 * isLowerBetter("time")           // → true
 * isLowerBetter("rounds-reps")    // → false
 */
export function isLowerBetter(
	scheme: WorkoutScheme,
	scoreType?: ScoreType,
): boolean {
	return getSortDirection(scheme, scoreType) === "asc"
}

/**
 * Get the default score type for a scheme.
 *
 * @example
 * getDefaultScoreType("time")        // → "min"
 * getDefaultScoreType("rounds-reps") // → "max"
 */
export function getDefaultScoreType(scheme: WorkoutScheme): ScoreType {
	return DEFAULT_SCORE_TYPES[scheme]
}
