/**
 * Load encoding: converts weight values to grams
 *
 * All weights are stored internally in grams for precision
 * and unit-agnostic sorting.
 */

import { GRAMS_PER_UNIT } from "../constants"
import type { WeightUnit } from "../types"

/**
 * Encode a weight value to grams.
 *
 * @param input - Weight value as string (e.g., "225", "225.5")
 * @param unit - Weight unit (defaults to 'lbs')
 *
 * @example
 * encodeLoad("225", "lbs")   // → 102058 (grams)
 * encodeLoad("100", "kg")    // → 100000 (grams)
 * encodeLoad("225.5", "lbs") // → 102285 (grams)
 */
export function encodeLoad(
	input: string,
	unit: WeightUnit = "lbs",
): number | null {
	const trimmed = input.trim()
	if (!trimmed) return null

	const value = Number.parseFloat(trimmed)
	if (Number.isNaN(value) || value < 0) {
		return null
	}

	return encodeLoadFromNumber(value, unit)
}

/**
 * Encode a numeric weight value to grams.
 *
 * @param value - Weight value as number
 * @param unit - Weight unit (defaults to 'lbs')
 *
 * @example
 * encodeLoadFromNumber(225, "lbs")   // → 102058
 * encodeLoadFromNumber(100, "kg")    // → 100000
 */
export function encodeLoadFromNumber(
	value: number,
	unit: WeightUnit = "lbs",
): number | null {
	if (Number.isNaN(value) || value < 0) {
		return null
	}

	const gramsPerUnit = GRAMS_PER_UNIT[unit]
	return Math.round(value * gramsPerUnit)
}

/**
 * Convert grams to a specific weight unit.
 * Useful for display or validation.
 *
 * @example
 * gramsToUnit(102058, "lbs")  // → 225 (approximately)
 * gramsToUnit(100000, "kg")   // → 100
 */
export function gramsToUnit(grams: number, unit: WeightUnit): number {
	const gramsPerUnit = GRAMS_PER_UNIT[unit]
	return grams / gramsPerUnit
}
