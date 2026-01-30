/**
 * Sort key computation for database storage
 *
 * Sort keys encode status + normalized score into a single BIGINT
 * for efficient single-column index sorting.
 *
 * Structure (64-bit signed integer):
 * - Bits 62-60: status_order (0-7)
 * - Bits 59-40: primary score value (20 bits, ~1M max)
 * - Bits 39-20: secondary value / inverted reps at cap (20 bits)
 * - Bits 19-0: tiebreak value (20 bits)
 */

import { MAX_SCORE_VALUE, STATUS_ORDER } from "../constants"
import type { Score, ScoreStatus, SortDirection } from "../types"
import { getSortDirection } from "./direction"

/** Max value for each 20-bit segment */
const SEGMENT_MAX = 2n ** 20n - 1n

/** Bit positions for each segment */
const SECONDARY_SHIFT = 20n
const PRIMARY_SHIFT = 40n

/**
 * Compute a sort key for database storage.
 *
 * The sort key encodes status, score value, secondary value (reps at cap),
 * and tiebreak into a single integer for efficient index-based sorting.
 *
 * @param score - Score object or partial with required fields
 *
 * @example
 * // Time workout (lower is better)
 * computeSortKey({ value: 510000, status: "scored", scheme: "time", scoreType: "min" })
 * // → encodes status 0 + normalized value
 *
 * // Capped with secondary value
 * computeSortKey({ value: 600000, status: "cap", scheme: "time-with-cap", scoreType: "min",
 *   timeCap: { ms: 600000, secondaryValue: 100 } })
 * // → encodes status 1 + primary + inverted secondary (higher reps = lower key)
 */
export function computeSortKey(
	score: Pick<Score, "value" | "status" | "scheme" | "scoreType"> &
		Partial<Pick<Score, "timeCap" | "tiebreak">>,
): bigint {
	const direction = getSortDirection(score.scheme, score.scoreType)

	// Extract secondary value (reps at cap) if present
	const secondaryValue = score.timeCap?.secondaryValue ?? 0

	// Extract tiebreak value if present
	// For time-based tiebreaks, lower is better (use as-is)
	// For reps-based tiebreaks, higher is better (invert)
	let tiebreakValue = 0n
	if (score.tiebreak) {
		const tbDirection = score.tiebreak.scheme === "time" ? "asc" : "desc"
		tiebreakValue =
			tbDirection === "asc"
				? BigInt(score.tiebreak.value)
				: SEGMENT_MAX - BigInt(score.tiebreak.value)
	}

	return computeSortKeyWithComponents(
		score.value,
		score.status,
		direction,
		secondaryValue,
		tiebreakValue,
	)
}

/**
 * Compute sort key with all components.
 *
 * @param value - Primary score value (null for incomplete)
 * @param status - Score status
 * @param direction - Sort direction for primary value
 * @param secondaryValue - Secondary value (reps at cap), higher is better
 * @param tiebreakValue - Pre-normalized tiebreak value
 */
function computeSortKeyWithComponents(
	value: number | null,
	status: ScoreStatus,
	direction: SortDirection,
	secondaryValue: number,
	tiebreakValue: bigint,
): bigint {
	// Status order occupies the top 3 bits (shifted left 60 positions)
	const statusBits = BigInt(STATUS_ORDER[status]) << 60n

	// Handle null values - they sort last within their status group
	if (value === null) {
		return statusBits | MAX_SCORE_VALUE
	}

	// Normalize primary value based on sort direction
	// For ascending (lower is better): use value as-is
	// For descending (higher is better): invert so higher values get lower sort keys
	const normalizedPrimary =
		direction === "asc"
			? BigInt(value) & SEGMENT_MAX
			: SEGMENT_MAX - (BigInt(value) & SEGMENT_MAX)

	// For capped status, secondary value (reps) matters - higher is better, so invert
	// For scored status, secondary doesn't matter (use 0)
	const normalizedSecondary =
		status === "cap" ? SEGMENT_MAX - (BigInt(secondaryValue) & SEGMENT_MAX) : 0n

	// Combine: status | primary | secondary | tiebreak
	return (
		statusBits |
		(normalizedPrimary << PRIMARY_SHIFT) |
		(normalizedSecondary << SECONDARY_SHIFT) |
		(tiebreakValue & SEGMENT_MAX)
	)
}

/**
 * Compute sort key with explicit direction (legacy compatibility).
 *
 * @param value - Score value (null for incomplete)
 * @param status - Score status
 * @param direction - Sort direction
 */
export function computeSortKeyWithDirection(
	value: number | null,
	status: ScoreStatus,
	direction: SortDirection,
): bigint {
	return computeSortKeyWithComponents(value, status, direction, 0, 0n)
}

/**
 * Extract status and approximate value from a sort key.
 * Note: Value extraction is lossy for descending sorts.
 *
 * @param sortKey - The sort key to decode
 * @param direction - The sort direction used when encoding
 */
export function extractFromSortKey(
	sortKey: bigint,
	direction: SortDirection,
): {
	statusOrder: number
	value: number | null
} {
	// Extract status order from top 3 bits
	const statusOrder = Number(sortKey >> 60n)

	// Extract value from bottom 60 bits
	const valueBits = sortKey & ((1n << 60n) - 1n)

	// Check for null (MAX_VALUE indicator)
	if (valueBits === MAX_SCORE_VALUE) {
		return { statusOrder, value: null }
	}

	// Denormalize the value
	const value =
		direction === "asc"
			? Number(valueBits)
			: Number(MAX_SCORE_VALUE - valueBits)

	return { statusOrder, value }
}

/**
 * Get the status from a status order number.
 */
export function statusFromOrder(order: number): ScoreStatus {
	const entries = Object.entries(STATUS_ORDER)
	for (const [status, statusOrder] of entries) {
		if (statusOrder === order) {
			return status as ScoreStatus
		}
	}
	return "scored"
}

/**
 * Convert a bigint sort key to a zero-padded string for database storage.
 *
 * Since SQLite stores sortKey as text, we need zero-padding to ensure
 * lexicographic string comparison produces the same ordering as numeric comparison.
 *
 * Max value is 2^63 - 1 which is 19 digits, so we pad to 19 characters.
 *
 * @param sortKey - The bigint sort key to convert
 * @returns Zero-padded string representation
 *
 * @example
 * sortKeyToString(510000n) // → "0000000000000510000"
 * sortKeyToString(1152921504606846975n) // → "1152921504606846975"
 */
export function sortKeyToString(sortKey: bigint): string {
	return sortKey.toString().padStart(19, "0")
}
