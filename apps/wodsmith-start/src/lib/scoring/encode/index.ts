/**
 * Encoding module: converts human-readable inputs to sortable integers
 */

import { aggregateValues } from "../aggregate"
import {
	isCountBasedScheme,
	isDistanceBasedScheme,
	isLoadBasedScheme,
	isTimeBasedScheme,
} from "../constants"
import type {
	DistanceUnit,
	EncodeOptions,
	EncodeRoundsResult,
	RoundInput,
	ScoreType,
	WeightUnit,
	WorkoutScheme,
} from "../types"
import { encodeDistance, encodeDistanceFromNumber } from "./distance"
import { encodeLoad, encodeLoadFromNumber } from "./load"
import { encodeRoundsReps } from "./rounds-reps"
import { encodeTime, encodeTimeFromSeconds } from "./time"

export { extractRoundsReps } from "../decode/rounds-reps"
export {
	encodeDistance,
	encodeDistanceFromNumber,
	mmToUnit,
} from "./distance"
export { encodeLoad, encodeLoadFromNumber, gramsToUnit } from "./load"
export { encodeRoundsReps, encodeRoundsRepsFromParts } from "./rounds-reps"
// Re-export individual encoders
export {
	encodeTime,
	encodeTimeFromMs,
	encodeTimeFromSeconds,
} from "./time"

/**
 * Encode a score input string to a sortable integer based on the scheme.
 *
 * @param input - User input string
 * @param scheme - Workout scheme determining encoding method
 * @param options - Optional encoding options (unit for load/distance)
 *
 * @example
 * encodeScore("12:34", "time")                    // → 754000
 * encodeScore("5+12", "rounds-reps")              // → 500012
 * encodeScore("225", "load", { unit: "lbs" })     // → 102058
 * encodeScore("5000", "meters")                   // → 5000000
 * encodeScore("150", "reps")                      // → 150
 */
export function encodeScore(
	input: string,
	scheme: WorkoutScheme,
	options?: EncodeOptions,
): number | null {
	const trimmed = input.trim()
	if (!trimmed) return null

	// Time-based schemes
	if (isTimeBasedScheme(scheme)) {
		return encodeTime(trimmed)
	}

	// Rounds + Reps
	if (scheme === "rounds-reps") {
		return encodeRoundsReps(trimmed)
	}

	// Load (weight)
	if (isLoadBasedScheme(scheme)) {
		const unit = (options?.unit as WeightUnit) ?? "lbs"
		return encodeLoad(trimmed, unit)
	}

	// Distance
	if (isDistanceBasedScheme(scheme)) {
		// Default unit based on scheme
		const defaultUnit: DistanceUnit = scheme === "feet" ? "ft" : "m"
		const unit = (options?.unit as DistanceUnit) ?? defaultUnit
		return encodeDistance(trimmed, unit)
	}

	// Count-based schemes (reps, calories, points)
	if (isCountBasedScheme(scheme)) {
		const value = Number.parseInt(trimmed, 10)
		if (Number.isNaN(value) || value < 0) {
			return null
		}
		return value
	}

	// Pass/fail
	if (scheme === "pass-fail") {
		const lower = trimmed.toLowerCase()
		if (lower === "pass" || lower === "p" || lower === "1") {
			return 1
		}
		if (lower === "fail" || lower === "f" || lower === "0") {
			return 0
		}
		return null
	}

	return null
}

/**
 * Encode multiple rounds and compute the aggregated value.
 *
 * @param rounds - Array of round inputs
 * @param scheme - Workout scheme
 * @param scoreType - Aggregation method
 * @param options - Optional encoding options
 *
 * @example
 * // 10x3 Back Squat
 * const rounds = [
 *   { raw: "225", unit: "lbs" },
 *   { raw: "235", unit: "lbs" },
 *   { raw: "245", unit: "lbs" },
 * ]
 * encodeRounds(rounds, "load", "max")
 * // → { rounds: [102058, 106594, 111130], aggregated: 111130 }
 */
export function encodeRounds(
	rounds: RoundInput[],
	scheme: WorkoutScheme,
	scoreType: ScoreType,
	options?: EncodeOptions,
): EncodeRoundsResult {
	const encodedRounds: number[] = []

	for (const round of rounds) {
		// Use round-specific unit if provided, otherwise use options unit
		const roundOptions: EncodeOptions = {
			...options,
			unit: round.unit ?? options?.unit,
		}

		// Use scheme override if provided
		const effectiveScheme = round.schemeOverride ?? scheme

		const encoded = encodeScore(round.raw, effectiveScheme, roundOptions)
		if (encoded !== null) {
			encodedRounds.push(encoded)
		}
	}

	const aggregated = aggregateValues(encodedRounds, scoreType)

	return {
		rounds: encodedRounds,
		aggregated,
	}
}

/**
 * Encode a numeric value directly based on scheme.
 * Use this when you already have a parsed number.
 *
 * @param value - Numeric value
 * @param scheme - Workout scheme
 * @param options - Optional encoding options
 */
export function encodeNumericScore(
	value: number,
	scheme: WorkoutScheme,
	options?: EncodeOptions,
): number | null {
	if (Number.isNaN(value) || value < 0) {
		return null
	}

	// Time-based: value is in seconds, convert to ms
	if (isTimeBasedScheme(scheme)) {
		return encodeTimeFromSeconds(value)
	}

	// Rounds+reps: value is already encoded
	if (scheme === "rounds-reps") {
		return Math.round(value)
	}

	// Load: value is in the specified unit
	if (isLoadBasedScheme(scheme)) {
		const unit = (options?.unit as WeightUnit) ?? "lbs"
		return encodeLoadFromNumber(value, unit)
	}

	// Distance: value is in the specified unit
	if (isDistanceBasedScheme(scheme)) {
		const defaultUnit: DistanceUnit = scheme === "feet" ? "ft" : "m"
		const unit = (options?.unit as DistanceUnit) ?? defaultUnit
		return encodeDistanceFromNumber(value, unit)
	}

	// Count-based and pass-fail: just round the value
	return Math.round(value)
}
