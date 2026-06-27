/**
 * Pure helpers for bulk heat scheduling on the Crew Heats page.
 *
 * Heats are auto-spaced the same way wodsmith-start spaces them in
 * copyHeatsFromEventFn: each subsequent heat starts
 *   startTime + index × (durationMinutes + transitionMinutes)
 * The math is timezone-agnostic — the caller supplies an absolute start
 * `Date` (parsed from the organizer's datetime-local input, which the UI
 * shows in the event timezone) and we only add minute offsets to it.
 */

// @lat: [[crew#Bulk Heat Scheduling]]

export const DEFAULT_HEAT_DURATION_MINUTES = 8
export const DEFAULT_TRANSITION_MINUTES = 2
/** Guardrail so an accidental large count can't flood an event. */
export const MAX_BULK_HEATS = 60

export interface SpacedHeatInput {
  /** Number of heats to create (>= 1). */
  count: number
  /**
   * Absolute start time of the first heat, or null to create heats without
   * scheduled times.
   */
  startTime: Date | null
  durationMinutes: number
  transitionMinutes: number
  venueId?: string | null
}

export interface SpacedHeat {
  scheduledTime: Date | null
  venueId: string | null
  durationMinutes: number | null
}

const MS_PER_MINUTE = 60_000

/**
 * Build the array of heats to create, with each heat's scheduledTime spaced
 * by `durationMinutes + transitionMinutes` from the previous one. Returns an
 * empty array when count is not a positive integer.
 */
export function buildSpacedHeats({
  count,
  startTime,
  durationMinutes,
  transitionMinutes,
  venueId = null,
}: SpacedHeatInput): SpacedHeat[] {
  if (!Number.isInteger(count) || count < 1) return []

  const duration = Number.isFinite(durationMinutes) ? durationMinutes : 0
  const transition = Number.isFinite(transitionMinutes) ? transitionMinutes : 0
  const slotMinutes = duration + transition

  return Array.from({ length: count }, (_, index) => ({
    scheduledTime:
      startTime && !Number.isNaN(startTime.getTime())
        ? new Date(startTime.getTime() + index * slotMinutes * MS_PER_MINUTE)
        : null,
    venueId: venueId ?? null,
    durationMinutes: duration > 0 ? duration : null,
  }))
}

// ============================================================================
// Per-heat editable cascade (datetime-local wall-clock strings)
// ============================================================================

/** One row in the editable heat list shown by the bulk builder. */
export interface CascadedHeatRow {
  heatNumber: number
  /** `datetime-local` value ("YYYY-MM-DDThh:mm"), or "" when no start time. */
  localValue: string
}

export interface CascadeInput {
  count: number
  /**
   * The first heat's `datetime-local` value as typed by the organizer
   * (interpreted in the event timezone at submit time). Empty string means
   * no scheduled times.
   */
  startLocalValue: string
  /** Heat length in minutes (the active workout's heat length). */
  lengthMinutes: number
  /** Gap between heats in minutes. */
  gapMinutes: number
  /** Heat number assigned to the first row (defaults to 1). */
  startHeatNumber?: number
}

const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * Format a `datetime-local` string from naive Y/M/D/h/m components.
 */
function toLocalValue(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`
}

/**
 * Cascade per-heat `datetime-local` values from a start value, length, and
 * gap: heat N = start + (N-1) × (length + gap). The arithmetic runs on the
 * naive wall-clock components (via a UTC calendar container) so the values
 * stay in the organizer's chosen wall clock — the event timezone is only
 * applied when these strings are converted to stored UTC datetimes at submit.
 *
 * Returns one row per heat. When `startLocalValue` is empty or malformed,
 * every row's `localValue` is "" (heats created without scheduled times).
 */
export function buildCascadedLocalTimes({
  count,
  startLocalValue,
  lengthMinutes,
  gapMinutes,
  startHeatNumber = 1,
}: CascadeInput): CascadedHeatRow[] {
  if (!Number.isInteger(count) || count < 1) return []

  const match = startLocalValue.match(LOCAL_DATETIME_RE)
  const length = Number.isFinite(lengthMinutes) ? lengthMinutes : 0
  const gap = Number.isFinite(gapMinutes) ? gapMinutes : 0
  const slotMinutes = length + gap

  if (!match) {
    return Array.from({ length: count }, (_, index) => ({
      heatNumber: startHeatNumber + index,
      localValue: "",
    }))
  }

  const [, y, mo, d, h, mi] = match
  // Use a UTC instant purely as a calendar-arithmetic container so adding
  // minutes never crosses a browser-local DST boundary.
  const baseMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
  )

  return Array.from({ length: count }, (_, index) => {
    const slot = new Date(baseMs + index * slotMinutes * MS_PER_MINUTE)
    return {
      heatNumber: startHeatNumber + index,
      localValue: toLocalValue(
        slot.getUTCFullYear(),
        slot.getUTCMonth() + 1,
        slot.getUTCDate(),
        slot.getUTCHours(),
        slot.getUTCMinutes(),
      ),
    }
  })
}
