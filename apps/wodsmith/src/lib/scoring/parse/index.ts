/**
 * Parsing module: smart input parsing with validation and formatting
 */

import {
	isCountBasedScheme,
	isDistanceBasedScheme,
	isLoadBasedScheme,
	isTimeBasedScheme,
	ROUNDS_REPS_MULTIPLIER,
} from "../constants"
import { decodeScore } from "../decode"
import { encodeScore } from "../encode"
import type {
	DistanceUnit,
	ParseOptions,
	ParseResult,
	WeightUnit,
	WorkoutScheme,
} from "../types"
import { parseTime } from "./time"

// Re-export time parser
export { parseTime, validateTimeInput } from "./time"

/**
 * Parse a score input string with smart formatting and validation.
 *
 * This is the main entry point for parsing user input. It handles
 * various input formats and returns a standardized result with
 * the encoded value and formatted display string.
 *
 * @param input - User input string
 * @param scheme - Workout scheme determining parsing rules
 * @param options - Optional parsing options
 *
 * @example
 * parseScore("1234", "time")
 * // → { isValid: true, encoded: 754000, formatted: "12:34" }
 *
 * parseScore("5+12", "rounds-reps")
 * // → { isValid: true, encoded: 500012, formatted: "5+12" }
 *
 * parseScore("225", "load", { unit: "lbs" })
 * // → { isValid: true, encoded: 102058, formatted: "225" }
 */
export function parseScore(
	input: string,
	scheme: WorkoutScheme,
	options?: ParseOptions,
): ParseResult {
	const trimmed = input.trim()
	if (!trimmed) {
		return {
			isValid: false,
			encoded: null,
			formatted: "",
			error: "Empty input",
		}
	}

	// Time-based schemes use smart time parsing
	if (isTimeBasedScheme(scheme)) {
		return parseTime(trimmed, { precision: options?.timePrecision })
	}

	// Rounds + Reps
	if (scheme === "rounds-reps") {
		return parseRoundsReps(trimmed, options?.strict)
	}

	// Load (weight)
	if (isLoadBasedScheme(scheme)) {
		return parseLoad(trimmed, options?.unit as WeightUnit)
	}

	// Distance
	if (isDistanceBasedScheme(scheme)) {
		const defaultUnit: DistanceUnit = scheme === "feet" ? "ft" : "m"
		return parseDistance(trimmed, (options?.unit as DistanceUnit) ?? defaultUnit)
	}

	// Count-based schemes (reps, calories, points)
	if (isCountBasedScheme(scheme)) {
		return parseCount(trimmed, scheme)
	}

	// Pass/fail
	if (scheme === "pass-fail") {
		return parsePassFail(trimmed)
	}

	return {
		isValid: false,
		encoded: null,
		formatted: trimmed,
		error: `Unknown scheme: ${scheme}`,
	}
}

/**
 * Parse rounds+reps input.
 * 
 * Supports multiple input formats:
 * - Standard: "5+12" (rounds+reps)
 * - Period-delimited: "5.12" (rounds.reps)
 * - Plain number: "5" (complete rounds, interpreted as 5+0)
 * 
 * @example
 * parseRoundsReps("5+12")  // → { encoded: 500012, formatted: "5+12" }
 * parseRoundsReps("5.12")  // → { encoded: 500012, formatted: "5+12" }
 * parseRoundsReps("5")     // → { encoded: 500000, formatted: "5+0" }
 */
function parseRoundsReps(input: string, strict?: boolean): ParseResult {
	// Check for + or . delimiter
	const hasPlus = input.includes("+")
	const hasPeriod = input.includes(".")
	
	if (hasPlus || hasPeriod) {
		const delimiter = hasPlus ? "+" : "."
		const parts = input.split(delimiter)
		if (parts.length !== 2) {
			return {
				isValid: false,
				encoded: null,
				formatted: input,
				error: "Invalid format. Use rounds+reps (e.g., 5+12 or 5.12)",
			}
		}

		const [roundsStr, repsStr] = parts
		const rounds = Number.parseInt(roundsStr?.trim() ?? "", 10)
		const reps = Number.parseInt(repsStr?.trim() ?? "", 10)

		if (Number.isNaN(rounds) || Number.isNaN(reps) || rounds < 0 || reps < 0) {
			return {
				isValid: false,
				encoded: null,
				formatted: input,
				error: "Invalid numbers",
			}
		}

		if (reps >= ROUNDS_REPS_MULTIPLIER) {
			return {
				isValid: false,
				encoded: null,
				formatted: input,
				error: `Reps cannot exceed ${ROUNDS_REPS_MULTIPLIER - 1}`,
			}
		}

		const encoded = rounds * ROUNDS_REPS_MULTIPLIER + reps
		// Pad single digits with leading zero for uniform display
		const roundsPadded = rounds.toString().padStart(2, "0")
		const repsPadded = reps.toString().padStart(2, "0")
		return {
			isValid: true,
			encoded,
			formatted: `${roundsPadded}+${repsPadded}`,
		}
	}

	// Plain number - treat as complete rounds
	const rounds = Number.parseInt(input, 10)
	if (Number.isNaN(rounds) || rounds < 0) {
		return {
			isValid: false,
			encoded: null,
			formatted: input,
			error: strict
				? "Use rounds+reps format (e.g., 5+12 or 5.12)"
				: "Invalid number",
		}
	}

	const encoded = rounds * ROUNDS_REPS_MULTIPLIER
	// Pad single digits with leading zero for uniform display
	const roundsPadded = rounds.toString().padStart(2, "0")
	return {
		isValid: true,
		encoded,
		formatted: `${roundsPadded}+00`,
		warnings: strict ? undefined : ["Interpreted as complete rounds"],
	}
}

/**
 * Parse load (weight) input.
 */
function parseLoad(input: string, unit: WeightUnit = "lbs"): ParseResult {
	const value = Number.parseFloat(input)
	if (Number.isNaN(value) || value < 0) {
		return {
			isValid: false,
			encoded: null,
			formatted: input,
			error: "Invalid weight",
		}
	}

	const encoded = encodeScore(input, "load", { unit })
	if (encoded === null) {
		return {
			isValid: false,
			encoded: null,
			formatted: input,
			error: "Failed to encode weight",
		}
	}

	// Format for display
	const formatted = decodeScore(encoded, "load", { weightUnit: unit })

	return {
		isValid: true,
		encoded,
		formatted,
	}
}

/**
 * Parse distance input.
 */
function parseDistance(input: string, unit: DistanceUnit = "m"): ParseResult {
	const value = Number.parseFloat(input)
	if (Number.isNaN(value) || value < 0) {
		return {
			isValid: false,
			encoded: null,
			formatted: input,
			error: "Invalid distance",
		}
	}

	const encoded = encodeScore(input, "meters", { unit })
	if (encoded === null) {
		return {
			isValid: false,
			encoded: null,
			formatted: input,
			error: "Failed to encode distance",
		}
	}

	// Format for display
	const formatted = decodeScore(encoded, "meters", { distanceUnit: unit })

	return {
		isValid: true,
		encoded,
		formatted,
	}
}

/**
 * Parse count-based input (reps, calories, points).
 */
function parseCount(input: string, _scheme: WorkoutScheme): ParseResult {
	const value = Number.parseInt(input, 10)
	if (Number.isNaN(value) || value < 0) {
		return {
			isValid: false,
			encoded: null,
			formatted: input,
			error: "Invalid number",
		}
	}

	return {
		isValid: true,
		encoded: value,
		formatted: value.toString(),
	}
}

/**
 * Parse pass/fail input.
 */
function parsePassFail(input: string): ParseResult {
	const lower = input.toLowerCase()

	if (lower === "pass" || lower === "p" || lower === "1" || lower === "yes") {
		return {
			isValid: true,
			encoded: 1,
			formatted: "Pass",
		}
	}

	if (lower === "fail" || lower === "f" || lower === "0" || lower === "no") {
		return {
			isValid: true,
			encoded: 0,
			formatted: "Fail",
		}
	}

	return {
		isValid: false,
		encoded: null,
		formatted: input,
		error: "Enter 'pass' or 'fail'",
	}
}

/**
 * Parse a tiebreak score.
 *
 * @param input - User input string
 * @param scheme - Tiebreak scheme ('time' or 'reps')
 */
export function parseTiebreak(
	input: string,
	scheme: "time" | "reps",
	options?: ParseOptions,
): ParseResult {
	if (scheme === "time") {
		return parseTime(input, { precision: options?.timePrecision })
	}

	// Reps tiebreak
	return parseCount(input, "reps")
}
