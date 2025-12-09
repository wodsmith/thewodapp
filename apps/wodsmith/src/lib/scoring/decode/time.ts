/**
 * Time decoding: converts milliseconds to formatted time strings
 */

import { MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND } from "../constants"

export interface DecodeTimeOptions {
	/** Always show milliseconds even if .000 */
	alwaysShowMs?: boolean
	/** Always show hours even if 0 */
	alwaysShowHours?: boolean
}

/**
 * Decode milliseconds to a formatted time string.
 *
 * Format rules:
 * - Shows hours only if >= 60 minutes (or alwaysShowHours is true)
 * - Shows milliseconds only if non-zero (or alwaysShowMs is true)
 * - Pads minutes and seconds to 2 digits
 * - Pads milliseconds to 3 digits
 *
 * @example
 * decodeTime(754000)           // → "12:34"
 * decodeTime(754567)           // → "12:34.567"
 * decodeTime(3754000)          // → "1:02:34"
 * decodeTime(3754567)          // → "1:02:34.567"
 * decodeTime(754000, { alwaysShowMs: true })  // → "12:34.000"
 */
export function decodeTime(ms: number, options?: DecodeTimeOptions): string {
	if (ms < 0) return "0:00"

	const totalSeconds = Math.floor(ms / MS_PER_SECOND)
	const milliseconds = ms % MS_PER_SECOND

	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	const showHours = hours > 0 || options?.alwaysShowHours
	const showMs = milliseconds > 0 || options?.alwaysShowMs

	// Build time string
	let result: string

	if (showHours) {
		// HH:MM:SS format
		result = `${hours}:${pad(minutes)}:${pad(seconds)}`
	} else {
		// MM:SS format
		result = `${minutes}:${pad(seconds)}`
	}

	// Add milliseconds if needed
	if (showMs) {
		result += `.${pad(milliseconds, 3)}`
	}

	return result
}

/**
 * Decode milliseconds to seconds (for backwards compatibility).
 *
 * @example
 * decodeTimeToSeconds(754567)  // → 754.567
 */
export function decodeTimeToSeconds(ms: number): number {
	return ms / MS_PER_SECOND
}

/**
 * Pad a number with leading zeros.
 */
function pad(num: number, length = 2): string {
	return num.toString().padStart(length, "0")
}
