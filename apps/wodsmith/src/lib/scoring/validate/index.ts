/**
 * Validation module: input validation for scores
 */

import { ROUNDS_REPS_MULTIPLIER } from "../constants"
import { parseScore } from "../parse"
import type {
	ScoreInput,
	ScoreStatus,
	ValidationResult,
	WorkoutScheme,
} from "../types"

/**
 * Validate a score input.
 *
 * @param input - Score input to validate
 *
 * @example
 * validateScoreInput({
 *   scheme: "time",
 *   value: "12:34",
 *   status: "scored"
 * })
 * // → { isValid: true, errors: [], warnings: [] }
 *
 * validateScoreInput({
 *   scheme: "rounds-reps",
 *   value: "abc"
 * })
 * // → { isValid: false, errors: ["Invalid rounds+reps format"], warnings: [] }
 */
export function validateScoreInput(input: ScoreInput): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	// Validate scheme
	if (!input.scheme) {
		errors.push("Scheme is required")
		return { isValid: false, errors, warnings }
	}

	// Validate that either value or rounds are provided
	if (!input.value && (!input.rounds || input.rounds.length === 0)) {
		errors.push("Either value or rounds must be provided")
		return { isValid: false, errors, warnings }
	}

	// Validate single value
	if (input.value) {
		const parseResult = parseScore(input.value, input.scheme)
		if (!parseResult.isValid) {
			errors.push(parseResult.error ?? "Invalid score value")
		}
		if (parseResult.warnings) {
			warnings.push(...parseResult.warnings)
		}
	}

	// Validate rounds
	if (input.rounds && input.rounds.length > 0) {
		for (let i = 0; i < input.rounds.length; i++) {
			const round = input.rounds[i]
			if (!round) continue

			const effectiveScheme = round.schemeOverride ?? input.scheme
			const parseResult = parseScore(round.raw, effectiveScheme, {
				unit: round.unit,
			})

			if (!parseResult.isValid) {
				errors.push(`Round ${i + 1}: ${parseResult.error ?? "Invalid value"}`)
			}
			if (parseResult.warnings) {
				warnings.push(...parseResult.warnings.map((w) => `Round ${i + 1}: ${w}`))
			}
		}
	}

	// Validate tiebreak
	if (input.tiebreak) {
		if (!input.tiebreak.scheme) {
			errors.push("Tiebreak scheme is required when tiebreak is provided")
		} else {
			const tiebreakScheme: WorkoutScheme =
				input.tiebreak.scheme === "time" ? "time" : "reps"
			const parseResult = parseScore(input.tiebreak.raw, tiebreakScheme)
			if (!parseResult.isValid) {
				errors.push(`Tiebreak: ${parseResult.error ?? "Invalid value"}`)
			}
		}
	}

	// Validate time cap
	if (input.timeCap) {
		if (input.timeCap.ms <= 0) {
			errors.push("Time cap must be positive")
		}
		if (input.status === "cap" && !input.timeCap.secondaryRaw) {
			warnings.push("Capped result should have secondary score (e.g., reps completed)")
		}
	}

	// Validate status
	if (input.status) {
		const validStatuses: ScoreStatus[] = ["scored", "cap", "dq", "withdrawn"]
		if (!validStatuses.includes(input.status)) {
			errors.push(`Invalid status: ${input.status}`)
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	}
}

/**
 * Validate a time score value.
 *
 * @param ms - Time in milliseconds
 */
export function validateTime(ms: number): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	if (ms < 0) {
		errors.push("Time cannot be negative")
	}

	if (ms > 24 * 60 * 60 * 1000) {
		warnings.push("Time exceeds 24 hours")
	}

	return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validate a rounds+reps score value.
 *
 * @param encoded - Encoded rounds+reps value
 */
export function validateRoundsReps(encoded: number): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	if (encoded < 0) {
		errors.push("Score cannot be negative")
	}

	const rounds = Math.floor(encoded / ROUNDS_REPS_MULTIPLIER)
	const reps = encoded % ROUNDS_REPS_MULTIPLIER

	if (reps >= ROUNDS_REPS_MULTIPLIER) {
		errors.push(`Reps cannot exceed ${ROUNDS_REPS_MULTIPLIER - 1}`)
	}

	if (rounds > 1000) {
		warnings.push("Unusually high number of rounds")
	}

	if (reps > 1000) {
		warnings.push("Unusually high number of reps")
	}

	return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validate a load (weight) score value.
 *
 * @param grams - Weight in grams
 */
export function validateLoad(grams: number): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	if (grams < 0) {
		errors.push("Weight cannot be negative")
	}

	// ~2000 lbs in grams
	if (grams > 907185) {
		warnings.push("Weight exceeds typical human limits")
	}

	return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validate a distance score value.
 *
 * @param mm - Distance in millimeters
 */
export function validateDistance(mm: number): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	if (mm < 0) {
		errors.push("Distance cannot be negative")
	}

	// Marathon in mm (~42km)
	if (mm > 42_195_000) {
		warnings.push("Distance exceeds marathon length")
	}

	return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Check if a value looks like an outlier compared to other values.
 * Uses simple statistical analysis (> 2 standard deviations from mean).
 *
 * @param value - Value to check
 * @param otherValues - Other values to compare against
 */
export function isOutlier(value: number, otherValues: number[]): boolean {
	if (otherValues.length < 3) return false

	const allValues = [value, ...otherValues]
	const mean = allValues.reduce((sum, v) => sum + v, 0) / allValues.length
	const variance =
		allValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / allValues.length
	const stdDev = Math.sqrt(variance)

	return Math.abs(value - mean) > 2 * stdDev
}
