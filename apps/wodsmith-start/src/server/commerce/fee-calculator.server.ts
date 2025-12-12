import "server-only"
import { and, eq } from "drizzle-orm"
import { getDb } from "@/db/index.server"
import {
	competitionsTable,
	competitionDivisionsTable,
	scalingLevelsTable,
	commercePurchaseTable,
	COMMERCE_PURCHASE_STATUS,
} from "@/db/schema.server"

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
	/** If true, platform fees are passed to customer instead of absorbed by organizer (default: true) */
	passPlatformFeesToCustomer: boolean
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
	stripeFeesPassedToCustomer: boolean
	/** Whether platform fees were passed to customer */
	platformFeesPassedToCustomer: boolean
}

/**
 * Get registration fee for a specific competition division
 *
 * Resolution order:
 * 1. Division-specific fee (from competition_divisions table)
 * 2. Competition default fee (from competitions.defaultRegistrationFeeCents)
 * 3. $0 (free)
 */
export async function getRegistrationFee(
	competitionId: string,
	divisionId: string,
): Promise<number> {
	const db = getDb()

	// Check for division-specific fee first
	const divisionFee = await db.query.competitionDivisionsTable.findFirst({
		where: and(
			eq(competitionDivisionsTable.competitionId, competitionId),
			eq(competitionDivisionsTable.divisionId, divisionId),
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

	return competition.defaultRegistrationFeeCents ?? 0
}

/**
 * Build fee configuration from competition settings
 * Uses plan-based defaults with competition-specific overrides
 */
export function buildFeeConfig(competition: {
	platformFeePercentage: number | null
	platformFeeFixed: number | null
	passStripeFeesToCustomer?: boolean | null
	passPlatformFeesToCustomer?: boolean | null
}): FeeConfiguration {
	return {
		platformPercentageBasisPoints: Math.round(
			(competition.platformFeePercentage ?? 2.5) * 100,
		),
		platformFixedCents: competition.platformFeeFixed ?? 0,
		stripePercentageBasisPoints: 290, // 2.9%
		stripeFixedCents: 30, // $0.30
		passStripeFeesToCustomer: competition.passStripeFeesToCustomer ?? true,
		passPlatformFeesToCustomer: competition.passPlatformFeesToCustomer ?? true,
	}
}

/**
 * Calculate complete fee breakdown for a registration
 */
export function calculateCompetitionFees(
	registrationFeeCents: number,
	config: FeeConfiguration,
): FeeBreakdown {
	// Calculate platform fee
	const platformFeePercentage = config.platformPercentageBasisPoints / 10000
	const platformFeeFromPercentage = Math.ceil(
		registrationFeeCents * platformFeePercentage,
	)
	const platformFeeCents =
		platformFeeFromPercentage + config.platformFixedCents

	// Calculate total charge if we pass fees to customer
	let totalChargedBeforeStripe = registrationFeeCents + platformFeeCents

	// Calculate what organizer gets if we absorb platform fees
	let organizerBeforeStripe = registrationFeeCents
	if (!config.passPlatformFeesToCustomer) {
		organizerBeforeStripe -= platformFeeCents
	}

	// Calculate Stripe fee on the amount charged to customer
	const stripeRate = config.stripePercentageBasisPoints / 10000
	const stripeFeeCentsFromPercentage = Math.ceil(
		totalChargedBeforeStripe * stripeRate,
	)
	const stripeFeeCents = stripeFeeCentsFromPercentage + config.stripeFixedCents

	// Final totals
	let totalChargeCents = totalChargedBeforeStripe
	let organizerNetCents = organizerBeforeStripe

	// Adjust for Stripe fee handling
	if (config.passStripeFeesToCustomer) {
		totalChargeCents += stripeFeeCents
	} else {
		organizerNetCents -= stripeFeeCents
	}

	// Ensure organizer never gets negative
	organizerNetCents = Math.max(0, organizerNetCents)

	return {
		registrationFeeCents,
		platformFeeCents,
		stripeFeeCents,
		totalChargeCents,
		organizerNetCents,
		stripeFeesPassedToCustomer: config.passStripeFeesToCustomer,
		platformFeesPassedToCustomer: config.passPlatformFeesToCustomer,
	}
}

/**
 * Revenue stats for a competition with fee breakdowns
 */
export interface CompetitionRevenueStats {
	/** Total gross revenue collected from customers (in cents) */
	totalGrossCents: number
	/** Total platform fees (Wodsmith revenue) */
	totalPlatformFeeCents: number
	/** Total Stripe processing fees */
	totalStripeFeeCents: number
	/** Total net revenue for organizer after all fees */
	totalOrganizerNetCents: number
	/** Number of completed purchases */
	purchaseCount: number
	/** Breakdown by division */
	byDivision: Array<{
		divisionId: string
		divisionLabel: string
		purchaseCount: number
		/** Registration fee per athlete (ticket price) in cents */
		registrationFeeCents: number
		grossCents: number
		platformFeeCents: number
		stripeFeeCents: number
		organizerNetCents: number
	}>
}

/**
 * Get revenue stats for a competition
 * Aggregates all completed purchases with fee breakdowns
 */
export async function getCompetitionRevenueStats(
	competitionId: string,
): Promise<CompetitionRevenueStats> {
	const db = getDb()

	// Get all completed purchases for this competition
	const purchases = await db
		.select({
			divisionId: commercePurchaseTable.divisionId,
			totalCents: commercePurchaseTable.totalCents,
			platformFeeCents: commercePurchaseTable.platformFeeCents,
			stripeFeeCents: commercePurchaseTable.stripeFeeCents,
			organizerNetCents: commercePurchaseTable.organizerNetCents,
		})
		.from(commercePurchaseTable)
		.where(
			and(
				eq(commercePurchaseTable.competitionId, competitionId),
				eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.COMPLETED),
			),
		)

	// Get division labels and fees
	const divisionIds = [
		...new Set(purchases.map((p) => p.divisionId).filter(Boolean)),
	] as string[]

	const divisions =
		divisionIds.length > 0
			? await db.query.scalingLevelsTable.findMany({
					where: (table, { inArray }) => inArray(table.id, divisionIds),
					columns: {
						id: true,
						label: true,
					},
				})
			: []

	// Get division fees for ticket prices
	const divisionFees =
		divisionIds.length > 0
			? await db.query.competitionDivisionsTable.findMany({
					where: and(
						eq(competitionDivisionsTable.competitionId, competitionId),
						(table, { inArray }) =>
							inArray(table.divisionId, divisionIds),
					),
					columns: {
						divisionId: true,
						feeCents: true,
					},
				})
			: []

	// Get competition default fee as fallback for divisions without specific fees
	const competition = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, competitionId),
		columns: { defaultRegistrationFeeCents: true },
	})
	const defaultFeeCents = competition?.defaultRegistrationFeeCents ?? 0

	const divisionMap = new Map(divisions.map((d) => [d.id, d.label]))
	const divisionFeeMap = new Map(
		divisionFees.map((f) => [f.divisionId, f.feeCents]),
	)

	// Aggregate totals
	let totalGrossCents = 0
	let totalPlatformFeeCents = 0
	let totalStripeFeeCents = 0
	let totalOrganizerNetCents = 0

	// Group by division
	const divisionAggregates = new Map<
		string,
		{
			purchaseCount: number
			grossCents: number
			platformFeeCents: number
			stripeFeeCents: number
			organizerNetCents: number
		}
	>()

	for (const purchase of purchases) {
		totalGrossCents += purchase.totalCents
		totalPlatformFeeCents += purchase.platformFeeCents
		totalStripeFeeCents += purchase.stripeFeeCents
		totalOrganizerNetCents += purchase.organizerNetCents

		const divisionId = purchase.divisionId ?? "unknown"
		const existing = divisionAggregates.get(divisionId) ?? {
			purchaseCount: 0,
			grossCents: 0,
			platformFeeCents: 0,
			stripeFeeCents: 0,
			organizerNetCents: 0,
		}

		divisionAggregates.set(divisionId, {
			purchaseCount: existing.purchaseCount + 1,
			grossCents: existing.grossCents + purchase.totalCents,
			platformFeeCents: existing.platformFeeCents + purchase.platformFeeCents,
			stripeFeeCents: existing.stripeFeeCents + purchase.stripeFeeCents,
			organizerNetCents:
				existing.organizerNetCents + purchase.organizerNetCents,
		})
	}

	const byDivision = Array.from(divisionAggregates.entries()).map(
		([divisionId, stats]) => ({
			divisionId,
			divisionLabel: divisionMap.get(divisionId) ?? "Unknown",
			registrationFeeCents: divisionFeeMap.get(divisionId) ?? defaultFeeCents,
			...stats,
		}),
	)

	return {
		totalGrossCents,
		totalPlatformFeeCents,
		totalStripeFeeCents,
		totalOrganizerNetCents,
		purchaseCount: purchases.length,
		byDivision,
	}
}
