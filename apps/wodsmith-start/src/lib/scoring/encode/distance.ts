/**
 * Distance encoding: converts distance values to millimeters
 *
 * All distances are stored internally in millimeters for precision
 * and unit-agnostic sorting.
 */

import { MM_PER_UNIT } from "../constants"
import type { DistanceUnit } from "../types"

/**
 * Encode a distance value to millimeters.
 *
 * @param input - Distance value as string (e.g., "5000", "1.5")
 * @param unit - Distance unit (defaults to 'm')
 *
 * @example
 * encodeDistance("5000", "m")   // → 5000000 (mm)
 * encodeDistance("5", "km")     // → 5000000 (mm)
 * encodeDistance("100", "ft")   // → 30480 (mm)
 * encodeDistance("1", "mi")     // → 1609344 (mm)
 */
export function encodeDistance(
	input: string,
	unit: DistanceUnit = "m",
): number | null {
	const trimmed = input.trim()
	if (!trimmed) return null

	const value = Number.parseFloat(trimmed)
	if (Number.isNaN(value) || value < 0) {
		return null
	}

	return encodeDistanceFromNumber(value, unit)
}

/**
 * Encode a numeric distance value to millimeters.
 *
 * @param value - Distance value as number
 * @param unit - Distance unit (defaults to 'm')
 *
 * @example
 * encodeDistanceFromNumber(5000, "m")  // → 5000000
 * encodeDistanceFromNumber(100, "ft")  // → 30480
 */
export function encodeDistanceFromNumber(
	value: number,
	unit: DistanceUnit = "m",
): number | null {
	if (Number.isNaN(value) || value < 0) {
		return null
	}

	const mmPerUnit = MM_PER_UNIT[unit]
	return Math.round(value * mmPerUnit)
}

/**
 * Convert millimeters to a specific distance unit.
 * Useful for display or validation.
 *
 * @example
 * mmToUnit(5000000, "m")   // → 5000
 * mmToUnit(5000000, "km")  // → 5
 * mmToUnit(30480, "ft")    // → 100
 */
export function mmToUnit(mm: number, unit: DistanceUnit): number {
	const mmPerUnit = MM_PER_UNIT[unit]
	return mm / mmPerUnit
}
