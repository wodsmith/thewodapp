/**
 * Traditional Scoring Algorithm
 *
 * Fixed step point deduction from first place.
 * Example with step=5: 1st=100, 2nd=95, 3rd=90...
 *
 * Supports auto-scaling to division size, which calculates the step
 * dynamically to ensure points are distributed across all positions.
 *
 * @see docs/plans/configurable-scoring-system.md
 */

import type { TraditionalConfig } from "@/types/scoring"

/**
 * Calculate the effective step for traditional scoring.
 * When autoScale is enabled, calculates step based on division size.
 *
 * @param config - Traditional scoring configuration (partial is allowed)
 * @param divisionSize - Number of athletes in the division (for auto-scaling)
 * @returns The step value to use
 */
export function getEffectiveStep(
	config: Partial<TraditionalConfig>,
	divisionSize?: number,
): number {
	const firstPlacePoints = config.firstPlacePoints ?? 100
	const step = config.step ?? 5
	const autoScale = config.autoScale ?? false
	const minPoints = config.minPoints ?? 0

	// If not auto-scaling or no division size, use configured step
	if (!autoScale || !divisionSize || divisionSize <= 1) {
		return step
	}

	// Calculate step to distribute points from firstPlacePoints to minPoints
	// across divisionSize positions
	const pointsRange = firstPlacePoints - minPoints
	const calculatedStep = pointsRange / (divisionSize - 1)

	// Round to nearest 0.5 for cleaner numbers, minimum step of 1
	return Math.max(1, Math.round(calculatedStep * 2) / 2)
}

/**
 * Calculate points for a given place using traditional scoring.
 *
 * @param place - The athlete's finishing position (1-indexed)
 * @param config - Traditional scoring configuration (partial is allowed)
 * @param divisionSize - Optional division size for auto-scaling
 * @returns Points awarded (never negative, never below minPoints for valid places)
 *
 * @example
 * // Default: 100 points for 1st, -5 per place
 * calculateTraditionalPoints(1, { firstPlacePoints: 100, step: 5 }) // 100
 * calculateTraditionalPoints(2, { firstPlacePoints: 100, step: 5 }) // 95
 * calculateTraditionalPoints(21, { firstPlacePoints: 100, step: 5 }) // 0
 *
 * @example
 * // Auto-scaled for 10-person division: 100 to 10, step ~10
 * calculateTraditionalPoints(1, { firstPlacePoints: 100, step: 5, autoScale: true, minPoints: 10 }, 10) // 100
 * calculateTraditionalPoints(10, { firstPlacePoints: 100, step: 5, autoScale: true, minPoints: 10 }, 10) // 10
 */
export function calculateTraditionalPoints(
	place: number,
	config: Partial<TraditionalConfig>,
	divisionSize?: number,
): number {
	const firstPlacePoints = config.firstPlacePoints ?? 100
	const minPoints = config.minPoints ?? 0
	const autoScale = config.autoScale ?? false

	// Handle invalid places (0 or negative) - return first place points
	if (place <= 0) {
		return firstPlacePoints
	}

	// Get effective step (auto-calculated if autoScale is true)
	const effectiveStep = getEffectiveStep(config, divisionSize)

	// Calculate points: first place minus (step * positions behind first)
	const points = firstPlacePoints - (place - 1) * effectiveStep

	// For auto-scaled scoring, ensure minimum points for places within division
	if (autoScale && divisionSize && place <= divisionSize) {
		return Math.max(minPoints, Math.round(points))
	}

	// Never return negative points
	return Math.max(0, Math.round(points))
}

/**
 * Generate a points table for traditional scoring.
 *
 * @param config - Traditional scoring configuration (partial is allowed)
 * @param count - Number of places to generate
 * @param divisionSize - Optional division size for auto-scaling
 * @returns Array of points for places 1 through count
 */
export function generateTraditionalPointsTable(
	config: Partial<TraditionalConfig>,
	count: number,
	divisionSize?: number,
): number[] {
	const table: number[] = []
	for (let place = 1; place <= count; place++) {
		table.push(calculateTraditionalPoints(place, config, divisionSize))
	}
	return table
}
