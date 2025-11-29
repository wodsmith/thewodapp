"use server"
import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionDivisionFeesTable,
	competitionsTable,
} from "@/db/schema"



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

	if (!competition) {
		throw new Error(
			`Competition not found: ${competitionId}. Cannot retrieve registration fee.`,
		)
	}

	return competition.defaultRegistrationFeeCents
}


