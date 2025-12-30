/**
 * Aggregation module: combines multiple round values into a single score
 */

import { DEFAULT_SCORE_TYPES } from "../constants"
import type { ScoreType, WorkoutScheme } from "../types"

/**
 * Aggregate an array of values based on the score type.
 *
 * @param values - Array of numeric values to aggregate
 * @param scoreType - Aggregation method
 *
 * @example
 * aggregateValues([100, 150, 125], "max")     // → 150
 * aggregateValues([100, 150, 125], "min")     // → 100
 * aggregateValues([100, 150, 125], "sum")     // → 375
 * aggregateValues([100, 150, 125], "average") // → 125
 * aggregateValues([100, 150, 125], "first")   // → 100
 * aggregateValues([100, 150, 125], "last")    // → 125
 */
export function aggregateValues(
	values: number[],
	scoreType: ScoreType,
): number | null {
	if (values.length === 0) return null

	switch (scoreType) {
		case "min":
			return Math.min(...values)

		case "max":
			return Math.max(...values)

		case "sum":
			return values.reduce((sum, v) => sum + v, 0)

		case "average": {
			const sum = values.reduce((s, v) => s + v, 0)
			return Math.round(sum / values.length)
		}

		case "first":
			return values[0] ?? null

		case "last":
			return values[values.length - 1] ?? null

		default:
			return null
	}
}

/**
 * Get the default score type for a workout scheme.
 *
 * @example
 * getDefaultScoreType("time")        // → "min"
 * getDefaultScoreType("rounds-reps") // → "max"
 * getDefaultScoreType("load")        // → "max"
 */
export function getDefaultScoreType(scheme: WorkoutScheme): ScoreType {
	return DEFAULT_SCORE_TYPES[scheme]
}

/**
 * Determine if lower values are better for a given score type.
 *
 * @example
 * isLowerBetter("min")  // → true
 * isLowerBetter("max")  // → false
 */
export function isLowerBetter(scoreType: ScoreType): boolean {
	return scoreType === "min"
}

/**
 * Aggregate round values and return both the aggregated value
 * and a summary of the operation.
 *
 * @param values - Array of numeric values
 * @param scoreType - Aggregation method
 *
 * @example
 * aggregateWithSummary([100, 150, 125], "max")
 * // → { aggregated: 150, operation: "max", count: 3 }
 */
export function aggregateWithSummary(
	values: number[],
	scoreType: ScoreType,
): {
	aggregated: number | null
	operation: ScoreType
	count: number
} {
	return {
		aggregated: aggregateValues(values, scoreType),
		operation: scoreType,
		count: values.length,
	}
}
