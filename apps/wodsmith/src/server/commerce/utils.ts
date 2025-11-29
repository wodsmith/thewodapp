import type { FeeConfiguration, FeeBreakdown } from "./fee-calculator"

/**
 * Calculate comprehensive fee breakdown for a competition registration
 *
 * Supports two fee models:
 * 1. Organizer absorbs Stripe fees (default): Customer pays registration + platform fee only
 * 2. Customer pays Stripe fees: Customer pays registration + platform fee + Stripe fee
 *
 * @example Organizer absorbs (default) - $50 registration:
 * - Platform fee: $50 * 2.5% + $2.00 = $3.25
 * - Total charged: $53.25
 * - Stripe deducts: $1.84
 * - Organizer receives: $48.16
 *
 * @example Customer pays Stripe fees - $50 registration:
 * - Platform fee: $3.25
 * - Stripe fee: ~$1.90 (calculated to cover Stripe's cut exactly)
 * - Total charged: $55.15
 * - Organizer receives: $50.00 (exactly registration fee)
 */
export function calculateCompetitionFees(
	registrationFeeCents: number,
	config: FeeConfiguration,
): FeeBreakdown {
	// Platform fee = (registration * percentage) + fixed
	const platformFeeCents =
		Math.round(
			registrationFeeCents * (config.platformPercentageBasisPoints / 10000),
		) + config.platformFixedCents

	// Subtotal before Stripe processing
	const subtotalCents = registrationFeeCents + platformFeeCents

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
		// Organizer gets exactly what they set as registration fee
		const organizerNetCents = registrationFeeCents

		return {
			registrationFeeCents,
			platformFeeCents,
			stripeFeeCents,
			totalChargeCents,
			organizerNetCents,
			passedToCustomer: true,
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
	const organizerNetCents = netReceivedCents - platformFeeCents

	return {
		registrationFeeCents,
		platformFeeCents,
		stripeFeeCents,
		totalChargeCents,
		organizerNetCents,
		passedToCustomer: false,
	}
}