/**
 * Traditional Scoring Algorithm
 *
 * Fixed step point deduction from first place.
 * Example with step=5: 1st=100, 2nd=95, 3rd=90...
 *
 * @see docs/plans/configurable-scoring-system.md
 */

import type { TraditionalConfig } from "@/types/scoring"

/**
 * Calculate points for a given place using traditional scoring.
 *
 * @param place - The athlete's finishing position (1-indexed)
 * @param config - Traditional scoring configuration
 * @returns Points awarded (never negative)
 *
 * @example
 * // Default: 100 points for 1st, -5 per place
 * calculateTraditionalPoints(1, { firstPlacePoints: 100, step: 5 }) // 100
 * calculateTraditionalPoints(2, { firstPlacePoints: 100, step: 5 }) // 95
 * calculateTraditionalPoints(21, { firstPlacePoints: 100, step: 5 }) // 0
 */
export function calculateTraditionalPoints(
	place: number,
	config: TraditionalConfig,
): number {
	const { firstPlacePoints, step } = config

	// Handle invalid places (0 or negative) - return first place points
	if (place <= 0) {
		return firstPlacePoints
	}

	// Calculate points: first place minus (step * positions behind first)
	const points = firstPlacePoints - (place - 1) * step

	// Never return negative points
	return Math.max(0, points)
}
