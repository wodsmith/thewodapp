/**
 * Commerce Utilities for TanStack Start
 * Fee calculation helpers and platform default configuration.
 */
import type {FeeBreakdown, FeeConfiguration} from './fee-calculator'

/**
 * Platform default fee configuration
 * These values are used when competitions don't specify custom fees
 */
export const PLATFORM_DEFAULTS = {
  /** Platform fee percentage in basis points (250 = 2.5%) */
  platformPercentageBasisPoints: 250,
  /** Platform fixed fee in cents ($2.00) */
  platformFixedCents: 200,
  /** Stripe fee percentage in basis points (290 = 2.9%) */
  stripePercentageBasisPoints: 290,
  /** Stripe fixed fee in cents ($0.30) */
  stripeFixedCents: 30,
} as const

/**
 * Calculate comprehensive fee breakdown for a competition registration
 *
 * Supports four fee models combining platform and Stripe fee options:
 * 1. Customer pays both (default): Platform + Stripe fees added to registration
 * 2. Customer pays platform only: Platform fees added, Stripe absorbed by organizer
 * 3. Customer pays Stripe only: Stripe fees added, platform absorbed by organizer
 * 4. Organizer absorbs both: Only registration fee charged
 *
 * @example Customer pays platform fees (default) - $50 registration:
 * - Platform fee: $50 * 2.5% + $2.00 = $3.25
 * - Total charged: $53.25 (+ Stripe if passStripeFeesToCustomer)
 * - Organizer receives: $50.00 (registration fee)
 *
 * @example Organizer absorbs platform fees - $50 registration:
 * - Platform fee: $3.25 (deducted from organizer payout)
 * - Total charged: $50.00 (only registration)
 * - Organizer receives: $46.75 (after platform fee deduction)
 */
export function calculateCompetitionFees(
  registrationFeeCents: number,
  config: FeeConfiguration,
): FeeBreakdown {
  // Calculate platform fee (always calculated, but may be absorbed by organizer)
  const platformFeeCents =
    Math.round(
      registrationFeeCents * (config.platformPercentageBasisPoints / 10000),
    ) + config.platformFixedCents

  // Determine what's included in customer charge
  const platformFeeForCustomer = config.passPlatformFeesToCustomer
    ? platformFeeCents
    : 0

  // Subtotal before Stripe processing (registration + platform if passed to customer)
  const subtotalCents = registrationFeeCents + platformFeeForCustomer

  if (config.passStripeFeesToCustomer) {
    // Customer pays Stripe fees - solve for total that covers Stripe's cut
    //
    // IMPORTANT: Stripe charges fees on the TOTAL amount, creating a circular dependency.
    // We need to solve: total = subtotal + (total * stripeRate) + stripeFixed
    // Rearranging: total - (total * stripeRate) = subtotal + stripeFixed
    //              total * (1 - stripeRate) = subtotal + stripeFixed
    //              total = (subtotal + stripeFixed) / (1 - stripeRate)
    const stripeRate = config.stripePercentageBasisPoints / 10000
    const totalChargeCents = Math.ceil(
      (subtotalCents + config.stripeFixedCents) / (1 - stripeRate),
    )

    // Stripe fee is what they actually take from the total
    const stripeFeeCents =
      Math.round(totalChargeCents * stripeRate) + config.stripeFixedCents

    // Calculate organizer net:
    // - If platform passed to customer: organizer gets registration fee
    // - If platform absorbed: organizer gets registration minus platform fee
    const organizerNetCents = config.passPlatformFeesToCustomer
      ? registrationFeeCents
      : registrationFeeCents - platformFeeCents

    return {
      registrationFeeCents,
      platformFeeCents,
      stripeFeeCents,
      totalChargeCents,
      organizerNetCents,
      stripeFeesPassedToCustomer: true,
      platformFeesPassedToCustomer: config.passPlatformFeesToCustomer,
    }
  }

  // Organizer absorbs Stripe fees - deducted from total
  const totalChargeCents = subtotalCents
  const stripeFeeCents =
    Math.round(
      totalChargeCents * (config.stripePercentageBasisPoints / 10000),
    ) + config.stripeFixedCents

  // Net received after Stripe takes their cut
  const netReceivedCents = totalChargeCents - stripeFeeCents

  // Calculate organizer net:
  // - If platform passed to customer: organizer gets net minus nothing (platform already in total)
  // - If platform absorbed: organizer gets net minus platform fee
  const organizerNetCents = config.passPlatformFeesToCustomer
    ? netReceivedCents - platformFeeCents // Platform was in customer charge, now deduct for Wodsmith
    : netReceivedCents - platformFeeCents // Platform wasn't charged to customer, deduct from organizer

  return {
    registrationFeeCents,
    platformFeeCents,
    stripeFeeCents,
    totalChargeCents,
    organizerNetCents,
    stripeFeesPassedToCustomer: false,
    platformFeesPassedToCustomer: config.passPlatformFeesToCustomer,
  }
}

/**
 * Build fee configuration from competition settings
 * Falls back to platform defaults for any missing values
 */
export function buildFeeConfig(competition: {
  platformFeePercentage?: number | null
  platformFeeFixed?: number | null
  passStripeFeesToCustomer?: boolean | null
  passPlatformFeesToCustomer?: boolean | null
}): FeeConfiguration {
  return {
    platformPercentageBasisPoints:
      competition.platformFeePercentage ??
      PLATFORM_DEFAULTS.platformPercentageBasisPoints,
    platformFixedCents:
      competition.platformFeeFixed ?? PLATFORM_DEFAULTS.platformFixedCents,
    stripePercentageBasisPoints: PLATFORM_DEFAULTS.stripePercentageBasisPoints,
    stripeFixedCents: PLATFORM_DEFAULTS.stripeFixedCents,
    passStripeFeesToCustomer: competition.passStripeFeesToCustomer ?? false,
    // Default to true for new competitions (platform fees passed to customer)
    passPlatformFeesToCustomer: competition.passPlatformFeesToCustomer ?? true,
  }
}

/**
 * Format cents as a dollar amount string
 * @example formatCents(5325) => "$53.25"
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
