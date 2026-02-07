/**
 * Sort key computation for database storage
 *
 * Sort keys encode status + normalized score into a single BigInt
 * for efficient single-column index sorting. Stored as a zero-padded
 * string in SQLite, so we are NOT limited to 64 bits.
 *
 * Structure (103-bit BigInt, stored as 32-char zero-padded string):
 * - Bits 102-100: status_order (0-7)
 * - Bits 99-60:   primary score value (40 bits, ~1 trillion max)
 * - Bits 59-30:   secondary value / inverted reps at cap (30 bits, ~1 billion max)
 * - Bits 29-0:    tiebreak value (30 bits, ~1 billion max)
 *
 * Each segment has generous headroom so no score encoding can overflow:
 * - Primary handles rounds-reps up to 10M+ rounds, time up to 12+ days in ms
 * - Secondary handles any realistic reps-at-cap count
 * - Tiebreak handles time values up to 12+ days in ms
 */

import { MAX_SCORE_VALUE, STATUS_ORDER } from "../constants"
import type { Score, ScoreStatus, SortDirection } from "../types"
import { getSortDirection } from "./direction"

/** Max value for the 40-bit primary segment (~1.1 trillion) */
const PRIMARY_MAX = 2n ** 40n - 1n

/** Max value for each 30-bit secondary/tiebreak segment (~1.07 billion) */
const SECONDARY_MAX = 2n ** 30n - 1n

/** Max value for the 30-bit tiebreak segment (~1.07 billion) */
const TIEBREAK_MAX = 2n ** 30n - 1n

/** Bit positions for each segment */
const SECONDARY_SHIFT = 30n
const PRIMARY_SHIFT = 60n
const STATUS_SHIFT = 100n

/** Number of non-status bits */
const DATA_BITS = 100n

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
				: TIEBREAK_MAX - BigInt(score.tiebreak.value)
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
	const statusBits = BigInt(STATUS_ORDER[status]) << STATUS_SHIFT

	// Handle null values - they sort last within their status group
	if (value === null) {
		return statusBits | MAX_SCORE_VALUE
	}

	// Normalize primary value based on sort direction
	// For ascending (lower is better): use value as-is
	// For descending (higher is better): invert so higher values get lower sort keys
	const normalizedPrimary =
		direction === "asc"
			? BigInt(value) & PRIMARY_MAX
			: PRIMARY_MAX - (BigInt(value) & PRIMARY_MAX)

	// For capped status, secondary value (reps) matters - higher is better, so invert
	// For scored status, secondary doesn't matter (use 0)
	const normalizedSecondary =
		status === "cap"
			? SECONDARY_MAX - (BigInt(secondaryValue) & SECONDARY_MAX)
			: 0n

	// Combine: status | primary | secondary | tiebreak
	return (
		statusBits |
		(normalizedPrimary << PRIMARY_SHIFT) |
		(normalizedSecondary << SECONDARY_SHIFT) |
		(tiebreakValue & TIEBREAK_MAX)
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
 * Note: Value extraction is lossy — secondary and tiebreak bits are discarded.
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
	// Extract status order from top bits
	const statusOrder = Number(sortKey >> STATUS_SHIFT)

	// Extract all non-status bits to check for null
	const allBits = sortKey & ((1n << DATA_BITS) - 1n)

	// Check for null (MAX_VALUE indicator)
	if (allBits === MAX_SCORE_VALUE) {
		return { statusOrder, value: null }
	}

	// Extract primary value from its segment
	const primaryBits = (sortKey >> PRIMARY_SHIFT) & PRIMARY_MAX

	// Denormalize the primary value
	const value =
		direction === "asc"
			? Number(primaryBits)
			: Number(PRIMARY_MAX - primaryBits)

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
 * Max value with 103 bits is 31 digits, so we pad to 32 characters.
 *
 * @param sortKey - The bigint sort key to convert
 * @returns Zero-padded string representation
 *
 * @example
 * sortKeyToString(510000n) // → "00000000000000000000000000510000"
 */
export function sortKeyToString(sortKey: bigint): string {
	return sortKey.toString().padStart(32, "0")
}
