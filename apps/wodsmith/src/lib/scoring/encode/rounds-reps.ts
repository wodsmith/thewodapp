/**
 * Rounds+Reps encoding: converts rounds+reps to a single integer
 *
 * Encoding: rounds * 100,000 + reps
 * This supports up to 99,999 reps per partial round.
 */

import { ROUNDS_REPS_MULTIPLIER } from "../constants"

/**
 * Encode a rounds+reps string to an integer.
 *
 * Supported formats:
 * - "5+12" → 5 rounds + 12 reps
 * - "5.12" → 5 rounds + 12 reps (period-delimited)
 * - "5" → 5 complete rounds (0 extra reps)
 * - "0+45" → 0 rounds + 45 reps (partial first round)
 *
 * @example
 * encodeRoundsReps("5+12")  // → 500012
 * encodeRoundsReps("5.12")  // → 500012
 * encodeRoundsReps("20.1")  // → 2000001
 * encodeRoundsReps("10")    // → 1000000
 * encodeRoundsReps("0+45")  // → 45
 */
export function encodeRoundsReps(input: string): number | null {
	const trimmed = input.trim()
	if (!trimmed) return null

	// Check for + or . separator
	const hasPlus = trimmed.includes("+")
	const hasPeriod = trimmed.includes(".")

	if (hasPlus || hasPeriod) {
		const delimiter = hasPlus ? "+" : "."
		const parts = trimmed.split(delimiter)
		if (parts.length !== 2) return null

		const [roundsStr, repsStr] = parts
		const rounds = Number.parseInt(roundsStr?.trim() ?? "", 10)
		const reps = Number.parseInt(repsStr?.trim() ?? "", 10)

		if (
			Number.isNaN(rounds) ||
			Number.isNaN(reps) ||
			rounds < 0 ||
			reps < 0 ||
			reps >= ROUNDS_REPS_MULTIPLIER
		) {
			return null
		}

		return rounds * ROUNDS_REPS_MULTIPLIER + reps
	}

	// No separator - treat as complete rounds
	const rounds = Number.parseInt(trimmed, 10)
	if (Number.isNaN(rounds) || rounds < 0) {
		return null
	}

	return rounds * ROUNDS_REPS_MULTIPLIER
}

/**
 * Encode rounds and reps from separate numeric values.
 *
 * @example
 * encodeRoundsRepsFromParts(5, 12)  // → 500012
 * encodeRoundsRepsFromParts(10, 0)  // → 1000000
 */
export function encodeRoundsRepsFromParts(
	rounds: number,
	reps: number,
): number | null {
	if (
		Number.isNaN(rounds) ||
		Number.isNaN(reps) ||
		rounds < 0 ||
		reps < 0 ||
		reps >= ROUNDS_REPS_MULTIPLIER
	) {
		return null
	}

	return rounds * ROUNDS_REPS_MULTIPLIER + reps
}
