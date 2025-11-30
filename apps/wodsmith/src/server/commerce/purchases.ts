"use server"
import { desc, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
	commercePurchaseTable,
	commerceProductTable,
	competitionsTable,
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
		startDate: Date | null
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

	// Fetch competition details for each purchase
	const competitionIds = [
		...new Set(purchases.map((p) => p.competitionId).filter(Boolean)),
	] as string[]

	const competitions =
		competitionIds.length > 0
			? await db.query.competitionsTable.findMany({
					where: (table, { inArray }) => inArray(table.id, competitionIds),
					with: {
						organizingTeam: {
							columns: { name: true },
						},
					},
					columns: {
						id: true,
						name: true,
						slug: true,
						startDate: true,
					},
				})
			: []

	const competitionMap = new Map(competitions.map((c) => [c.id, c]))

	return purchases.map((p) => ({
		id: p.id,
		status: p.status,
		totalCents: p.totalCents,
		platformFeeCents: p.platformFeeCents,
		stripeFeeCents: p.stripeFeeCents,
		organizerNetCents: p.organizerNetCents,
		stripePaymentIntentId: p.stripePaymentIntentId,
		completedAt: p.completedAt,
		createdAt: p.createdAt,
		product: {
			id: p.productId,
			name: p.productName,
			type: p.productType,
			priceCents: p.productPriceCents,
		},
		competition: p.competitionId ? competitionMap.get(p.competitionId) ?? null : null,
	}))
}

export type InvoiceDetails = PurchaseWithDetails & {
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
}

/**
 * Get detailed invoice data for a single purchase
 * Includes Stripe payment details when available
 */
export async function getInvoiceDetails(
	purchaseId: string,
	userId: string,
): Promise<InvoiceDetails | null> {
	const db = getDb()

	const purchase = await db.query.commercePurchaseTable.findFirst({
		where: (table, { and, eq }) =>
			and(eq(table.id, purchaseId), eq(table.userId, userId)),
		with: {
			product: true,
			user: {
				columns: {
					firstName: true,
					lastName: true,
					email: true,
				},
			},
		},
	})

	if (!purchase) return null

	// Get competition details if available
	let competition: InvoiceDetails["competition"] = null
	if (purchase.competitionId) {
		const comp = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, purchase.competitionId),
			with: {
				organizingTeam: {
					columns: { name: true },
				},
			},
			columns: {
				id: true,
				name: true,
				slug: true,
				startDate: true,
			},
		})
		competition = comp ?? null
	}

	// Fetch Stripe payment details if we have a payment intent
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

	return {
		id: purchase.id,
		status: purchase.status,
		totalCents: purchase.totalCents,
		platformFeeCents: purchase.platformFeeCents,
		stripeFeeCents: purchase.stripeFeeCents,
		organizerNetCents: purchase.organizerNetCents,
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
	}
}
