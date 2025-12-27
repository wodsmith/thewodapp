/**
 * Distance decoding: converts millimeters to display distance strings
 */

import { MM_PER_UNIT } from "../constants"
import type { DistanceUnit } from "../types"

export interface DecodeDistanceOptions {
	/** Distance unit for display (defaults to 'm') */
	unit?: DistanceUnit
	/** Include unit suffix (e.g., "5000m" vs "5000") */
	includeUnit?: boolean
	/** Number of decimal places (defaults to 0) */
	decimals?: number
}

/**
 * Decode millimeters to a display distance string.
 *
 * @example
 * decodeDistance(5000000)                           // → "5000"
 * decodeDistance(5000000, { includeUnit: true })    // → "5000m"
 * decodeDistance(5000000, { unit: "km" })           // → "5"
 * decodeDistance(30480, { unit: "ft" })             // → "100"
 * decodeDistance(1609344, { unit: "mi" })           // → "1"
 */
export function decodeDistance(
	mm: number,
	options?: DecodeDistanceOptions,
): string {
	const unit = options?.unit ?? "m"
	const includeUnit = options?.includeUnit ?? false
	const decimals = options?.decimals ?? 0

	const value = mmToUnit(mm, unit)

	// Format the number
	let formatted: string
	if (decimals === 0) {
		formatted = Math.round(value).toString()
	} else {
		const rounded = Number(value.toFixed(decimals))
		if (rounded === Math.floor(rounded)) {
			formatted = Math.floor(rounded).toString()
		} else {
			formatted = rounded.toString()
		}
	}

	if (includeUnit) {
		// Use compact format for distance (no space)
		return `${formatted}${unit}`
	}

	return formatted
}

/**
 * Convert millimeters to a specific distance unit.
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
