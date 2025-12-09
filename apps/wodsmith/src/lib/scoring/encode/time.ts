/**
 * Time encoding: converts time strings to milliseconds
 */

import { MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND } from "../constants"

/**
 * Encode a time string to milliseconds.
 *
 * Supported formats:
 * - "MM:SS" → minutes and seconds
 * - "MM:SS.fff" → minutes, seconds, and milliseconds
 * - "HH:MM:SS" → hours, minutes, and seconds
 * - "HH:MM:SS.fff" → hours, minutes, seconds, and milliseconds
 * - "SS" or "SSS..." → raw seconds (when no colon present)
 *
 * @example
 * encodeTime("12:34")        // → 754000 (12 min 34 sec)
 * encodeTime("12:34.567")    // → 754567 (12 min 34.567 sec)
 * encodeTime("1:02:34")      // → 3754000 (1 hr 2 min 34 sec)
 * encodeTime("1:02:34.500")  // → 3754500
 * encodeTime("90")           // → 90000 (90 seconds)
 */
export function encodeTime(input: string): number | null {
	const trimmed = input.trim()
	if (!trimmed) return null

	// Check if input contains a colon (formatted time)
	if (trimmed.includes(":")) {
		return parseFormattedTime(trimmed)
	}

	// No colon - treat as raw seconds
	const seconds = Number.parseFloat(trimmed)
	if (Number.isNaN(seconds) || seconds < 0) {
		return null
	}

	return Math.round(seconds * MS_PER_SECOND)
}

/**
 * Parse a formatted time string (with colons) to milliseconds.
 */
function parseFormattedTime(input: string): number | null {
	// Split into main part and milliseconds part
	const [mainPart, msPart] = input.split(".")
	if (!mainPart) return null

	const parts = mainPart.split(":")

	let hours = 0
	let minutes = 0
	let seconds = 0
	let milliseconds = 0

	if (parts.length === 2) {
		// MM:SS format
		const [minStr, secStr] = parts
		minutes = Number.parseInt(minStr ?? "", 10)
		seconds = Number.parseInt(secStr ?? "", 10)
	} else if (parts.length === 3) {
		// HH:MM:SS format
		const [hrStr, minStr, secStr] = parts
		hours = Number.parseInt(hrStr ?? "", 10)
		minutes = Number.parseInt(minStr ?? "", 10)
		seconds = Number.parseInt(secStr ?? "", 10)
	} else {
		return null
	}

	// Parse milliseconds if present
	if (msPart) {
		// Pad or truncate to 3 digits
		const padded = msPart.padEnd(3, "0").slice(0, 3)
		milliseconds = Number.parseInt(padded, 10)
	}

	// Validate ranges
	if (
		Number.isNaN(hours) ||
		Number.isNaN(minutes) ||
		Number.isNaN(seconds) ||
		Number.isNaN(milliseconds) ||
		hours < 0 ||
		minutes < 0 ||
		minutes >= 60 ||
		seconds < 0 ||
		seconds >= 60 ||
		milliseconds < 0 ||
		milliseconds >= 1000
	) {
		// Allow minutes >= 60 only if no hours specified (e.g., "120:30")
		if (parts.length === 2 && minutes >= 0 && seconds >= 0 && seconds < 60) {
			// Valid MM:SS with minutes >= 60
		} else {
			return null
		}
	}

	return (
		hours * MS_PER_HOUR +
		minutes * MS_PER_MINUTE +
		seconds * MS_PER_SECOND +
		milliseconds
	)
}

/**
 * Encode time from raw seconds to milliseconds.
 * Use this when you know the input is in seconds.
 *
 * @example
 * encodeTimeFromSeconds(754)    // → 754000
 * encodeTimeFromSeconds(754.567) // → 754567
 */
export function encodeTimeFromSeconds(seconds: number): number {
	return Math.round(seconds * MS_PER_SECOND)
}

/**
 * Encode time from raw milliseconds (pass-through with validation).
 *
 * @example
 * encodeTimeFromMs(754567) // → 754567
 */
export function encodeTimeFromMs(ms: number): number | null {
	if (Number.isNaN(ms) || ms < 0) {
		return null
	}
	return Math.round(ms)
}
