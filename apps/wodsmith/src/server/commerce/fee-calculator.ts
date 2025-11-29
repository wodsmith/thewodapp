import "server-only"
import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionDivisionFeesTable,
	competitionsTable,
} from "@/db/schema"

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
 * Fee configuration for calculating competition fees
 */
export interface FeeConfiguration {
	/** Platform percentage in basis points (250 = 2.5%) */
	platformPercentageBasisPoints: number
	/** Platform fixed fee in cents (200 = $2.00) */
	platformFixedCents: number
	/** Stripe percentage in basis points (290 = 2.9%) */
	stripePercentageBasisPoints: number
	/** Stripe fixed fee in cents (30 = $0.30) */
	stripeFixedCents: number
	/** If true, Stripe fees are passed to customer instead of absorbed by organizer */
	passStripeFeesToCustomer: boolean
}

/**
 * Complete fee breakdown for a competition registration
 */
export interface FeeBreakdown {
	/** Base registration fee set by organizer (in cents) */
	registrationFeeCents: number
	/** Platform fee charged by Wodsmith (in cents) */
	platformFeeCents: number
	/** Stripe processing fee (in cents) */
	stripeFeeCents: number
	/** Total amount charged to customer (in cents) */
	totalChargeCents: number
	/** Net amount organizer receives after all fees (in cents) */
	organizerNetCents: number
	/** Whether Stripe fees were passed to customer */
	passedToCustomer: boolean
}

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

/**
 * Get registration fee for a specific competition division
 *
 * Resolution order:
 * 1. Division-specific fee (from competition_division_fees table)
 * 2. Competition default fee (from competitions.defaultRegistrationFeeCents)
 * 3. $0 (free)
 */
export async function getRegistrationFee(
	competitionId: string,
	divisionId: string,
): Promise<number> {
	const db = getDb()

	// Check for division-specific fee first
	const divisionFee = await db.query.competitionDivisionFeesTable.findFirst({
		where: and(
			eq(competitionDivisionFeesTable.competitionId, competitionId),
			eq(competitionDivisionFeesTable.divisionId, divisionId),
		),
	})

	if (divisionFee) {
		return divisionFee.feeCents
	}

	// Fall back to competition default
	const competition = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, competitionId),
	})

	return competition?.defaultRegistrationFeeCents ?? 0
}

/**
 * Build fee configuration from competition settings
 * Falls back to platform defaults for any missing values
 */
export function buildFeeConfig(competition: {
	platformFeePercentage?: number | null
	platformFeeFixed?: number | null
	passStripeFeesToCustomer?: boolean | null
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
	}
}

/**
 * Format cents as a dollar amount string
 * @example formatCents(5325) => "$53.25"
 */
export function formatCents(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`
}
