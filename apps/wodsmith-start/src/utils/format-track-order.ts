/**
 * Format a trackOrder number for display.
 *
 * MySQL decimal columns return strings at runtime (e.g. "1.00"), so we
 * coerce with Number() before checking.
 *
 * - Whole numbers (standalone/parent events): "01", "05", "12"
 * - Decimal numbers (sub-events):             "5.01", "5.02"
 */
export function formatTrackOrder(trackOrder: number | string): string {
  const n = Number(trackOrder)
  if (n % 1 === 0) return String(n).padStart(2, "0")
  const whole = Math.floor(n)
  const decimal = Math.round((n - whole) * 100)
  return `${whole}.${String(decimal).padStart(2, "0")}`
}
