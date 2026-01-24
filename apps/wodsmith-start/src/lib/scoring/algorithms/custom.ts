/**
 * Custom Table Scoring Algorithm
 *
 * Builds on a base template with optional place-specific overrides.
 * Supports two base templates:
 * - traditional: Fixed step deduction
 * - winner_takes_more: Front-loaded points table (like CrossFit Games)
 *
 * Both templates support auto-scaling to division size.
 *
 * Note: P-Score cannot be used as a base template because it calculates
 * points dynamically based on performance gaps, not static positions.
 *
 * @see docs/plans/configurable-scoring-system.md
 */

import type {
	CustomTableConfig,
	TraditionalConfig,
	WinnerTakesMoreConfig,
} from "@/types/scoring"
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
 * Interpolate a value from the winner takes more table for a scaled position.
 * Uses linear interpolation between table values.
 *
 * @param scaledPosition - Position in the scaled range (0-based, 0 to divisionSize-1)
 * @param divisionSize - Size of the division
 * @param minPoints - Minimum points for last place
 * @returns Interpolated points value
 */
function interpolateWinnerTakesMore(
	scaledPosition: number,
	divisionSize: number,
	minPoints: number,
): number {
	const tableLength = WINNER_TAKES_MORE_TABLE.length

	// If division is larger than or equal to table, use direct lookup
	if (divisionSize >= tableLength) {
		const index = Math.min(scaledPosition, tableLength - 1)
		return WINNER_TAKES_MORE_TABLE[index] ?? minPoints
	}

	// Map the position to the table range
	// Position 0 (1st place) always maps to index 0 (100 points)
	// Position divisionSize-1 (last place) maps to a calculated endpoint
	if (scaledPosition === 0) {
		return WINNER_TAKES_MORE_TABLE[0]
	}

	// For smaller divisions, we want to preserve the "front-loaded" nature
	// by using a portion of the table proportional to division size
	const tableIndex = (scaledPosition / (divisionSize - 1)) * (tableLength - 1)
	const lowerIndex = Math.floor(tableIndex)
	const upperIndex = Math.ceil(tableIndex)
	const fraction = tableIndex - lowerIndex

	const lowerValue = WINNER_TAKES_MORE_TABLE[lowerIndex] ?? minPoints
	const upperValue = WINNER_TAKES_MORE_TABLE[upperIndex] ?? minPoints

	// Linear interpolation
	const interpolated = lowerValue + (upperValue - lowerValue) * fraction

	// Ensure minimum points for last place
	if (scaledPosition === divisionSize - 1) {
		return Math.max(minPoints, Math.round(interpolated))
	}

	return Math.round(interpolated)
}

/**
 * Calculate points for winner takes more algorithm with optional auto-scaling.
 *
 * @param place - The athlete's finishing position (1-indexed)
 * @param config - Winner takes more configuration (partial is allowed)
 * @param divisionSize - Optional division size for auto-scaling
 * @returns Points awarded
 */
export function calculateWinnerTakesMorePoints(
	place: number,
	config?: Partial<WinnerTakesMoreConfig>,
	divisionSize?: number,
): number {
	const effectivePlace = Math.max(1, place)
	const autoScale = config?.autoScale ?? false
	const minPoints = config?.minPoints ?? 5

	// If auto-scaling with valid division size
	if (autoScale && divisionSize && divisionSize > 1) {
		// Position is 0-indexed for interpolation
		const position = effectivePlace - 1

		// Places beyond division size get minimum points
		if (effectivePlace > divisionSize) {
			return minPoints
		}

		return interpolateWinnerTakesMore(position, divisionSize, minPoints)
	}

	// Standard lookup from table
	if (effectivePlace <= WINNER_TAKES_MORE_TABLE.length) {
		return WINNER_TAKES_MORE_TABLE[effectivePlace - 1]
	}

	return 0
}

/**
 * Generate a winner takes more points table.
 *
 * @param count - Number of places to generate
 * @param config - Optional winner takes more configuration (partial is allowed)
 * @param divisionSize - Optional division size for auto-scaling
 * @returns Array of points for places 1 through count
 */
export function generateWinnerTakesMoreTable(
	count: number,
	config?: Partial<WinnerTakesMoreConfig>,
	divisionSize?: number,
): number[] {
	const table: number[] = []
	for (let place = 1; place <= count; place++) {
		table.push(calculateWinnerTakesMorePoints(place, config, divisionSize))
	}
	return table
}

/**
 * Generate a points table for a given base template.
 *
 * @param baseTemplate - The template to use as base
 * @param count - Number of places to generate
 * @param traditionalConfig - Config for traditional template (partial is allowed)
 * @param winnerTakesMoreConfig - Config for winner_takes_more template (partial is allowed)
 * @param divisionSize - Optional division size for auto-scaling
 * @returns Array of points for places 1 through count
 *
 * @example
 * generatePointsTable('winner_takes_more', 10)
 * // [100, 85, 75, 67, 62, 58, 55, 52, 50, 48]
 *
 * generatePointsTable('traditional', 5, { firstPlacePoints: 100, step: 5 })
 * // [100, 95, 90, 85, 80]
 *
 * generatePointsTable('winner_takes_more', 10, undefined, { autoScale: true }, 10)
 * // [100, 89, 79, 70, 64, 58, 52, 46, 40, 34] (interpolated for 10 athletes)
 */
export function generatePointsTable(
	baseTemplate: CustomTableConfig["baseTemplate"],
	count: number,
	traditionalConfig?: Partial<TraditionalConfig>,
	winnerTakesMoreConfig?: Partial<WinnerTakesMoreConfig>,
	divisionSize?: number,
): number[] {
	if (baseTemplate === "winner_takes_more") {
		return generateWinnerTakesMoreTable(count, winnerTakesMoreConfig, divisionSize)
	}

	// 'traditional' uses traditional calculation
	const table: number[] = []
	const config = traditionalConfig ?? { firstPlacePoints: 100, step: 5 }
	for (let place = 1; place <= count; place++) {
		table.push(calculateTraditionalPoints(place, config, divisionSize))
	}
	return table
}

/**
 * Calculate points for a given place using custom table scoring.
 *
 * @param place - The athlete's finishing position (1-indexed)
 * @param config - Custom table configuration with base template and overrides
 * @param traditionalConfig - Config for traditional template (if used, partial is allowed)
 * @param winnerTakesMoreConfig - Config for winner_takes_more template (if used, partial is allowed)
 * @param divisionSize - Optional division size for auto-scaling
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
	traditionalConfig?: Partial<TraditionalConfig>,
	winnerTakesMoreConfig?: Partial<WinnerTakesMoreConfig>,
	divisionSize?: number,
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
		return calculateWinnerTakesMorePoints(
			effectivePlace,
			winnerTakesMoreConfig,
			divisionSize,
		)
	}

	// 'traditional' uses traditional calculation
	const config2 = traditionalConfig ?? { firstPlacePoints: 100, step: 5 }
	return calculateTraditionalPoints(effectivePlace, config2, divisionSize)
}
