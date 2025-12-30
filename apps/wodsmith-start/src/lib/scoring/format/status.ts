/**
 * Status formatting utilities
 */

import type { ScoreStatus } from "../types"

/**
 * Format a score status for display.
 *
 * @example
 * formatStatus("scored")    // → "" (no prefix for scored)
 * formatStatus("cap")       // → "CAP"
 * formatStatus("dq")        // → "DQ"
 * formatStatus("withdrawn") // → "WD"
 */
export function formatStatus(status: ScoreStatus): string {
	switch (status) {
		case "scored":
			return ""
		case "cap":
			return "CAP"
		case "dq":
			return "DQ"
		case "withdrawn":
			return "WD"
		default:
			return ""
	}
}

/**
 * Format a score status for display with full text.
 *
 * @example
 * formatStatusFull("cap")       // → "Time Cap"
 * formatStatusFull("dq")        // → "Disqualified"
 * formatStatusFull("withdrawn") // → "Withdrawn"
 */
export function formatStatusFull(status: ScoreStatus): string {
	switch (status) {
		case "scored":
			return "Scored"
		case "cap":
			return "Time Cap"
		case "dq":
			return "Disqualified"
		case "withdrawn":
			return "Withdrawn"
		default:
			return ""
	}
}

/**
 * Check if a status represents a non-standard completion.
 */
export function isSpecialStatus(status: ScoreStatus): boolean {
	return status !== "scored"
}
