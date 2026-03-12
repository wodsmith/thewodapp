/**
 * Commerce Purchases for TanStack Start
 * Handles purchase retrieval and invoice details with Stripe integration.
 */
import { and, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	commerceProductTable,
	commercePurchaseTable,
	competitionsTable,
	productCouponRedemptionsTable,
	scalingLevelsTable,
} from "@/db/schema"
import { getStripe } from "@/lib/stripe"

export type PurchaseWithDetails = {
	id: string
	status: string
	totalCents: number
	platformFeeCents: number
	stripeFeeCents: number
	organizerNetCents: number
	stripePaymentIntentId: string | null
	stripeCheckoutSessionId: string | null
	completedAt: Date | null
	createdAt: Date
	product: {
		id: string
		name: string
		type: string
		priceCents: number
	}
	competition: {
		id: string
		name: string
		slug: string
		startDate: string | null // YYYY-MM-DD format
		organizingTeam: {
			name: string
		} | null
	} | null
}

/**
 * Get all purchases for a user with product and competition details
 */
export async function getUserPurchases(
	userId: string,
): Promise<PurchaseWithDetails[]> {
	const db = getDb()

	const purchases = await db
		.select({
			id: commercePurchaseTable.id,
			status: commercePurchaseTable.status,
			totalCents: commercePurchaseTable.totalCents,
			platformFeeCents: commercePurchaseTable.platformFeeCents,
			stripeFeeCents: commercePurchaseTable.stripeFeeCents,
			organizerNetCents: commercePurchaseTable.organizerNetCents,
			stripePaymentIntentId: commercePurchaseTable.stripePaymentIntentId,
			stripeCheckoutSessionId: commercePurchaseTable.stripeCheckoutSessionId,
			completedAt: commercePurchaseTable.completedAt,
			createdAt: commercePurchaseTable.createdAt,
			competitionId: commercePurchaseTable.competitionId,
			productId: commercePurchaseTable.productId,
			productName: commerceProductTable.name,
			productType: commerceProductTable.type,
			productPriceCents: commerceProductTable.priceCents,
		})
		.from(commercePurchaseTable)
		.innerJoin(
			commerceProductTable,
			eq(commercePurchaseTable.productId, commerceProductTable.id),
		)
		.where(eq(commercePurchaseTable.userId, userId))
		.orderBy(desc(commercePurchaseTable.createdAt))

	// Fetch competition details for each purchase (batched)
	const competitionIds = [
		...new Set(purchases.map((p) => p.competitionId).filter(Boolean)),
	] as string[]

	const competitions =
		competitionIds.length > 0
			? await db.query.competitionsTable.findMany({
					where: inArray(competitionsTable.id, competitionIds),
					with: {
						organizingTeam: {
							columns: { name: true },
						},
					},
				})
			: []

	const competitionMap = new Map(competitions.map((c) => [c.id, c] as const))

	return purchases.map((p) => {
		const comp = p.competitionId ? competitionMap.get(p.competitionId) : null
		return {
			id: p.id,
			status: p.status,
			totalCents: p.totalCents,
			platformFeeCents: p.platformFeeCents,
			stripeFeeCents: p.stripeFeeCents,
			organizerNetCents: p.organizerNetCents,
			stripePaymentIntentId: p.stripePaymentIntentId,
			stripeCheckoutSessionId: p.stripeCheckoutSessionId,
			completedAt: p.completedAt,
			createdAt: p.createdAt,
			product: {
				id: p.productId,
				name: p.productName,
				type: p.productType,
				priceCents: p.productPriceCents,
			},
			competition: comp
				? {
						id: comp.id,
						name: comp.name,
						slug: comp.slug,
						startDate: comp.startDate,
						organizingTeam: ("organizingTeam" in comp
							? comp.organizingTeam
							: null) as { name: string } | null,
					}
				: null,
		}
	})
}

export type InvoiceLineItem = {
	purchaseId: string
	divisionLabel: string | null
	totalCents: number
	platformFeeCents: number
	stripeFeeCents: number
	registrationFeeCents: number
}

export type InvoiceDetails = {
	/** Primary purchase ID (first in the group) */
	id: string
	status: string
	/** Combined total across all line items */
	totalCents: number
	stripePaymentIntentId: string | null
	completedAt: Date | null
	createdAt: Date
	product: {
		id: string
		name: string
		type: string
		priceCents: number
	}
	competition: {
		id: string
		name: string
		slug: string
		startDate: string | null
		organizingTeam: {
			name: string
		} | null
	} | null
	user: {
		firstName: string | null
		lastName: string | null
		email: string | null
	}
	stripe: {
		paymentMethod: string | null
		last4: string | null
		brand: string | null
		receiptUrl: string | null
	} | null
	coupon: {
		code: string
		amountOffCents: number
	} | null
	/** Per-division line items */
	lineItems: InvoiceLineItem[]
}

/**
 * Get detailed invoice data for a purchase (grouped by checkout session).
 * If multiple divisions were purchased together, all are returned as line items.
 */
export async function getInvoiceDetails(
	purchaseId: string,
	userId: string,
): Promise<InvoiceDetails | null> {
	const db = getDb()

	// Load the target purchase with relations
	const purchase = await db.query.commercePurchaseTable.findFirst({
		where: (table, { and: a, eq: e }) =>
			a(e(table.id, purchaseId), e(table.userId, userId)),
		with: {
			product: true,
			user: {
				columns: {
					firstName: true,
					lastName: true,
					email: true,
				},
			},
			couponRedemption: {
				with: {
					coupon: { columns: { code: true } },
				},
			},
		},
	})

	if (!purchase) return null

	// Find sibling purchases from the same checkout session
	let allPurchases: Array<{
		id: string
		divisionId: string | null
		totalCents: number
		platformFeeCents: number
		stripeFeeCents: number
	}> = [
		{
			id: purchase.id,
			divisionId: purchase.divisionId,
			totalCents: purchase.totalCents,
			platformFeeCents: purchase.platformFeeCents,
			stripeFeeCents: purchase.stripeFeeCents,
		},
	]

	if (purchase.stripeCheckoutSessionId) {
		const siblings = await db
			.select({
				id: commercePurchaseTable.id,
				divisionId: commercePurchaseTable.divisionId,
				totalCents: commercePurchaseTable.totalCents,
				platformFeeCents: commercePurchaseTable.platformFeeCents,
				stripeFeeCents: commercePurchaseTable.stripeFeeCents,
			})
			.from(commercePurchaseTable)
			.where(
				and(
					eq(
						commercePurchaseTable.stripeCheckoutSessionId,
						purchase.stripeCheckoutSessionId,
					),
					eq(commercePurchaseTable.userId, userId),
				),
			)

		if (siblings.length > 1) {
			allPurchases = siblings
		}
	}

	// Fetch division labels
	const divisionIds = allPurchases
		.map((p) => p.divisionId)
		.filter(Boolean) as string[]
	const divisionMap = new Map<string, string>()
	if (divisionIds.length > 0) {
		const divisions = await db
			.select({
				id: scalingLevelsTable.id,
				label: scalingLevelsTable.label,
			})
			.from(scalingLevelsTable)
			.where(inArray(scalingLevelsTable.id, divisionIds))
		for (const d of divisions) {
			divisionMap.set(d.id, d.label)
		}
	}

	// Build line items
	const lineItems: InvoiceLineItem[] = allPurchases.map((p) => ({
		purchaseId: p.id,
		divisionLabel: p.divisionId ? (divisionMap.get(p.divisionId) ?? null) : null,
		totalCents: p.totalCents,
		platformFeeCents: p.platformFeeCents,
		stripeFeeCents: p.stripeFeeCents,
		registrationFeeCents:
			p.totalCents - p.platformFeeCents - p.stripeFeeCents,
	}))

	// Combined total
	const totalCents = allPurchases.reduce((sum, p) => sum + p.totalCents, 0)

	// Get competition details
	let competition: InvoiceDetails["competition"] = null
	if (purchase.competitionId) {
		const comp = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, purchase.competitionId),
			with: {
				organizingTeam: {
					columns: { name: true },
				},
			},
		})
		if (comp) {
			competition = {
				id: comp.id,
				name: comp.name,
				slug: comp.slug,
				startDate: comp.startDate,
				organizingTeam: ("organizingTeam" in comp
					? comp.organizingTeam
					: null) as { name: string } | null,
			}
		}
	}

	// Fetch Stripe payment details
	let stripeDetails: InvoiceDetails["stripe"] = null
	if (purchase.stripePaymentIntentId) {
		try {
			const stripe = getStripe()
			const paymentIntent = await stripe.paymentIntents.retrieve(
				purchase.stripePaymentIntentId,
				{ expand: ["latest_charge"] },
			)

			const charge = paymentIntent.latest_charge
			if (charge && typeof charge === "object") {
				const paymentMethodDetails = charge.payment_method_details
				stripeDetails = {
					paymentMethod: paymentMethodDetails?.type ?? null,
					last4:
						paymentMethodDetails?.card?.last4 ??
						paymentMethodDetails?.us_bank_account?.last4 ??
						null,
					brand: paymentMethodDetails?.card?.brand ?? null,
					receiptUrl: charge.receipt_url ?? null,
				}
			}
		} catch {
			// Stripe fetch failed - continue without payment details
		}
	}

	// Build coupon info — get from the coupon table (applied once per transaction)
	let coupon: InvoiceDetails["coupon"] = null
	if (purchase.couponRedemption) {
		coupon = {
			code: purchase.couponRedemption.coupon.code,
			amountOffCents: purchase.couponRedemption.amountOffCents,
		}
	}
	// If this purchase didn't have a redemption, check siblings
	if (!coupon && allPurchases.length > 1) {
		const siblingIds = allPurchases
			.filter((p) => p.id !== purchase.id)
			.map((p) => p.id)
		if (siblingIds.length > 0) {
			const siblingRedemption =
				await db.query.productCouponRedemptionsTable.findFirst({
					where: inArray(productCouponRedemptionsTable.purchaseId, siblingIds),
					with: { coupon: { columns: { code: true } } },
				})
			if (siblingRedemption) {
				coupon = {
					code: siblingRedemption.coupon.code,
					amountOffCents: siblingRedemption.amountOffCents,
				}
			}
		}
	}

	return {
		id: purchase.id,
		status: purchase.status,
		totalCents,
		stripePaymentIntentId: purchase.stripePaymentIntentId,
		completedAt: purchase.completedAt,
		createdAt: purchase.createdAt,
		product: {
			id: purchase.product.id,
			name: purchase.product.name,
			type: purchase.product.type,
			priceCents: purchase.product.priceCents,
		},
		competition,
		user: {
			firstName: purchase.user.firstName,
			lastName: purchase.user.lastName,
			email: purchase.user.email,
		},
		stripe: stripeDetails,
		coupon,
		lineItems,
	}
}
