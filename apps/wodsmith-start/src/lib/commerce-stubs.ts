/**
 * Commerce function stubs for TanStack Start migration
 * TODO: Port these functions from apps/wodsmith/src/server/commerce.ts
 */

import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { competitionDivisionsTable, competitionsTable } from "@/db/schema"

export interface FeeBreakdown {
	totalChargeCents: number
	platformFeeCents: number
	stripeFeeCents: number
	organizerNetCents: number
}

interface FeeConfig {
	platformFeePercent: number
	passStripeFeesToCustomer: boolean
}

/**
 * Build fee configuration from competition settings
 */
export function buildFeeConfig(competition: {
	platformFeePercent?: number | null
	passStripeFeesToCustomer?: boolean | null
}): FeeConfig {
	return {
		platformFeePercent: competition.platformFeePercent ?? 5, // Default 5%
		passStripeFeesToCustomer: competition.passStripeFeesToCustomer ?? false,
	}
}

/**
 * Calculate competition fees based on registration fee and config
 */
export function calculateCompetitionFees(
	registrationFeeCents: number,
	config: FeeConfig,
): FeeBreakdown {
	// Platform fee (percentage of registration fee)
	const platformFeeCents = Math.round(
		registrationFeeCents * (config.platformFeePercent / 100),
	)

	// Stripe fee: 2.9% + $0.30
	const stripeRate = 0.029
	const stripeFixedCents = 30

	// If passing Stripe fees to customer, add them to total
	let totalChargeCents: number
	let stripeFeeCents: number

	if (config.passStripeFeesToCustomer) {
		// Calculate what total needs to be so that after Stripe takes their cut,
		// we have registrationFeeCents + platformFeeCents
		const baseAmount = registrationFeeCents + platformFeeCents
		totalChargeCents = Math.ceil(
			(baseAmount + stripeFixedCents) / (1 - stripeRate),
		)
		stripeFeeCents = totalChargeCents - baseAmount
	} else {
		// Organizer absorbs Stripe fees
		totalChargeCents = registrationFeeCents + platformFeeCents
		stripeFeeCents =
			Math.round(totalChargeCents * stripeRate) + stripeFixedCents
	}

	// Organizer net = registration fee - platform fee - stripe fee (if not passed to customer)
	const organizerNetCents = config.passStripeFeesToCustomer
		? registrationFeeCents - platformFeeCents
		: registrationFeeCents - platformFeeCents - stripeFeeCents

	return {
		totalChargeCents,
		platformFeeCents,
		stripeFeeCents,
		organizerNetCents,
	}
}

/**
 * Get registration fee for a specific division
 * Falls back to competition default if no division-specific fee
 */
export async function getRegistrationFee(
	competitionId: string,
	divisionId: string,
): Promise<number> {
	const db = getDb()

	// First check for division-specific fee
	const division = await db.query.competitionDivisionsTable.findFirst({
		where: eq(competitionDivisionsTable.id, divisionId),
	})

	if (division?.feeCents != null) {
		return division.feeCents
	}

	// Fall back to competition default
	const competition = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, competitionId),
	})

	return competition?.defaultRegistrationFeeCents ?? 0
}
