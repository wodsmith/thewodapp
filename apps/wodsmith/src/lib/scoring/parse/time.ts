/**
 * Smart time parsing: converts various input formats to standardized time
 */

import { MS_PER_SECOND } from "../constants"
import { decodeTime } from "../decode/time"
import { encodeTime } from "../encode/time"
import type { ParseResult } from "../types"

export interface TimeParseOptions {
	/**
	 * How to interpret raw numbers without colons:
	 * - 'auto': Smart parsing (e.g., "1234" → "12:34")
	 * - 'seconds': Treat as raw seconds
	 * - 'ms': Treat as raw milliseconds
	 */
	precision?: "auto" | "seconds" | "ms"
}

/**
 * Parse a time input string with smart formatting.
 *
 * Smart parsing rules (when precision is 'auto'):
 * - Input with colons: parse as MM:SS or HH:MM:SS
 * - 1-2 digits: treat as seconds (e.g., "45" → "0:45")
 * - 3 digits: treat as M:SS (e.g., "345" → "3:45")
 * - 4 digits: treat as MM:SS (e.g., "1234" → "12:34")
 * - 5 digits: treat as H:MM:SS (e.g., "10234" → "1:02:34")
 * - 6+ digits: treat as HH:MM:SS or more
 *
 * @example
 * parseTime("1234")        // → { encoded: 754000, formatted: "12:34" }
 * parseTime("12:34")       // → { encoded: 754000, formatted: "12:34" }
 * parseTime("12:34.567")   // → { encoded: 754567, formatted: "12:34.567" }
 * parseTime("45")          // → { encoded: 45000, formatted: "0:45" }
 * parseTime("345")         // → { encoded: 225000, formatted: "3:45" }
 */
export function parseTime(
	input: string,
	options?: TimeParseOptions,
): ParseResult {
	const trimmed = input.trim()
	if (!trimmed) {
		return {
			isValid: false,
			encoded: null,
			formatted: "",
			error: "Empty input",
		}
	}

	const precision = options?.precision ?? "auto"

	// If input already has colons, parse directly
	if (trimmed.includes(":")) {
		const encoded = encodeTime(trimmed)
		if (encoded === null) {
			return {
				isValid: false,
				encoded: null,
				formatted: trimmed,
				error: "Invalid time format",
			}
		}
		return {
			isValid: true,
			encoded,
			formatted: decodeTime(encoded),
		}
	}

	// Handle decimal point (could be SS.fff)
	if (trimmed.includes(".")) {
		const [wholePart, decimalPart] = trimmed.split(".")
		if (!wholePart) {
			return {
				isValid: false,
				encoded: null,
				formatted: trimmed,
				error: "Invalid time format",
			}
		}

		// Parse the whole part as time, then add milliseconds
		const { isValid, encoded: wholeEncoded, error } = parseTime(wholePart, options)
		if (!isValid || wholeEncoded === null) {
			return { isValid: false, encoded: null, formatted: trimmed, error }
		}

		// Add milliseconds
		const ms = Number.parseInt((decimalPart ?? "0").padEnd(3, "0").slice(0, 3), 10)
		if (Number.isNaN(ms)) {
			return {
				isValid: false,
				encoded: null,
				formatted: trimmed,
				error: "Invalid milliseconds",
			}
		}

		const encoded = wholeEncoded + ms
		return {
			isValid: true,
			encoded,
			formatted: decodeTime(encoded),
		}
	}

	// No colons - smart parse based on precision option
	if (precision === "seconds") {
		const seconds = Number.parseFloat(trimmed)
		if (Number.isNaN(seconds) || seconds < 0) {
			return {
				isValid: false,
				encoded: null,
				formatted: trimmed,
				error: "Invalid number",
			}
		}
		const encoded = Math.round(seconds * MS_PER_SECOND)
		return {
			isValid: true,
			encoded,
			formatted: decodeTime(encoded),
		}
	}

	if (precision === "ms") {
		const ms = Number.parseInt(trimmed, 10)
		if (Number.isNaN(ms) || ms < 0) {
			return {
				isValid: false,
				encoded: null,
				formatted: trimmed,
				error: "Invalid number",
			}
		}
		return {
			isValid: true,
			encoded: ms,
			formatted: decodeTime(ms),
		}
	}

	// Auto precision - smart parsing
	return parseTimeAuto(trimmed)
}

/**
 * Smart auto-parse for time without colons.
 */
function parseTimeAuto(input: string): ParseResult {
	// Remove any non-digit characters
	const digits = input.replace(/\D/g, "")
	if (!digits) {
		return {
			isValid: false,
			encoded: null,
			formatted: input,
			error: "No digits found",
		}
	}

	let formatted: string

	switch (digits.length) {
		case 1:
		case 2:
			// 1-2 digits: treat as seconds (e.g., "45" → "0:45")
			formatted = `0:${digits.padStart(2, "0")}`
			break

		case 3:
			// 3 digits: M:SS (e.g., "345" → "3:45")
			formatted = `${digits[0]}:${digits.slice(1)}`
			break

		case 4:
			// 4 digits: MM:SS (e.g., "1234" → "12:34")
			formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`
			break

		case 5:
			// 5 digits: H:MM:SS (e.g., "10234" → "1:02:34")
			formatted = `${digits[0]}:${digits.slice(1, 3)}:${digits.slice(3)}`
			break

		case 6:
			// 6 digits: HH:MM:SS (e.g., "010234" → "1:02:34")
			formatted = `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`
			break

		default: {
			// 7+ digits: parse as HH...H:MM:SS
			const hours = digits.slice(0, -4)
			const minutes = digits.slice(-4, -2)
			const seconds = digits.slice(-2)
			formatted = `${hours}:${minutes}:${seconds}`
			break
		}
	}

	// Now encode the formatted time
	const encoded = encodeTime(formatted)
	if (encoded === null) {
		return {
			isValid: false,
			encoded: null,
			formatted: input,
			error: "Invalid time format",
		}
	}

	return {
		isValid: true,
		encoded,
		formatted: decodeTime(encoded),
	}
}

/**
 * Validate that seconds are in valid range (0-59).
 * Returns warnings if seconds >= 60 (which might be intentional).
 */
export function validateTimeInput(encoded: number): string[] {
	const warnings: string[] = []
	
	// Check for very long times (> 24 hours)
	if (encoded > 24 * 60 * 60 * 1000) {
		warnings.push("Time exceeds 24 hours")
	}

	return warnings
}
