/**
 * Utilities for formatting and calculating workout scores
 * Used across leaderboards, workout cards, and result displays
 *
 * LEGACY ADAPTER: This file maintains backward compatibility with the old
 * results+sets encoding while internally using the new @/lib/scoring library.
 */

import type { Set as DBSet, WorkoutScheme } from "@/db/schema"
import {
	decodeScore as libDecodeScore,
	getDefaultScoreType as libGetDefaultScoreType,
} from "@/lib/scoring"
import {
	convertLegacyFractionalRoundsReps,
	convertLegacyToNew,
} from "./score-adapter"

/**
 * Format a score based on the workout scheme
 *
 * @param aggregatedScore - Legacy encoded value (seconds, fractional rounds-reps, lbs, etc.)
 * @param scheme - Workout scheme
 * @param isTimeCapped - For time-with-cap, whether the result was capped
 */
export function formatScore(
	aggregatedScore: number | null,
	scheme: string | undefined,
	isTimeCapped = false,
): string {
	if (aggregatedScore === null) return "N/A"
	if (!scheme) return aggregatedScore.toString()

	// Special handling for time-with-cap when capped
	if (scheme === "time-with-cap" && isTimeCapped) {
		// When capped, aggregatedScore is reps (already in correct format)
		return `${aggregatedScore} reps (capped)`
	}

	// For rounds-reps, check if it's fractional format (legacy)
	let newEncoded: number
	if (scheme === "rounds-reps" && aggregatedScore < 100) {
		// Fractional format: 5.12 = 5 rounds + 12 reps
		newEncoded = convertLegacyFractionalRoundsReps(aggregatedScore)
	} else {
		// Convert legacy encoding to new encoding
		newEncoded = convertLegacyToNew(aggregatedScore, scheme as WorkoutScheme)
	}

	// Use new library to decode and format
	return libDecodeScore(newEncoded, scheme as WorkoutScheme, {
		includeUnit: scheme === "load" || scheme === "meters" || scheme === "feet",
		weightUnit: "lbs",
	})
}

/**
 * Calculate aggregated score from sets based on scoreType
 * Returns tuple: [aggregatedScore, isTimeCapped]
 *
 * @returns Legacy encoded aggregated score (seconds, fractional rounds-reps, lbs, etc.)
 */
export function calculateAggregatedScore(
	resultSets: Array<
		Pick<DBSet, "reps" | "weight" | "time" | "score" | "distance">
	>,
	scheme: string,
	scoreType: string | null,
): [number | null, boolean] {
	if (resultSets.length === 0) return [null, false]

	// Determine which field to aggregate based on scheme
	let values: number[] = []
	let isTimeCapped = false

	switch (scheme) {
		case "time":
		case "emom":
			values = resultSets
				.map((s) => s.time)
				.filter((v): v is number => v !== null)
			break
		case "time-with-cap": {
			// For time-with-cap, check if result is time-capped (has reps) or finished (has time)
			const hasReps = resultSets.some((s) => s.reps !== null)
			const hasTime = resultSets.some((s) => s.time !== null)

			if (hasReps && !hasTime) {
				// Time-capped result - use reps (higher is better)
				values = resultSets
					.map((s) => s.reps)
					.filter((v): v is number => v !== null)
				isTimeCapped = true
			} else {
				// Finished result - use time
				values = resultSets
					.map((s) => s.time)
					.filter((v): v is number => v !== null)
				isTimeCapped = false
			}
			break
		}
		case "reps":
			// Try reps field first, then score field (reps are sometimes stored in score)
			values = resultSets
				.map((s) => s.reps ?? s.score)
				.filter((v): v is number => v !== null)
			break
		case "rounds-reps": {
			// For rounds+reps: score = rounds, reps = reps
			// Combine into a single value as rounds.reps (e.g., 5 rounds + 12 reps = 5.12)
			// This allows proper sorting and formatting
			values = resultSets
				.map((s) => {
					const rounds = s.score ?? 0
					const reps = s.reps ?? 0
					// Store as rounds + reps/100 for proper sorting (legacy fractional format)
					// e.g., 5 rounds + 12 reps = 5.12
					return rounds + reps / 100
				})
				.filter((v) => v > 0)
			break
		}
		case "load":
			values = resultSets
				.map((s) => s.weight)
				.filter((v): v is number => v !== null)
			break
		case "calories":
		case "meters":
		case "feet":
		case "points":
			values = resultSets
				.map((s) => s.score ?? s.reps ?? s.distance)
				.filter((v): v is number => v !== null)
			break
		case "pass-fail":
			// Count passes (status === "pass" would be in score field as 1/0)
			values = resultSets
				.map((s) => s.score)
				.filter((v): v is number => v !== null)
			break
		default:
			return [null, false]
	}

	if (values.length === 0) return [null, false]

	// Apply aggregation based on scoreType
	// For time-capped results, use max (higher reps is better), otherwise use the default
	const defaultScoreType = isTimeCapped
		? "max"
		: scoreType || getDefaultScoreType(scheme)

	let aggregatedScore: number | null = null
	switch (defaultScoreType) {
		case "min":
			aggregatedScore = Math.min(...values)
			break
		case "max":
			aggregatedScore = Math.max(...values)
			break
		case "sum":
			aggregatedScore = values.reduce((sum, v) => sum + v, 0)
			break
		case "average":
			aggregatedScore = values.reduce((sum, v) => sum + v, 0) / values.length
			break
		case "first":
			aggregatedScore = values[0] ?? null
			break
		case "last":
			aggregatedScore = values[values.length - 1] ?? null
			break
		default:
			aggregatedScore = null
	}

	return [aggregatedScore, isTimeCapped]
}

/**
 * Get default scoreType for a scheme
 *
 * Uses the new library's defaults for consistency
 */
export function getDefaultScoreType(scheme: string): string {
	return libGetDefaultScoreType(scheme as WorkoutScheme)
}

/**
 * Format a score for display from raw result data
 * This is a convenience function that combines calculation and formatting
 */
export function formatScoreFromSets(
	resultSets: Array<
		Pick<DBSet, "reps" | "weight" | "time" | "score" | "distance">
	>,
	scheme: string,
	scoreType: string | null,
): string {
	const [aggregatedScore, isTimeCapped] = calculateAggregatedScore(
		resultSets,
		scheme,
		scoreType,
	)
	return formatScore(aggregatedScore, scheme, isTimeCapped)
}
