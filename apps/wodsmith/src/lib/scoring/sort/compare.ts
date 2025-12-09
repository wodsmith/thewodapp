/**
 * Score comparison functions for sorting
 */

import { STATUS_ORDER } from "../constants"
import type { Score } from "../types"
import { getSortDirection } from "./direction"

/**
 * Compare two scores for sorting.
 *
 * Returns negative if a should come before b,
 * positive if a should come after b,
 * zero if equal.
 *
 * Sorting rules:
 * 1. Status order (scored < cap < dq < withdrawn)
 * 2. Within same status, by score value (direction based on scheme)
 * 3. For capped scores, by secondary value (higher is better)
 * 4. If still tied, by tiebreak value
 *
 * @example
 * const scores = [scoreA, scoreB, scoreC]
 * scores.sort(compareScores)
 */
export function compareScores(a: Score, b: Score): number {
	// First, compare by status
	const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
	if (statusDiff !== 0) {
		return statusDiff
	}

	// For capped results, compare secondary values (higher is better)
	// This takes precedence since capped scores have null primary values
	if (a.status === "cap" && b.status === "cap") {
		const aSecondary = a.timeCap?.secondaryValue ?? 0
		const bSecondary = b.timeCap?.secondaryValue ?? 0
		const secondaryDiff = bSecondary - aSecondary // Higher is better
		if (secondaryDiff !== 0) {
			return secondaryDiff
		}
		return compareTiebreaks(a, b)
	}

	// Same status - compare by value
	// Handle null values (sort last within status group)
	if (a.value === null && b.value === null) {
		return compareTiebreaks(a, b)
	}
	if (a.value === null) return 1
	if (b.value === null) return -1

	// Both have values - compare based on scheme direction
	const direction = getSortDirection(a.scheme, a.scoreType)

	// Compare primary values
	const valueDiff =
		direction === "asc"
			? a.value - b.value // Lower is better
			: b.value - a.value // Higher is better

	if (valueDiff !== 0) {
		return valueDiff
	}

	// Values are equal - compare tiebreaks
	return compareTiebreaks(a, b)
}

/**
 * Compare tiebreak values between two scores.
 */
function compareTiebreaks(a: Score, b: Score): number {
	// If neither has a tiebreak, they're equal
	if (!a.tiebreak && !b.tiebreak) return 0

	// Score with tiebreak comes before score without? Or vice versa?
	// Convention: having a tiebreak doesn't affect ordering if only one has it
	if (!a.tiebreak) return 0
	if (!b.tiebreak) return 0

	// Both have tiebreaks - compare them
	// Tiebreak direction depends on tiebreak scheme
	// Time tiebreak: lower is better
	// Reps tiebreak: higher is better
	if (a.tiebreak.scheme === "time") {
		return a.tiebreak.value - b.tiebreak.value // Lower is better
	}

	// Reps tiebreak
	return b.tiebreak.value - a.tiebreak.value // Higher is better
}

/**
 * Create a comparator function for a specific scheme.
 * Useful when you need a typed comparator.
 *
 * @example
 * const compare = createComparator("time", "min")
 * scores.sort(compare)
 */
export function createComparator(
	_scheme: Score["scheme"],
	_scoreType: Score["scoreType"],
): (a: Score, b: Score) => number {
	return compareScores
}

/**
 * Sort an array of scores in place.
 *
 * @param scores - Array of scores to sort
 * @returns The sorted array (same reference)
 */
export function sortScores(scores: Score[]): Score[] {
	return scores.sort(compareScores)
}

/**
 * Find the rank of a score within a list.
 * Returns 1-indexed rank (1 = first place).
 *
 * @param score - Score to find rank for
 * @param allScores - All scores to compare against
 */
export function findRank(score: Score, allScores: Score[]): number {
	const sorted = [...allScores].sort(compareScores)
	const index = sorted.findIndex(
		(s) =>
			s.value === score.value &&
			s.status === score.status &&
			s.tiebreak?.value === score.tiebreak?.value,
	)
	return index + 1
}
