/**
 * Load decoding: converts grams to display weight strings
 */

import { GRAMS_PER_UNIT } from "../constants"
import type { WeightUnit } from "../types"

export interface DecodeLoadOptions {
	/** Weight unit for display (defaults to 'lbs') */
	unit?: WeightUnit
	/** Include unit suffix (e.g., "225 lbs" vs "225") */
	includeUnit?: boolean
	/** Number of decimal places (defaults to 0 for lbs, 1 for kg) */
	decimals?: number
}

/**
 * Decode grams to a display weight string.
 *
 * @example
 * decodeLoad(102058)                              // → "225"
 * decodeLoad(102058, { includeUnit: true })       // → "225 lbs"
 * decodeLoad(102058, { unit: "kg" })              // → "100"
 * decodeLoad(102058, { unit: "kg", includeUnit: true }) // → "100 kg"
 * decodeLoad(102285, { includeUnit: true })       // → "225.5 lbs"
 */
export function decodeLoad(grams: number, options?: DecodeLoadOptions): string {
	const unit = options?.unit ?? "lbs"
	const includeUnit = options?.includeUnit ?? false

	const value = gramsToUnit(grams, unit)

	// Determine decimal places
	// Default: 0 for lbs (round to nearest pound), 1 for kg
	const decimals = options?.decimals ?? (unit === "kg" ? 1 : 0)

	// Format the number
	let formatted: string
	if (decimals === 0) {
		formatted = Math.round(value).toString()
	} else {
		// Check if we actually need decimals
		const rounded = Number(value.toFixed(decimals))
		if (rounded === Math.floor(rounded)) {
			formatted = Math.floor(rounded).toString()
		} else {
			formatted = rounded.toString()
		}
	}

	if (includeUnit) {
		return `${formatted} ${unit}`
	}

	return formatted
}

/**
 * Convert grams to a specific weight unit.
 *
 * @example
 * gramsToUnit(102058, "lbs")  // → ~225
 * gramsToUnit(100000, "kg")   // → 100
 */
export function gramsToUnit(grams: number, unit: WeightUnit): number {
	const gramsPerUnit = GRAMS_PER_UNIT[unit]
	return grams / gramsPerUnit
}
