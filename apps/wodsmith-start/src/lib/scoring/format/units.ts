/**
 * Unit formatting and conversion utilities
 */

import { GRAMS_PER_UNIT, MM_PER_UNIT } from "../constants"
import type { DistanceUnit, WeightUnit } from "../types"

/**
 * Get the display label for a weight unit.
 */
export function getWeightUnitLabel(unit: WeightUnit): string {
	return unit // "lbs" or "kg" - already user-friendly
}

/**
 * Get the display label for a distance unit.
 */
export function getDistanceUnitLabel(unit: DistanceUnit): string {
	switch (unit) {
		case "m":
			return "m"
		case "km":
			return "km"
		case "ft":
			return "ft"
		case "mi":
			return "mi"
		default:
			return unit
	}
}

/**
 * Convert weight between units.
 *
 * @example
 * convertWeight(225, "lbs", "kg")  // → ~102
 * convertWeight(100, "kg", "lbs")  // → ~220
 */
export function convertWeight(
	value: number,
	fromUnit: WeightUnit,
	toUnit: WeightUnit,
): number {
	if (fromUnit === toUnit) return value

	// Convert to grams first, then to target unit
	const grams = value * GRAMS_PER_UNIT[fromUnit]
	return grams / GRAMS_PER_UNIT[toUnit]
}

/**
 * Convert distance between units.
 *
 * @example
 * convertDistance(5000, "m", "km")  // → 5
 * convertDistance(1, "mi", "m")     // → 1609.344
 */
export function convertDistance(
	value: number,
	fromUnit: DistanceUnit,
	toUnit: DistanceUnit,
): number {
	if (fromUnit === toUnit) return value

	// Convert to mm first, then to target unit
	const mm = value * MM_PER_UNIT[fromUnit]
	return mm / MM_PER_UNIT[toUnit]
}

/**
 * Format a number with appropriate precision.
 * Removes trailing zeros from decimals.
 *
 * @example
 * formatNumber(100.5, 1)   // → "100.5"
 * formatNumber(100.0, 1)   // → "100"
 * formatNumber(100.123, 2) // → "100.12"
 */
export function formatNumber(value: number, maxDecimals: number = 0): string {
	if (maxDecimals === 0) {
		return Math.round(value).toString()
	}

	const rounded = Number(value.toFixed(maxDecimals))

	// Check if we actually need decimals
	if (rounded === Math.floor(rounded)) {
		return Math.floor(rounded).toString()
	}

	return rounded.toString()
}
