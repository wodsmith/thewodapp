/**
 * Pure availability logic for competition registration add-ons (merch).
 *
 * Shared by the athlete-facing registration form, the organizer Merch page,
 * and the checkout server fn so all three agree on what "available" means.
 * Authoritative stock enforcement lives in the Stripe checkout workflow;
 * these helpers cover display and submit-time soft checks.
 */
import { COMPETITION_PRODUCT_STATUS } from "@/db/schemas/competition-products"
import { getEndOfDayInTimezone } from "@/utils/timezone-utils"

export interface AddonAvailabilityInput {
  status: string
  /** YYYY-MM-DD order-by deadline, end-of-day in the competition timezone */
  availableUntil: string | null
}

/**
 * A product is purchasable when it is ACTIVE and its order-by deadline
 * (end of day in the competition's timezone) has not passed. A null
 * deadline means available while registration is open.
 */
export function isAddonPurchasable(
  product: AddonAvailabilityInput,
  timezone: string,
  now: Date = new Date(),
): boolean {
  if (product.status !== COMPETITION_PRODUCT_STATUS.ACTIVE) return false
  if (!product.availableUntil) return true
  const deadline = getEndOfDayInTimezone(product.availableUntil, timezone)
  // Malformed deadline strings fail closed: organizers fix the date rather
  // than athletes buying merch the print shop never sees.
  if (!deadline) return false
  return now <= deadline
}

export interface VariantStockInput {
  stockQty: number | null
  soldQty: number
}

/** Remaining sellable units; null = untracked (deadline-only availability). */
export function getVariantRemaining(variant: VariantStockInput): number | null {
  if (variant.stockQty === null) return null
  return Math.max(0, variant.stockQty - variant.soldQty)
}

export function isVariantSoldOut(variant: VariantStockInput): boolean {
  const remaining = getVariantRemaining(variant)
  return remaining !== null && remaining <= 0
}

/**
 * Soft stock check used at checkout creation. The workflow re-checks
 * atomically at payment confirmation, so this only needs to catch the
 * common case early with a friendly error.
 */
export function canFulfillQuantity(
  variant: VariantStockInput | null,
  quantity: number,
): boolean {
  if (quantity < 1) return false
  if (!variant) return true
  const remaining = getVariantRemaining(variant)
  return remaining === null || quantity <= remaining
}

/**
 * Upper bound for the quantity stepper: min of the per-athlete cap and
 * remaining stock, with a hard ceiling so unbounded products still get a
 * sane input.
 */
export const ADDON_QUANTITY_HARD_CAP = 20

export function getMaxSelectableQuantity(
  product: { maxPerAthlete: number | null },
  variant: VariantStockInput | null,
): number {
  const bounds = [ADDON_QUANTITY_HARD_CAP]
  if (product.maxPerAthlete !== null && product.maxPerAthlete > 0) {
    bounds.push(product.maxPerAthlete)
  }
  if (variant) {
    const remaining = getVariantRemaining(variant)
    if (remaining !== null) bounds.push(remaining)
  }
  return Math.max(0, Math.min(...bounds))
}
