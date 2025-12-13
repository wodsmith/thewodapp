/**
 * Score Adapter
 *
 * Bridges legacy encoding (used in results+sets tables) with new encoding
 * (used in @/lib/scoring and scores table).
 *
 * Legacy encoding:
 * - Time: seconds
 * - Rounds+Reps: rounds * 1000 + reps
 * - Load: lbs (raw number)
 * - Distance: meters/feet (raw number)
 *
 * New encoding:
 * - Time: milliseconds
 * - Rounds+Reps: rounds * 100000 + reps
 * - Load: grams
 * - Distance: millimeters
 */

import type { WorkoutScheme } from "@/db/schema"
import { GRAMS_PER_UNIT, MM_PER_UNIT } from "@/lib/scoring"

/**
 * Convert legacy encoding to new encoding
 */
export function convertLegacyToNew(
	legacyValue: number,
	scheme: WorkoutScheme,
): number {
	switch (scheme) {
		case "time":
		case "time-with-cap":
		case "emom": {
			// Legacy: seconds → New: milliseconds
			return legacyValue * 1000
		}

		case "rounds-reps": {
			// Legacy: rounds * 1000 + reps → New: rounds * 100000 + reps
			const legacyRounds = Math.floor(legacyValue / 1000)
			const legacyReps = legacyValue % 1000
			return legacyRounds * 100000 + legacyReps
		}

		case "load": {
			// Legacy: lbs → New: grams
			return Math.round(legacyValue * GRAMS_PER_UNIT.lbs)
		}

		case "meters": {
			// Legacy: meters → New: millimeters
			return Math.round(legacyValue * MM_PER_UNIT.m)
		}

		case "feet": {
			// Legacy: feet → New: millimeters
			return Math.round(legacyValue * MM_PER_UNIT.ft)
		}

		case "reps":
		case "calories":
		case "points":
		case "pass-fail":
			// These are already integers, no conversion needed
			return legacyValue

		default:
			return legacyValue
	}
}

/**
 * Convert new encoding to legacy encoding
 */
export function convertNewToLegacy(
	newValue: number,
	scheme: WorkoutScheme,
): number {
	switch (scheme) {
		case "time":
		case "time-with-cap":
		case "emom": {
			// New: milliseconds → Legacy: seconds
			return Math.round(newValue / 1000)
		}

		case "rounds-reps": {
			// New: rounds * 100000 + reps → Legacy: rounds * 1000 + reps
			const newRounds = Math.floor(newValue / 100000)
			const newReps = newValue % 100000
			return newRounds * 1000 + newReps
		}

		case "load": {
			// New: grams → Legacy: lbs
			return Math.round(newValue / GRAMS_PER_UNIT.lbs)
		}

		case "meters": {
			// New: millimeters → Legacy: meters
			return Math.round(newValue / MM_PER_UNIT.m)
		}

		case "feet": {
			// New: millimeters → Legacy: feet
			return Math.round(newValue / MM_PER_UNIT.ft)
		}

		case "reps":
		case "calories":
		case "points":
		case "pass-fail":
			// These are already integers, no conversion needed
			return newValue

		default:
			return newValue
	}
}

/**
 * Convert legacy rounds-reps encoding (fractional representation)
 * to new encoding.
 *
 * Legacy sometimes stores rounds-reps as: rounds + reps/100
 * e.g., 5 rounds + 12 reps = 5.12
 *
 * New: rounds * 100000 + reps
 */
export function convertLegacyFractionalRoundsReps(
	fractionalValue: number,
): number {
	const rounds = Math.floor(fractionalValue)
	const reps = Math.round((fractionalValue % 1) * 100)
	return rounds * 100000 + reps
}

/**
 * Convert new rounds-reps encoding to legacy fractional representation
 */
export function convertNewToFractionalRoundsReps(newValue: number): number {
	const rounds = Math.floor(newValue / 100000)
	const reps = newValue % 100000
	return rounds + reps / 100
}
