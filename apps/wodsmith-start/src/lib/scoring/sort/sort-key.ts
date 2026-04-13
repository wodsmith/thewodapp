/**
 * Sort key computation for database storage
 *
 * Sort keys encode status + normalized score into a single BigInt
 * for efficient single-column index sorting. Stored as a zero-padded
 * string in SQLite, so we are NOT limited to 64 bits.
 *
 * Structure (123-bit BigInt, stored as 38-char zero-padded string):
 * - Bits 122-120: status_order (0-7)
 * - Bits 119-80:  primary score value (40 bits, ~1 trillion max)
 * - Bits 79-40:   secondary value / inverted reps at cap (40 bits, ~1 trillion max)
 * - Bits 39-0:    tiebreak value (40 bits, ~1 trillion max)
 *
 * All three data segments use the same 40-bit width for simplicity.
 * Each handles any realistic score value with massive headroom.
 */

import { MAX_SCORE_VALUE, STATUS_ORDER } from "../constants"
import type { Score, ScoreStatus, SortDirection } from "../types"
import { getSortDirection } from "./direction"

/** Max value for each 40-bit segment (~1.1 trillion) */
const SEGMENT_MAX = 2n ** 40n - 1n

/** Bit positions for each segment */
const SECONDARY_SHIFT = 40n
const PRIMARY_SHIFT = 80n
const STATUS_SHIFT = 120n

/** Number of non-status bits */
const DATA_BITS = 120n

/**
 * Within the "cap" bucket we bit-pack `cappedRoundCount` into the top 8 bits
 * of the 40-bit primary segment so that a score with fewer capped rounds
 * always sorts ahead of a score with more, regardless of summed total.
 *
 * Time-with-cap values are milliseconds (32-bit safe for workouts up to ~49
 * days), so the low 32 bits of the primary slot hold the time and the next
 * 8 bits hold the capped-round count.
 */
const CAP_TIME_BITS = 32n
const CAP_TIME_MASK = (1n << CAP_TIME_BITS) - 1n
const CAP_COUNT_MAX = 255

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
    Partial<
      Pick<Score, "timeCap" | "tiebreak" | "cappedRoundCount" | "rounds">
    >,
): bigint {
  const direction = getSortDirection(score.scheme, score.scoreType)

  // Extract secondary value (reps at cap) if present
  const secondaryValue = score.timeCap?.secondaryValue ?? 0

  // Derive capped-round count. Prefer the explicit field; otherwise fall
  // back to counting rounds with status "cap" when the full array is
  // available. This is the dominant tiebreaker inside the "cap" bucket.
  const cappedRoundCount =
    score.cappedRoundCount ??
    (score.rounds
      ? score.rounds.filter((r) => r.status === "cap").length
      : 0)

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
    cappedRoundCount,
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
 * @param cappedRoundCount - Count of individual rounds marked "cap" (used
 *   as a dominant tiebreaker within the "cap" status bucket)
 */
function computeSortKeyWithComponents(
  value: number | null,
  status: ScoreStatus,
  direction: SortDirection,
  secondaryValue: number,
  tiebreakValue: bigint,
  cappedRoundCount: number = 0,
): bigint {
  const statusBits = BigInt(STATUS_ORDER[status]) << STATUS_SHIFT

  // Handle null values - they sort last within their status group
  if (value === null) {
    return statusBits | MAX_SCORE_VALUE
  }

  // Normalize primary value based on sort direction
  // For ascending (lower is better): use value as-is
  // For descending (higher is better): invert so higher values get lower sort keys
  let normalizedPrimary =
    direction === "asc"
      ? BigInt(value) & SEGMENT_MAX
      : SEGMENT_MAX - (BigInt(value) & SEGMENT_MAX)

  // Cap bucket: bit-pack `cappedRoundCount` above the time value so more
  // caps → larger primary → worse sort key, regardless of summed total.
  // Only meaningful for "asc" (time-with-cap is always asc) and only when
  // time fits in 32 bits (holds up to ~49 days of ms, far beyond any WOD).
  if (status === "cap" && direction === "asc" && cappedRoundCount > 0) {
    const clampedCount = Math.min(cappedRoundCount, CAP_COUNT_MAX)
    const timeBits = normalizedPrimary & CAP_TIME_MASK
    normalizedPrimary = (BigInt(clampedCount) << CAP_TIME_BITS) | timeBits
  }

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
  const primaryBits = (sortKey >> PRIMARY_SHIFT) & SEGMENT_MAX

  // Denormalize the primary value
  const value =
    direction === "asc"
      ? Number(primaryBits)
      : Number(SEGMENT_MAX - primaryBits)

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
 * A 123-bit value can require up to 38 decimal digits (log10(2^123) ≈ 37.02),
 * so we pad to 38 characters to guarantee all possible values fit. In practice,
 * the highest status_order is 3 (withdrawn), so the current max is well under
 * 37 digits — but padding to 38 provides safety for the full 3-bit status range.
 *
 * @param sortKey - The bigint sort key to convert
 * @returns Zero-padded string representation
 *
 * @example
 * sortKeyToString(510000n) // → "00000000000000000000000000000000510000"
 */
export function sortKeyToString(sortKey: bigint): string {
  return sortKey.toString().padStart(38, "0")
}
