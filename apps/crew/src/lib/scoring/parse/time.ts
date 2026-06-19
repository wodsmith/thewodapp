/**
 * Smart time parsing: converts various input formats to standardized time
 */

import { decodeTime } from "../decode/time"
import { encodeTime } from "../encode/time"
import type { ParseResult } from "../types"

export interface TimeParseOptions {
  /**
   * How to interpret bare numeric input:
   * - 'auto' (default) / 'seconds': Treat as raw seconds — matches `encodeTime` so
   *   the live preview always agrees with what `encodeScore` will save.
   * - 'ms': Treat as raw milliseconds.
   */
  precision?: "auto" | "seconds" | "ms"
}

/**
 * Parse a time input string with smart formatting.
 *
 * Mirrors `encodeTime` so the live preview always matches what `encodeScore`
 * will persist on save — there is no separate "smart digit padding" path.
 *
 * Supported formats:
 * - Colon-delimited: "MM:SS", "MM:SS.fff", "HH:MM:SS", "HH:MM:SS.fff"
 * - Period-delimited (3+ parts): "MM.SS.fff", "H.MM.SS.fff"
 * - Decimal seconds (single period): "12.34" → 12.34 sec, "1234.567" → 1234.567 sec
 * - Bare digits: treated as raw seconds — "2000" → 33:20, "45" → 0:45
 *
 * The `precision` option only matters for explicit overrides:
 * - 'auto' (default) and 'seconds' both treat bare numbers as raw seconds
 * - 'ms' treats bare integers as raw milliseconds
 *
 * @example
 * parseTime("12:34")       // → { encoded: 754000, formatted: "12:34" }
 * parseTime("12:34.567")   // → { encoded: 754567, formatted: "12:34.567" }
 * parseTime("12.34.567")   // → { encoded: 754567, formatted: "12:34.567" }
 * parseTime("1.02.34.567") // → { encoded: 3754567, formatted: "1:02:34.567" }
 * parseTime("45")          // → { encoded: 45000,  formatted: "0:45" }
 * parseTime("2000")        // → { encoded: 2000000, formatted: "33:20" }
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

  if (precision === "ms" && !trimmed.includes(":") && !trimmed.includes(".")) {
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
