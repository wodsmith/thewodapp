/**
 * Custom Table Scoring Algorithm
 *
 * Builds on a base template with optional place-specific overrides.
 * Supports three base templates:
 * - traditional: Fixed step deduction
 * - p_score: Performance-based (falls back to traditional for static table)
 * - winner_takes_more: Front-loaded points table
 *
 * @see docs/plans/configurable-scoring-system.md
 */

import type { CustomTableConfig, TraditionalConfig } from "@/types/scoring"
import { calculateTraditionalPoints } from "./traditional"

/**
 * Winner Takes More points table.
 * Front-loaded scoring that rewards top finishers more heavily.
 * Covers places 1-30.
 */
export const WINNER_TAKES_MORE_TABLE = [
	100, 85, 75, 67, 62, 58, 55, 52, 50, 48, 46, 44, 42, 40, 38, 36, 34, 32, 30,
	28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 5,
] as const

/**
 * Generate a points table for a given base template.
 *
 * @param baseTemplate - The template to use as base
 * @param count - Number of places to generate
 * @param traditionalConfig - Config for traditional/p_score templates
 * @returns Array of points for places 1 through count
 *
 * @example
 * generatePointsTable('winner_takes_more', 10)
 * // [100, 85, 75, 67, 62, 58, 55, 52, 50, 48]
 *
 * generatePointsTable('traditional', 5, { firstPlacePoints: 100, step: 5 })
 * // [100, 95, 90, 85, 80]
 */
export function generatePointsTable(
	baseTemplate: CustomTableConfig["baseTemplate"],
	count: number,
	traditionalConfig?: TraditionalConfig,
): number[] {
	const table: number[] = []

	for (let place = 1; place <= count; place++) {
		if (baseTemplate === "winner_takes_more") {
			// Use the winner_takes_more table, floor at 0 for places beyond 30
			const points =
				place <= WINNER_TAKES_MORE_TABLE.length
					? WINNER_TAKES_MORE_TABLE[place - 1]
					: 0
			table.push(points)
		} else {
			// Both 'traditional' and 'p_score' use traditional calculation
			// (p_score requires performance data and can't generate a static table)
			const config = traditionalConfig ?? { firstPlacePoints: 100, step: 5 }
			table.push(calculateTraditionalPoints(place, config))
		}
	}

	return table
}

/**
 * Calculate points for a given place using custom table scoring.
 *
 * @param place - The athlete's finishing position (1-indexed)
 * @param config - Custom table configuration with base template and overrides
 * @param traditionalConfig - Config for traditional template (if used)
 * @returns Points awarded
 *
 * @example
 * // Using winner_takes_more with override for 1st place
 * calculateCustomPoints(1, {
 *   baseTemplate: 'winner_takes_more',
 *   overrides: { '1': 150 }
 * }) // 150
 *
 * calculateCustomPoints(2, {
 *   baseTemplate: 'winner_takes_more',
 *   overrides: { '1': 150 }
 * }) // 85 (from table)
 */
export function calculateCustomPoints(
	place: number,
	config: CustomTableConfig,
	traditionalConfig?: TraditionalConfig,
): number {
	const { baseTemplate, overrides } = config

	// Handle invalid places (0 or negative) - treat as 1st place
	const effectivePlace = Math.max(1, place)

	// Check for override first
	const placeKey = String(effectivePlace)
	if (overrides && placeKey in overrides) {
		return overrides[placeKey]
	}

	// Calculate base points from template
	if (baseTemplate === "winner_takes_more") {
		// Use the winner_takes_more table, floor at 0 for places beyond 30
		return effectivePlace <= WINNER_TAKES_MORE_TABLE.length
			? WINNER_TAKES_MORE_TABLE[effectivePlace - 1]
			: 0
	}

	// Both 'traditional' and 'p_score' use traditional calculation
	const config2 = traditionalConfig ?? { firstPlacePoints: 100, step: 5 }
	return calculateTraditionalPoints(effectivePlace, config2)
}
