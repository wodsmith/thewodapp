/**
 * Decoding module: converts encoded integers to display strings
 */

import {
	isCountBasedScheme,
	isDistanceBasedScheme,
	isLoadBasedScheme,
	isTimeBasedScheme,
} from "../constants"
import type { DistanceUnit, FormatOptions, WorkoutScheme } from "../types"
import { decodeDistance, mmToUnit } from "./distance"
import { decodeLoad, gramsToUnit } from "./load"
import { decodeRoundsReps } from "./rounds-reps"
import { decodeTime, decodeTimeToSeconds } from "./time"

// Re-export individual decoders
export { decodeTime, decodeTimeToSeconds } from "./time"
export { decodeRoundsReps, extractRoundsReps } from "./rounds-reps"
export { decodeLoad, gramsToUnit } from "./load"
export { decodeDistance, mmToUnit } from "./distance"

/**
 * Decode an encoded score to a display string based on the scheme.
 *
 * @param value - Encoded integer value
 * @param scheme - Workout scheme determining decoding method
 * @param options - Optional format options
 *
 * @example
 * decodeScore(754000, "time")                      // → "12:34"
 * decodeScore(754567, "time")                      // → "12:34.567"
 * decodeScore(500012, "rounds-reps")               // → "5+12"
 * decodeScore(102058, "load", { weightUnit: "lbs", includeUnit: true }) // → "225 lbs"
 * decodeScore(5000000, "meters", { includeUnit: true }) // → "5000m"
 * decodeScore(150, "reps")                         // → "150"
 */
export function decodeScore(
	value: number,
	scheme: WorkoutScheme,
	options?: FormatOptions,
): string {
	// Time-based schemes
	// Show ms if non-zero, or if alwaysShowMs option is set
	if (isTimeBasedScheme(scheme)) {
		return decodeTime(value, {
			alwaysShowMs: options?.compact === false, // Show .000 when not compact
		})
	}

	// Rounds + Reps
	if (scheme === "rounds-reps") {
		return decodeRoundsReps(value, { compact: options?.compact })
	}

	// Load (weight)
	if (isLoadBasedScheme(scheme)) {
		return decodeLoad(value, {
			unit: options?.weightUnit ?? "lbs",
			includeUnit: options?.includeUnit,
		})
	}

	// Distance
	if (isDistanceBasedScheme(scheme)) {
		const defaultUnit: DistanceUnit = scheme === "feet" ? "ft" : "m"
		return decodeDistance(value, {
			unit: options?.distanceUnit ?? defaultUnit,
			includeUnit: options?.includeUnit,
		})
	}

	// Count-based schemes (reps, calories, points)
	if (isCountBasedScheme(scheme)) {
		const suffix = getCountSuffix(scheme, options?.includeUnit)
		return suffix ? `${value}${suffix}` : value.toString()
	}

	// Pass/fail
	if (scheme === "pass-fail") {
		return value === 1 ? "Pass" : "Fail"
	}

	return value.toString()
}

/**
 * Get the unit suffix for count-based schemes.
 */
function getCountSuffix(scheme: WorkoutScheme, includeUnit?: boolean): string {
	if (!includeUnit) return ""

	switch (scheme) {
		case "reps":
			return " reps"
		case "calories":
			return " cal"
		case "points":
			return " pts"
		default:
			return ""
	}
}

/**
 * Decode to a numeric value in the original unit.
 * Useful when you need the raw number for calculations.
 *
 * @param value - Encoded integer value
 * @param scheme - Workout scheme
 * @param options - Format options (for unit preferences)
 *
 * @example
 * decodeToNumber(754567, "time")    // → 754.567 (seconds)
 * decodeToNumber(102058, "load", { weightUnit: "lbs" }) // → 225
 */
export function decodeToNumber(
	value: number,
	scheme: WorkoutScheme,
	options?: FormatOptions,
): number {
	// Time-based: return seconds
	if (isTimeBasedScheme(scheme)) {
		return decodeTimeToSeconds(value)
	}

	// Load: return in specified unit
	if (isLoadBasedScheme(scheme)) {
		return gramsToUnit(value, options?.weightUnit ?? "lbs")
	}

	// Distance: return in specified unit
	if (isDistanceBasedScheme(scheme)) {
		const defaultUnit: DistanceUnit = scheme === "feet" ? "ft" : "m"
		return mmToUnit(value, options?.distanceUnit ?? defaultUnit)
	}

	// All others: return as-is
	return value
}
