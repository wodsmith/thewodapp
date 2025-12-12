/**
 * Score Parser (New Library Adapter)
 *
 * LEGACY ADAPTER: This maintains backward compatibility by returning legacy-encoded
 * values while internally using the new @/lib/scoring library.
 *
 * This file will eventually replace score-parser.ts
 */

import type { WorkoutScheme, TiebreakScheme } from "@/db/schema"
import {
	parseScore as libParseScore,
	parseTiebreak as libParseTiebreak,
} from "@/lib/scoring"
import { convertNewToLegacy } from "./score-adapter"

export interface ParseResult {
	formatted: string
	rawValue: number | null // Seconds for time, reps for AMRAP, lbs for load, etc. (LEGACY ENCODING)
	isValid: boolean
	needsTieBreak: boolean
	scoreStatus: "scored" | "dns" | "dnf" | "cap" | null
	error?: string
	/** Non-blocking warning message (e.g., "Interpreted as complete rounds") */
	warning?: string
}

/**
 * Smart score parser that handles all workout schemes
 *
 * For time-based schemes, plain numbers without delimiters are treated as seconds.
 * For example, "90" → "1:30" (90 seconds = 1 minute 30 seconds).
 *
 * Examples:
 * - "90" → "1:30" (time/time-with-cap - 90 seconds)
 * - "1:30" → "1:30" (time/time-with-cap - standard format)
 * - "150" → "150 reps" (reps/rounds-reps)
 * - "225" → "225 lbs" (load)
 * - "cap" or "c" → "CAP" (time-with-cap only)
 * - "dns" → "DNS" (Did Not Start)
 * - "dnf" → "DNF" (Did Not Finish)
 */
export function parseScore(
	input: string,
	scheme: WorkoutScheme,
	timeCap?: number,
	tiebreakScheme?: TiebreakScheme | null,
): ParseResult {
	const normalized = input.toLowerCase().trim()

	// Handle empty input
	if (!normalized) {
		return {
			formatted: "",
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: undefined,
		}
	}

	// Handle special statuses
	if (normalized === "dns" || normalized === "did not start") {
		return {
			formatted: "DNS",
			rawValue: null,
			isValid: true,
			needsTieBreak: false,
			scoreStatus: "dns",
		}
	}
	if (normalized === "dnf" || normalized === "did not finish") {
		return {
			formatted: "DNF",
			rawValue: null,
			isValid: true,
			needsTieBreak: false,
			scoreStatus: "dnf",
		}
	}
	if (normalized === "cap" || normalized === "c") {
		// CAP only valid for time-based schemes
		if (scheme !== "time-with-cap" && scheme !== "time") {
			return {
				formatted: input,
				rawValue: null,
				isValid: false,
				needsTieBreak: false,
				scoreStatus: null,
				error: "CAP is only valid for timed workouts",
			}
		}

		const formatted = timeCap ? `CAP (${formatTime(timeCap)})` : "CAP"

		return {
			formatted,
			rawValue: timeCap ?? null,
			isValid: true,
			needsTieBreak: tiebreakScheme != null, // Need tie-break if workout has one configured
			scoreStatus: "cap",
		}
	}

	// Use new library to parse
	// For time-based schemes, use "seconds" precision so plain numbers are treated as seconds
	// e.g., "90" → "1:30" instead of "0:90" (invalid) or being interpreted as MM:SS
	const result = libParseScore(input, scheme, {
		unit: "lbs", // Default to lbs for legacy compatibility
		timePrecision: "seconds", // Plain numbers are seconds for time-based schemes
	})

	if (!result.isValid) {
		return {
			formatted: input,
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: result.error,
		}
	}

	// Convert new encoding to legacy encoding
	const legacyValue =
		result.encoded !== null ? convertNewToLegacy(result.encoded, scheme) : null

	// For time-with-cap scheme, validate against time cap
	if (
		scheme === "time-with-cap" &&
		timeCap !== undefined &&
		legacyValue !== null
	) {
		// If time equals cap exactly, treat as CAP
		if (legacyValue === timeCap) {
			return {
				formatted: `CAP (${formatTime(timeCap)})`,
				rawValue: timeCap,
				isValid: true,
				needsTieBreak: tiebreakScheme != null,
				scoreStatus: "cap",
			}
		}

		// If time exceeds cap, reject it
		if (legacyValue > timeCap) {
			return {
				formatted: result.formatted,
				rawValue: null,
				isValid: false,
				needsTieBreak: false,
				scoreStatus: null,
				error: `Time cannot exceed cap of ${formatTime(timeCap)}`,
			}
		}
	}

	return {
		formatted: result.formatted,
		rawValue: legacyValue,
		isValid: true,
		needsTieBreak: tiebreakScheme != null,
		scoreStatus: "scored",
		// Warnings are non-blocking hints, not errors
		warning: result.warnings?.[0],
	}
}

/**
 * Parse a tie-break score based on the tie-break scheme.
 * 
 * For time-based tiebreaks, plain numbers without delimiters are treated as seconds.
 * For example, "90" → "1:30" (90 seconds = 1 minute 30 seconds).
 */
export function parseTieBreakScore(
	input: string,
	tiebreakScheme: TiebreakScheme,
): ParseResult {
	const normalized = input.toLowerCase().trim()

	if (!normalized) {
		return {
			formatted: "",
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
		}
	}

	// Use new library to parse tiebreak
	// For time tiebreaks, use "seconds" precision so plain numbers are treated as seconds
	// e.g., "90" → "1:30" instead of "0:90" (invalid) or being interpreted as MM:SS
	const result = libParseTiebreak(input, tiebreakScheme, {
		timePrecision: "seconds",
	})

	if (!result.isValid) {
		return {
			formatted: input,
			rawValue: null,
			isValid: false,
			needsTieBreak: false,
			scoreStatus: null,
			error: result.error,
		}
	}

	// Convert to legacy encoding
	const scheme: WorkoutScheme = tiebreakScheme === "time" ? "time" : "reps"
	const legacyValue =
		result.encoded !== null ? convertNewToLegacy(result.encoded, scheme) : null

	return {
		formatted: result.formatted,
		rawValue: legacyValue,
		isValid: true,
		needsTieBreak: false,
		scoreStatus: "scored",
	}
}

/**
 * Calculate if a score is an outlier (>2 standard deviations from mean)
 */
export function isOutlier(
	scoreValue: number,
	divisionScores: number[],
): boolean {
	if (divisionScores.length < 3) return false // Need minimum sample

	const mean =
		divisionScores.reduce((sum, s) => sum + s, 0) / divisionScores.length
	const variance =
		divisionScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) /
		divisionScores.length
	const stdDev = Math.sqrt(variance)

	return Math.abs(scoreValue - mean) > 2 * stdDev
}

function formatTime(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
