/**
 * Fee math for registration add-ons (merch).
 *
 * Add-ons charge the platform percentage fee but NOT the fixed per-item fee
 * ($2 makes sense per registration, not per $25 t-shirt), and follow the
 * competition's existing pass-stripe/pass-platform configuration.
 *
 * Pricing is computed per unit and multiplied by quantity so the registration
 * form summary, the Stripe line item (unit_amount × quantity), and the
 * recorded purchase row are always cent-identical.
 */
import type {
  FeeBreakdown,
  FeeConfiguration,
} from "@/server/commerce/fee-calculator"
import { calculateCompetitionFees } from "@/server/commerce/utils"

/** Drop the fixed platform fee for merch; keep everything else. */
export function buildAddonFeeConfig(
  config: FeeConfiguration,
): FeeConfiguration {
  return { ...config, platformFixedCents: 0 }
}

/** All-in per-unit breakdown for one add-on unit. */
export function getAddonUnitBreakdown(
  unitPriceCents: number,
  config: FeeConfiguration,
): FeeBreakdown {
  return calculateCompetitionFees(unitPriceCents, buildAddonFeeConfig(config))
}

/** Scale a per-unit breakdown to a line quantity (no re-rounding drift). */
export function multiplyFeeBreakdown(
  unit: FeeBreakdown,
  quantity: number,
): FeeBreakdown {
  return {
    ...unit,
    registrationFeeCents: unit.registrationFeeCents * quantity,
    platformFeeCents: unit.platformFeeCents * quantity,
    stripeFeeCents: unit.stripeFeeCents * quantity,
    totalChargeCents: unit.totalChargeCents * quantity,
    organizerNetCents: unit.organizerNetCents * quantity,
  }
}
