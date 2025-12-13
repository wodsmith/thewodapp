/**
 * Rounds+Reps decoding: converts encoded integers to display strings
 */

import { ROUNDS_REPS_MULTIPLIER } from "../constants"

export interface DecodeRoundsRepsOptions {
	/** Show as just rounds if reps is 0 (e.g., "5" instead of "5+0") */
	compact?: boolean
}

/**
 * Decode an encoded rounds+reps integer to a display string.
 *
 * @example
 * decodeRoundsReps(500012)  // → "05+12"
 * decodeRoundsReps(1000000) // → "10+00" or "10" if compact
 * decodeRoundsReps(45)      // → "00+45"
 */
export function decodeRoundsReps(
	encoded: number,
	options?: DecodeRoundsRepsOptions,
): string {
	const { rounds, reps } = extractRoundsReps(encoded)

	// Compact mode: show just rounds if reps is 0
	if (options?.compact && reps === 0) {
		return rounds.toString()
	}

	// Pad single digits with leading zero for uniform display
	const roundsStr = rounds.toString().padStart(2, "0")
	const repsStr = reps.toString().padStart(2, "0")

	return `${roundsStr}+${repsStr}`
}

/**
 * Extract rounds and reps from an encoded value.
 *
 * @example
 * extractRoundsReps(500012)  // → { rounds: 5, reps: 12 }
 */
export function extractRoundsReps(encoded: number): {
	rounds: number
	reps: number
} {
	const rounds = Math.floor(encoded / ROUNDS_REPS_MULTIPLIER)
	const reps = encoded % ROUNDS_REPS_MULTIPLIER
	return { rounds, reps }
}
