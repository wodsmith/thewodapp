/**
 * Utilities for formatting and calculating workout scores
 * Used across leaderboards, workout cards, and result displays
 */

import type { Set as DBSet } from "@/db/schema"

/**
 * Format a score based on the workout scheme
 */
export function formatScore(
	aggregatedScore: number | null,
	scheme: string | undefined,
	isTimeCapped = false,
): string {
	if (aggregatedScore === null) return "N/A"

	switch (scheme) {
		case "time":
		case "emom": {
			// Convert seconds to MM:SS format
			const minutes = Math.floor(aggregatedScore / 60)
			const seconds = Math.floor(aggregatedScore % 60)
			return `${minutes}:${seconds.toString().padStart(2, "0")}`
		}
		case "time-with-cap": {
			if (isTimeCapped) {
				// Time-capped result - show reps
				return `${aggregatedScore} reps (capped)`
			}
			// Finished result - show time
			const minutes = Math.floor(aggregatedScore / 60)
			const seconds = Math.floor(aggregatedScore % 60)
			return `${minutes}:${seconds.toString().padStart(2, "0")}`
		}
		case "reps":
		case "calories":
		case "points":
			return aggregatedScore.toString()
		case "rounds-reps": {
			// For AMRAP, show as rounds if whole number
			const rounds = Math.floor(aggregatedScore)
			const reps = Math.round((aggregatedScore % 1) * 100) // Assuming fractional part represents reps
			return reps > 0 ? `${rounds}+${reps}` : rounds.toString()
		}
		case "load":
			return `${aggregatedScore} lbs`
		case "meters":
			return `${aggregatedScore}m`
		case "feet":
			return `${aggregatedScore}ft`
		case "pass-fail":
			return `${aggregatedScore} passes`
		default:
			return aggregatedScore.toString()
	}
}

/**
 * Calculate aggregated score from sets based on scoreType
 * Returns tuple: [aggregatedScore, isTimeCapped]
 */
export function calculateAggregatedScore(
	resultSets: Array<Pick<DBSet, "reps" | "weight" | "time" | "score" | "distance">>,
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
			values = resultSets.map(s => s.time).filter((v): v is number => v !== null)
			break
		case "time-with-cap": {
			// For time-with-cap, check if result is time-capped (has reps) or finished (has time)
			const hasReps = resultSets.some(s => s.reps !== null)
			const hasTime = resultSets.some(s => s.time !== null)

			if (hasReps && !hasTime) {
				// Time-capped result - use reps (higher is better)
				values = resultSets.map(s => s.reps).filter((v): v is number => v !== null)
				isTimeCapped = true
			} else {
				// Finished result - use time
				values = resultSets.map(s => s.time).filter((v): v is number => v !== null)
				isTimeCapped = false
			}
			break
		}
		case "reps":
		case "rounds-reps":
			// Try reps field first, then score field (reps are sometimes stored in score)
			values = resultSets.map(s => s.reps ?? s.score).filter((v): v is number => v !== null)
			break
		case "load":
			values = resultSets.map(s => s.weight).filter((v): v is number => v !== null)
			break
		case "calories":
		case "meters":
		case "feet":
		case "points":
			values = resultSets.map(s => s.score ?? s.reps ?? s.distance).filter((v): v is number => v !== null)
			break
		case "pass-fail":
			// Count passes (status === "pass" would be in score field as 1/0)
			values = resultSets.map(s => s.score).filter((v): v is number => v !== null)
			break
		default:
			return [null, false]
	}

	if (values.length === 0) return [null, false]

	// Apply aggregation based on scoreType
	// For time-capped results, use max (higher reps is better), otherwise use the default
	const defaultScoreType = isTimeCapped ? "max" : (scoreType || getDefaultScoreType(scheme))

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
			aggregatedScore = values[0]
			break
		case "last":
			aggregatedScore = values[values.length - 1]
			break
		default:
			aggregatedScore = null
	}

	return [aggregatedScore, isTimeCapped]
}

/**
 * Get default scoreType for a scheme
 */
export function getDefaultScoreType(scheme: string): string {
	const defaults: Record<string, string> = {
		time: "min", // Lower time is better
		"time-with-cap": "min", // Lower time is better
		"pass-fail": "first", // First attempt matters
		"rounds-reps": "max", // Higher rounds+reps is better
		reps: "max", // Higher reps is better
		emom: "max", // Higher reps/score in EMOM is better
		load: "max", // Higher load is better
		calories: "max", // Higher calories is better
		meters: "max", // Higher distance is better
		feet: "max", // Higher distance is better
		points: "max", // Higher points is better
	}
	return defaults[scheme] || "max"
}

/**
 * Format a score for display from raw result data
 * This is a convenience function that combines calculation and formatting
 */
export function formatScoreFromSets(
	resultSets: Array<Pick<DBSet, "reps" | "weight" | "time" | "score" | "distance">>,
	scheme: string,
	scoreType: string | null,
): string {
	const [aggregatedScore, isTimeCapped] = calculateAggregatedScore(resultSets, scheme, scoreType)
	return formatScore(aggregatedScore, scheme, isTimeCapped)
}
